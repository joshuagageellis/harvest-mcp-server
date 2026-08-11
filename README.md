# Forecast/Harvest MCP Server

A MCP (Model Context Protocol) server that exposes Harvest API data to AI assistants such as Claude. It provides read access to projects, tasks, users, user assignments, time entries, and time reports.

Every tool is read-only. The shared fetch helper issues `GET` requests only, so Harvest's write endpoints (create, update, delete, and the timer restart/stop actions) are deliberately not exposed.

## Prerequisites

- Node.js 20 or later — [`.nvmrc`](.nvmrc) pins the version used for local development
- pnpm (the repo sets `packageManager`, so `corepack enable` is enough)
- Docker, for containerised deployment
- A Harvest account with API credentials, and a `manager` or `administrator` role

## Environment Variables

| Variable              | Description                        |
| --------------------- | ---------------------------------- |
| `HarvestAccountID`    | Your Harvest account ID            |
| `AuthorizationBearer` | Your Harvest personal access token |

Both are read at startup in [`src/config.ts`](src/config.ts). Create them at https://id.getharvest.com/developers.

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
| Time entries     | `list_time_entries`, `get_time_entry`                                                   |
| Time reports     | `report_time_clients`, `report_time_projects`, `report_time_tasks`, `report_time_team`  |

Each tool's description and its full set of parameters are the single source of truth in the code, and are what the AI assistant actually sees:

- **Descriptions and enable/disable flags** — `TOOLS_CONFIG` in [`src/index.ts`](src/index.ts)
- **Parameters and validation schemas** — `registerTools` in [`src/tools.ts`](src/tools.ts)

### Scheduled Forecast hours

`report_time_projects` and `report_time_team` accept `include_forecast: true`, which adds a `scheduled_hours` field alongside the tracked hours. This requires the Harvest account to be connected to Forecast; the field is `null` when there are no Forecast assignments.

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
      "-e", "AuthorizationBearer",
      "forecast-mcp"
    ],
    "env": {
      "HarvestAccountID": "your-harvest-account-id",
      "AuthorizationBearer": "your-personal-access-token"
    }
  }
}
```

To run the bundle directly instead of through Docker, point `command` at `node` and `args` at the absolute path to `build/index.mjs`.

## Development Notes

The server is built on [`@modelcontextprotocol/server`](https://ts.sdk.modelcontextprotocol.io/v2/) v2 and speaks MCP over stdio:

- [`src/index.ts`](src/index.ts) — tool config, plus `serveStdio(createServer)` and signal handling. `serveStdio` takes a server *factory*; it builds one instance per connection and negotiates the protocol version.
- [`src/tools.ts`](src/tools.ts) — the shared Harvest fetch helper and every `registerTool` call. Tool inputs are Zod v4 object schemas, which the SDK converts to JSON Schema and validates before a handler runs.
- Because stdout carries the JSON-RPC stream, all logging must go to stderr. Use `console.error`, never `console.log`.
