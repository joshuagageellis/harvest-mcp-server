# Forecast/Harvest MCP Server

An MCP (Model Context Protocol) server that exposes Harvest API data to AI assistants such as Claude. It provides read access to projects, users, and user assignments, with write operations available but disabled by default.

## Prerequisites

- Node.js 16 or later
- Docker (for containerised deployment)
- A Harvest account with API credentials

## Environment Variables

| Variable              | Description                        |
| --------------------- | ---------------------------------- |
| `HarvestAccountID`    | Your Harvest account ID            |
| `AuthorizationBearer` | Your Harvest personal access token |

## Building Locally

Install dependencies and compile the TypeScript source:

```bash
npm install
npm run build
```

This outputs a bundled `build/index.js` using esbuild.

To build the Docker image, run the provided script:

```bash
./docker-build.sh
```

This will remove any existing `forecast-mcp` container and image, run `npm run build`, then build a fresh Docker image tagged `forecast-mcp`.

You can also build the image directly:

```bash
npm run build
docker build -t forecast-mcp .
```

## Available Tools

All tools are read-only by default. Write operations (create, update, delete) exist in the configuration but are not supported at this time. You can enable or disable individual tools in `src/index.ts` by toggling the `enabled` flag:

```ts
export const TOOLS_CONFIG = {
  // ── Harvest connection ────────────────────────────────────────────────────
  test_harvest_api: {
    description:
      'Test the Harvest API connection by fetching the current user details',
    enabled: true,
  },
  // ── Projects ──────────────────────────────────────────────────────────────
  list_projects: {
    description:
      'List all projects, optionally filtered by active status or client',
    enabled: true,
  },
  get_project: {
    description: 'Retrieve a specific project by ID',
    enabled: true,
  },
  // ── Users ─────────────────────────────────────────────────────────────────
  list_users: {
    description: 'List all users, optionally filtered by active status',
    enabled: true,
  },
  get_current_user: {
    description: 'Retrieve the currently authenticated user',
    enabled: true,
  },
  get_user: {
    description: 'Retrieve a specific user by ID',
    enabled: true,
  },
  // ── User assignments ──────────────────────────────────────────────────────
  list_user_assignments: {
    description:
      'List user assignments across all projects or for a specific project',
    enabled: true,
  },
} satisfies Record<string, { description: string; enabled: boolean }>;
```

After changing the configuration, rebuild the project and Docker image for the changes to take effect.

## Claude Desktop Configuration

To use the MCP Server in Claude Desktop, add the following to your configuration. See: https://modelcontextprotocol.io/docs/develop/connect-local-servers

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

Your Harvest account ID and personal access token can be found at https://id.getharvest.com/developers. You must have a `manager` or `administrator` role in Harvest to use the MCP Server.
