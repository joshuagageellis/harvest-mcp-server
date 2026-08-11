import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';

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
  // ── Tasks ─────────────────────────────────────────────────────────────────
  list_tasks: {
    description: 'List all tasks, optionally filtered by active status',
    enabled: true,
  },
  get_task: {
    description: 'Retrieve a specific task by ID',
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

const server = new McpServer({
  name: 'forecast',
  version: '1.0.0',
  description: 'A MCP server for the Forecast and Harvest APIs',
});

registerTools(server, TOOLS_CONFIG);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Forecast MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
