# Forecast/Harvest MCP Server

A MCP (Model Context Protocol) server that exposes Harvest and Harvest Forecast data to AI assistants such as Claude.

The two APIs answer different questions and the server exposes both:

- **Harvest** (`list_*`, `report_time_*`) — what was actually burned: projects, tasks, users, project membership, time entries, and time reports.
- **Forecast** (`forecast__*`) — what is *scheduled*: allocations, people and their capacity, placeholders, milestones, and time off.

Every Forecast tool is read-only. Harvest is read-only apart from the timesheet writes — `create_time_entry`, `update_time_entry`, `delete_time_entry`, `restart_time_entry` and `stop_time_entry` — which let an assistant record time against a project on your behalf. Those five are registered without `readOnlyHint`, so an MCP host that gates writes will prompt before each one. No other Harvest write endpoint is exposed: projects, tasks, clients, users and invoices remain read-only.

## Prerequisites

- Node.js 20 or later — [`.nvmrc`](.nvmrc) pins the version used for local development
- pnpm (the repo sets `packageManager`, so `corepack enable` is enough)
- Docker, for containerised deployment
- A Harvest account with API credentials, and a `manager` or `administrator` role

## Environment Variables

| Variable              | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `HarvestAccountID`    | Your Harvest account ID                                           |
| `ForecastAccountID`   | Your Forecast account ID — required only by the `forecast__` tools |
| `AuthorizationBearer` | Your Harvest personal access token — authenticates **both** APIs   |

All three are read at startup in [`src/config.ts`](src/config.ts). Create the token at https://id.getharvest.com/developers.

`ForecastAccountID` is **not** the same number as `HarvestAccountID`. It is the numeric id in the Forecast web URL (`https://forecastapp.com/<ForecastAccountID>/schedule/team`). To get both ids for a token:

```bash
curl -s https://id.getharvest.com/api/v2/accounts \
  -H "Authorization: Bearer $AuthorizationBearer" -H "User-Agent: forecast-mcp"
```

The response lists one entry per account with a `product` field of either `harvest` or `forecast`. `forecast__test_connection` confirms the pair resolves once configured.

The Harvest tools work without `ForecastAccountID`; only the `forecast__` tools fail, and they say so explicitly rather than returning empty results.

## Building

```bash
pnpm install
pnpm run typecheck   # tsc --noEmit
pnpm run build       # bundles to build/index.mjs via esbuild
```

The build is a single ESM bundle, so the Docker image needs nothing but that one file. `pnpm run typecheck` is the same check CI runs.

To rebuild the container from scratch — this removes any existing `forecast-mcp` container and image, rebuilds the bundle, then builds a fresh image tagged `forecast-mcp`:

```bash
./docker-build.sh
```

## Available Tools

| Area             | Tools                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| Connection       | `test_harvest_api`                                                                     |
| Projects         | `list_projects`, `get_project`                                                          |
| Tasks            | `list_tasks`, `get_task`                                                                |
| Users            | `list_users`, `get_user`, `get_current_user`                                            |
| User assignments | `list_user_assignments`                                                                 |
| Task assignments | `list_task_assignments`                                                                 |
| Time entries     | `list_time_entries`, `get_time_entry`                                                   |
| Timesheet writes | `create_time_entry`, `update_time_entry`, `delete_time_entry`, `restart_time_entry`, `stop_time_entry` |
| Time reports     | `report_time_clients`, `report_time_projects`, `report_time_tasks`, `report_time_team`  |

### Forecast tools

| Area         | Tools                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| Connection   | `forecast__test_connection`                                                  |
| Allocations  | `forecast__list_assignments`                                                 |
| People       | `forecast__list_people`, `forecast__list_placeholders`                       |
| Projects     | `forecast__list_forecast_projects`, `forecast__list_milestones`              |
| Reference    | `forecast__list_clients`, `forecast__list_roles`                             |

Each tool's description and its full set of parameters are the single source of truth in the code, and are what the AI assistant actually sees:

- **Descriptions and enable/disable flags** — `TOOLS_CONFIG` in [`src/index.ts`](src/index.ts)
- **Parameters and validation schemas** — `registerTools` in [`src/tools.ts`](src/tools.ts)

### Scheduled Forecast hours

`report_time_projects` and `report_time_team` accept `include_forecast: true`, which adds a `scheduled_hours` field alongside the tracked hours. This requires the Harvest account to be connected to Forecast; the field is `null` when there are no Forecast assignments. That field is a single rolled-up total — use the `forecast__` tools when you need the underlying per-person, per-project allocations.

## Recording time

`create_time_entry` writes to a timesheet. It defaults to the authenticated user's own timesheet; passing `user_id` logs on someone else's behalf and needs a manager or administrator role.

Three things determine whether the write is accepted:

- **`task_id` must be assigned to the project.** Harvest rejects a task that exists on the account but is not on that project, so resolve the id with `list_task_assignments` (scoped by `project_id`), not `list_tasks`.
- **The duration field depends on the account.** A Harvest account tracks time *either* by duration *or* by start and end time. Pass `hours` (decimal — `1.5` is 90 minutes) on a duration account, or `started_time`/`ended_time` (`"8:00am"`) on a start-and-end-time account. Passing both is rejected locally before the request is made; passing the wrong one for the account comes back as a `422` from Harvest, and the fix is to retry with the other shape.
- **Omitting the duration starts a timer.** A create with neither `hours` nor `started_time` leaves a *running* entry rather than a completed one. Stop it with `stop_time_entry` — `list_time_entries` with `is_running: true` finds it.

`delete_time_entry` is permanent, and Harvest refuses it outright once an entry has been invoiced or approved. It returns the deleted entry rather than the empty body Harvest's docs describe, so the response is a record of what was removed. `restart_time_entry` only works on entries spent today.

Harvest's API has no timesheet-submission endpoint, so submitting a timesheet for approval is still a thing to do in the Harvest UI.

## Working with Forecast data

The Forecast API accepts the same personal access token as Harvest; only the base URL (`https://api.forecastapp.com`) and the account header (`Forecast-Account-Id`) differ. It is stable in practice but **is not officially documented or supported**, so [`src/forecast.ts`](src/forecast.ts) pins the response shape of every endpoint. Fields the tools depend on are required, anything else passes through untouched, and a shape change throws a named error rather than returning a half-understood payload that reads as authoritative.

Four things are easy to get wrong.

**`allocation` is seconds per working day.** It is not the total for the span. A person's hours in a week are:

```
allocation / 3600  ×  (their working days that fall inside start_date..end_date)
```

`start_date` and `end_date` are inclusive at both ends, and the per-weekday `working_days` booleans come from `forecast__list_people`.

**A null `allocation` means a full day, not zero.** Substitute the person's default daily capacity (`weekly_capacity` ÷ their number of working days). Most time-off rows come back with a null allocation, so reading null as zero silently erases PTO and overstates available capacity.

**Forecast ids are not Harvest ids.** `person_id` and `project_id` on an assignment are Forecast ids. Join to Harvest actuals through `forecast__list_people.harvest_user_id` and `forecast__list_forecast_projects.harvest_id`; email is the fallback join key and matching on name is a last resort. The account ids differ too — see the environment variables above.

**A row with `placeholder_id` instead of `person_id` is an unnamed resource.** Forecast is already saying that slot needs a body, so reconcile against `forecast__list_placeholders` rather than recommending a duplicate hire.

### Time off

Forecast has no dedicated time-off endpoint. Time off is recorded as ordinary assignments against designated leave projects, so `forecast__list_assignments` already returns it — treat those assignments as reductions in available hours and never as demand.

Resolve the leave project ids once with `forecast__list_forecast_projects` and record them alongside the roster the consuming skill reads, rather than pattern-matching project names at runtime.

### Deliberate non-behaviours

- **Raw seconds are returned, never hours.** Rounding in the server would lose the ability to reconcile against Forecast's own UI numbers.
- **Archived records are not filtered out.** The flag is surfaced and the caller decides — a project archived mid-quarter still consumed capacity in the weeks before it was archived.
- **`forecast__list_assignments` requires `start_date` and `end_date`.** The unbounded response is large enough to be unusable in a tool response.
- **Only time entries can be written.** The timesheet writes are the whole write surface; creating projects, tasks, clients or invoices stays out of the server, as does writing back to Forecast — an assignment is a scheduling decision, not something to change as a side effect of a question.
- **Omitted optional fields are dropped, not sent as null.** `update_time_entry` only changes the fields you pass, so a partial update never blanks a note or a duration you did not mention.

### Enabling and disabling tools

Toggle a tool's `enabled` flag in `TOOLS_CONFIG`. A disabled tool is never registered, so it does not appear in `tools/list` at all:

```ts
export const TOOLS_CONFIG = {
  list_projects: {
    description: 'List all projects, optionally filtered by active status or client',
    enabled: true,
  },
  get_project: {
    description: 'Retrieve a specific project by ID',
    enabled: false, // hidden from the assistant
  },
  // ...
} satisfies Record<string, { description: string; enabled: boolean }>;
```

Rebuild after any change for it to take effect.

## Using a Pre-built Image from GitHub Actions

Every pull request and merge to `main` typechecks, builds, and uploads a Docker image artifact. This is the easiest way to get started without a local Node.js toolchain.

1. Go to the **Actions** tab in the GitHub repository.
2. Select the latest passing **Build Docker Image** workflow run.
3. Under **Artifacts**, download `forecast-mcp-docker-image`.
4. Unzip it, then load and verify the image:

```bash
docker load < forecast-mcp.tar.gz
docker images forecast-mcp
```

## Claude Desktop Configuration

Add the following to your Claude Desktop configuration — see [Connect local servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers). The `-e` flags forward the credentials into the container:

```json
"mcpServers": {
  "forecast": {
    "command": "docker",
    "args": [
      "run", "--rm", "-i",
      "-e", "HarvestAccountID",
      "-e", "ForecastAccountID",
      "-e", "AuthorizationBearer",
      "forecast-mcp"
    ],
    "env": {
      "HarvestAccountID": "your-harvest-account-id",
      "ForecastAccountID": "your-forecast-account-id",
      "AuthorizationBearer": "your-personal-access-token"
    }
  }
}
```

To run the bundle directly instead of through Docker, point `command` at `node` and `args` at the absolute path to `build/index.mjs`.

## Development Notes

The server is built on [`@modelcontextprotocol/server`](https://ts.sdk.modelcontextprotocol.io/v2/) v2 and speaks MCP over stdio:

- [`src/index.ts`](src/index.ts) — tool config, plus `serveStdio(createServer)` and signal handling. `serveStdio` takes a server *factory*; it builds one instance per connection and negotiates the protocol version.
- [`src/tools.ts`](src/tools.ts) — the shared Harvest fetch helper and every `registerTool` call, for both APIs. Tool inputs are Zod v4 object schemas, which the SDK converts to JSON Schema and validates before a handler runs.
- [`src/forecast.ts`](src/forecast.ts) — the Forecast fetch helper and the pinned response schemas. Add a field here when Forecast adds one you need to depend on; unknown fields already pass through, so this is only for fields whose *absence* should be an error.
- Because stdout carries the JSON-RPC stream, all logging must go to stderr. Use `console.error`, never `console.log`.
