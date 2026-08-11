import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
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
  // ── Time entries ──────────────────────────────────────────────────────────
  list_time_entries: {
    description:
      'List time entries, optionally filtered by user, client, project, task, date range, billed state, running state or approval status',
    enabled: true,
  },
  get_time_entry: {
    description: 'Retrieve a specific time entry by ID',
    enabled: true,
  },
  // ── Time reports ──────────────────────────────────────────────────────────
  report_time_clients: {
    description:
      'Time report totalling tracked hours and billable amounts per client over a date range',
    enabled: true,
  },
  report_time_projects: {
    description:
      'Time report totalling tracked hours and billable amounts per project over a date range. Pass include_forecast to also return each project’s scheduled Forecast hours',
    enabled: true,
  },
  report_time_tasks: {
    description:
      'Time report totalling tracked hours and billable amounts per task over a date range',
    enabled: true,
  },
  report_time_team: {
    description:
      'Time report totalling tracked hours and billable amounts per team member over a date range. Pass include_forecast to also return each user’s scheduled Forecast hours',
    enabled: true,
  },
} satisfies Record<string, { description: string; enabled: boolean }>;

function createServer() {
  const server = new McpServer({
    name: 'forecast',
    version: '1.0.0',
    description: 'A MCP server for the Forecast and Harvest APIs',
  });
  registerTools(server, TOOLS_CONFIG);
  return server;
}

const handle = serveStdio(createServer);
console.error('Forecast MCP Server running on stdio');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void handle.close().then(() => process.exit(0));
  });
}
