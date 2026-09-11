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
  // ── Task assignments ──────────────────────────────────────────────────────
  list_task_assignments: {
    description:
      'List the tasks assigned to a project — the valid task_id values for logging time against it, with their billable and hourly-rate defaults. Use this, not list_tasks, to resolve the task_id for create_time_entry',
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
  // ── Timesheet writes ──────────────────────────────────────────────────────
  create_time_entry: {
    description:
      'Record a time entry on a Harvest timesheet — defaults to your own (the authenticated user) unless user_id is passed. ' +
      'Requires project_id, task_id and spent_date. task_id must be a task ASSIGNED to that project: resolve it with list_task_assignments, not list_tasks. ' +
      'Supply hours for a duration-tracking account, or started_time/ended_time for a start-and-end-time account — never both. ' +
      'Omitting the duration starts a running timer rather than logging a completed entry',
    enabled: true,
  },
  update_time_entry: {
    description:
      'Update an existing time entry — its project, task, date, duration or notes. Only the fields you pass are changed',
    enabled: true,
  },
  delete_time_entry: {
    description:
      'Permanently delete a time entry. Harvest will refuse if the entry has been invoiced or approved',
    enabled: true,
  },
  restart_time_entry: {
    description:
      'Restart a stopped time entry, resuming its timer. Harvest only allows this for entries spent today',
    enabled: true,
  },
  stop_time_entry: {
    description: 'Stop a running time entry, fixing its duration at the elapsed time',
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
  // ── Forecast: scheduled allocations ───────────────────────────────────────
  forecast__test_connection: {
    description:
      'Test the Forecast API connection and confirm which Forecast account the credentials resolve to. Use this first if any other forecast__ tool fails, to tell a bad ForecastAccountID apart from a bad token',
    enabled: true,
  },
  forecast__list_assignments: {
    description:
      'List scheduled Forecast assignments over a date range \u2014 the source of truth for who is booked on what, and for time off. ' +
      'ALLOCATION IS SECONDS PER WORKING DAY, not total seconds for the span. Hours for a person in a week are ' +
      'allocation / 3600 x (that person\u2019s working days, from forecast__list_people.working_days, that fall inside start_date..end_date, which is inclusive at both ends). ' +
      'A null allocation means A FULL DAY, not zero \u2014 substitute that person\u2019s default daily capacity (weekly_capacity / number of working days). ' +
      'Most time-off rows come back with a null allocation, so treating null as zero silently erases PTO and overstates available capacity. ' +
      '`person_id` is a Forecast person id, not a Harvest user id \u2014 join through forecast__list_people.harvest_user_id. ' +
      'A row with `placeholder_id` set instead of `person_id` is an unnamed/TBD resource. ' +
      'Time off has no separate endpoint: it arrives here as ordinary assignments against designated leave projects, which reduce available hours and must never be counted as demand. ' +
      'Archived records are not filtered out \u2014 read the flag and decide per use.',
    enabled: true,
  },
  forecast__list_people: {
    description:
      'List Forecast people with `weekly_capacity` (seconds), `working_days` (per-weekday booleans), `roles`, `archived`, and `harvest_user_id`. `harvest_user_id` is the join key to Harvest actuals; email is the fallback and matching on name is a last resort',
    enabled: true,
  },
  forecast__list_forecast_projects: {
    description:
      'List Forecast projects with `harvest_id`, `code`, `client_id`, `start_date`, `end_date`, `archived`, `tags`, and `color`. `harvest_id` joins to Harvest projects; `code` joins to the budget calculators. Note these ids differ from Harvest project ids — the Forecast id is what forecast__list_assignments.project_id refers to',
    enabled: true,
  },
  forecast__list_placeholders: {
    description:
      'List Forecast placeholders — unnamed/TBD resources. A placeholder assignment is Forecast already saying a role needs a body, so reconcile contractor recommendations against these rather than duplicating them',
    enabled: true,
  },
  forecast__list_clients: {
    description: 'List Forecast clients — a reference table for labelling project output',
    enabled: true,
  },
  forecast__list_roles: {
    description: 'List Forecast roles and their member person ids — a reference table for labelling people output',
    enabled: true,
  },
  forecast__list_milestones: {
    description:
      'List Forecast milestones, optionally for one project. Milestones are the cleanest available signal for phase boundaries',
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
