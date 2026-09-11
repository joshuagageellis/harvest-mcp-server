import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { HARVEST_API_ENDPOINT, HarvestAccountID, AuthorizationBearer } from './config.js';
import type { ToolsConfig } from './config.js';
import {
  listAssignments,
  listClients,
  listForecastProjects,
  listMilestones,
  listPeople,
  listPlaceholders,
  listRoles,
  whoami,
} from './forecast.js';

// ── Shared fetch helper ───────────────────────────────────────────────────────

type HarvestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function harvestRequest(
  method: HarvestMethod,
  path: string,
  options: { params?: Record<string, string>; body?: unknown } = {},
) {
  if (!HarvestAccountID || !AuthorizationBearer) {
    throw new Error(
      'Missing required environment variables: HarvestAccountID and/or AuthorizationBearer',
    );
  }

  const url = new URL(`${HARVEST_API_ENDPOINT}${path}`);
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${AuthorizationBearer}`,
      'Harvest-Account-ID': HarvestAccountID,
      'User-Agent': 'Forecast MCP Server',
      'Content-Type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Harvest API request failed: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }

  // Harvest's time-entry DELETE actually returns 200 with the full deleted
  // entry, despite the docs describing an empty body — so the body is parsed
  // and returned when there is one. The empty case is still handled: .json()
  // on an empty body throws, which would fail a write that in fact succeeded.
  const text = await response.text();
  if (!text) return { success: true, status: response.status };
  return JSON.parse(text);
}

function harvestFetch(path: string, params?: Record<string, string>) {
  return harvestRequest('GET', path, { params });
}

/** Drops undefined keys so an omitted optional never overwrites a Harvest field. */
function body(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(error: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          { success: false, error: error instanceof Error ? error.message : String(error) },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ── Tool registration ─────────────────────────────────────────────────────────

export function registerTools(server: McpServer, config: ToolsConfig) {
  if (config.test_harvest_api.enabled) {
    server.registerTool(
      'test_harvest_api',
      {
        description: config.test_harvest_api.description,
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          const data = await harvestFetch('users/me');
          return ok({ success: true, user: data });
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.list_projects.enabled) {
    server.registerTool(
      'list_projects',
      {
        description: config.list_projects.description,
        inputSchema: z.object({
          is_active: z.boolean().optional().describe('Filter by active status'),
          client_id: z.number().optional().describe('Filter by client ID'),
          updated_since: z.string().optional().describe('Filter by modification date (ISO 8601)'),
          page: z.number().optional().describe('Page number'),
          per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ is_active, client_id, updated_since, page, per_page }) => {
        try {
          const params: Record<string, string> = {};
          if (is_active !== undefined) params.is_active = String(is_active);
          if (client_id !== undefined) params.client_id = String(client_id);
          if (updated_since !== undefined) params.updated_since = updated_since;
          if (page !== undefined) params.page = String(page);
          if (per_page !== undefined) params.per_page = String(per_page);
          return ok(await harvestFetch('projects', params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.get_project.enabled) {
    server.registerTool(
      'get_project',
      {
        description: config.get_project.description,
        inputSchema: z.object({
          project_id: z.number().describe('The project ID'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ project_id }) => {
        try {
          return ok(await harvestFetch(`projects/${project_id}`));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.list_tasks.enabled) {
    server.registerTool(
      'list_tasks',
      {
        description: config.list_tasks.description,
        inputSchema: z.object({
          is_active: z.boolean().optional().describe('Filter by active status'),
          updated_since: z.string().optional().describe('Filter by modification date (ISO 8601)'),
          page: z.number().optional().describe('Page number (deprecated by Harvest)'),
          per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ is_active, updated_since, page, per_page }) => {
        try {
          const params: Record<string, string> = {};
          if (is_active !== undefined) params.is_active = String(is_active);
          if (updated_since !== undefined) params.updated_since = updated_since;
          if (page !== undefined) params.page = String(page);
          if (per_page !== undefined) params.per_page = String(per_page);
          return ok(await harvestFetch('tasks', params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.get_task.enabled) {
    server.registerTool(
      'get_task',
      {
        description: config.get_task.description,
        inputSchema: z.object({
          task_id: z.number().describe('The task ID'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ task_id }) => {
        try {
          return ok(await harvestFetch(`tasks/${task_id}`));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.list_users.enabled) {
    server.registerTool(
      'list_users',
      {
        description: config.list_users.description,
        inputSchema: z.object({
          is_active: z.boolean().optional().describe('Filter by active status'),
          updated_since: z.string().optional().describe('Filter by modification date (ISO 8601)'),
          page: z.number().optional().describe('Page number'),
          per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ is_active, updated_since, page, per_page }) => {
        try {
          const params: Record<string, string> = {};
          if (is_active !== undefined) params.is_active = String(is_active);
          if (updated_since !== undefined) params.updated_since = updated_since;
          if (page !== undefined) params.page = String(page);
          if (per_page !== undefined) params.per_page = String(per_page);
          return ok(await harvestFetch('users', params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.get_current_user.enabled) {
    server.registerTool(
      'get_current_user',
      {
        description: config.get_current_user.description,
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          return ok(await harvestFetch('users/me'));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.get_user.enabled) {
    server.registerTool(
      'get_user',
      {
        description: config.get_user.description,
        inputSchema: z.object({
          user_id: z.number().describe('The user ID'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ user_id }) => {
        try {
          return ok(await harvestFetch(`users/${user_id}`));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.list_user_assignments.enabled) {
    server.registerTool(
      'list_user_assignments',
      {
        description: config.list_user_assignments.description,
        inputSchema: z.object({
          project_id: z.number().optional().describe('Filter to a specific project'),
          user_id: z.number().optional().describe('Filter by user ID'),
          is_active: z.boolean().optional().describe('Filter by active status'),
          updated_since: z.string().optional().describe('Filter by modification date (ISO 8601)'),
          page: z.number().optional().describe('Page number'),
          per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ project_id, user_id, is_active, updated_since, page, per_page }) => {
        try {
          const path = project_id
            ? `projects/${project_id}/user_assignments`
            : 'user_assignments';
          const params: Record<string, string> = {};
          if (user_id !== undefined) params.user_id = String(user_id);
          if (is_active !== undefined) params.is_active = String(is_active);
          if (updated_since !== undefined) params.updated_since = updated_since;
          if (page !== undefined) params.page = String(page);
          if (per_page !== undefined) params.per_page = String(per_page);
          return ok(await harvestFetch(path, params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.list_time_entries.enabled) {
    server.registerTool(
      'list_time_entries',
      {
        description: config.list_time_entries.description,
        inputSchema: z.object({
          user_id: z.number().optional().describe('Filter by user ID'),
          client_id: z.number().optional().describe('Filter by client ID'),
          project_id: z.number().optional().describe('Filter by project ID'),
          task_id: z.number().optional().describe('Filter by task ID'),
          external_reference_id: z.string().optional().describe('Filter by external reference ID'),
          is_billed: z.boolean().optional().describe('Pass true for invoiced entries only, false for uninvoiced entries'),
          is_running: z.boolean().optional().describe('Pass true for running entries only, false for non-running entries'),
          approval_status: z
            .enum(['unsubmitted', 'submitted', 'approved'])
            .optional()
            .describe('Filter by approval status'),
          from: z.string().optional().describe('Only entries with a spent_date on or after this date (YYYY-MM-DD)'),
          to: z.string().optional().describe('Only entries with a spent_date on or before this date (YYYY-MM-DD)'),
          updated_since: z.string().optional().describe('Filter by modification date (ISO 8601)'),
          page: z.number().optional().describe('Page number'),
          per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
        }),
        annotations: { readOnlyHint: true },
      },
      async (args) => {
        try {
          const params: Record<string, string> = {};
          for (const [key, value] of Object.entries(args)) {
            if (value !== undefined) params[key] = String(value);
          }
          return ok(await harvestFetch('time_entries', params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.get_time_entry.enabled) {
    server.registerTool(
      'get_time_entry',
      {
        description: config.get_time_entry.description,
        inputSchema: z.object({
          time_entry_id: z.number().describe('The time entry ID'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ time_entry_id }) => {
        try {
          return ok(await harvestFetch(`time_entries/${time_entry_id}`));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.report_time_clients.enabled) {
    server.registerTool(
      'report_time_clients',
      {
        description: config.report_time_clients.description,
        inputSchema: z.object({
          from: z.string().describe('Report on time entries spent on or after this date (YYYY-MM-DD)'),
          to: z.string().describe('Report on time entries spent on or before this date (YYYY-MM-DD). The range cannot exceed 365 days'),
          include_fixed_fee: z.boolean().optional().describe('When true, billable amounts are calculated and included for fixed fee projects'),
          page: z.number().optional().describe('Page number'),
          per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ from, to, include_fixed_fee, page, per_page }) => {
        try {
          const params: Record<string, string> = { from, to };
          if (include_fixed_fee !== undefined) params.include_fixed_fee = String(include_fixed_fee);
          if (page !== undefined) params.page = String(page);
          if (per_page !== undefined) params.per_page = String(per_page);
          return ok(await harvestFetch('reports/time/clients', params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.report_time_projects.enabled) {
    server.registerTool(
      'report_time_projects',
      {
        description: config.report_time_projects.description,
        inputSchema: z.object({
          from: z.string().describe('Report on time entries spent on or after this date (YYYY-MM-DD)'),
          to: z.string().describe('Report on time entries spent on or before this date (YYYY-MM-DD). The range cannot exceed 365 days'),
          include_fixed_fee: z.boolean().optional().describe('When true, billable amounts are calculated and included for fixed fee projects'),
          include_forecast: z
            .boolean()
            .optional()
            .describe(
              'When true, each result gains a scheduled_hours field holding the scheduled Forecast hours for the project over the timeframe — use this to retrieve scheduled forecast hours alongside tracked hours. Requires the account to be connected to Forecast; null when the project has no Forecast assignments',
            ),
          page: z.number().optional().describe('Page number'),
          per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ from, to, include_fixed_fee, include_forecast, page, per_page }) => {
        try {
          const params: Record<string, string> = { from, to };
          if (include_fixed_fee !== undefined) params.include_fixed_fee = String(include_fixed_fee);
          if (include_forecast !== undefined) params.include_forecast = String(include_forecast);
          if (page !== undefined) params.page = String(page);
          if (per_page !== undefined) params.per_page = String(per_page);
          return ok(await harvestFetch('reports/time/projects', params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.report_time_tasks.enabled) {
    server.registerTool(
      'report_time_tasks',
      {
        description: config.report_time_tasks.description,
        inputSchema: z.object({
          from: z.string().describe('Report on time entries spent on or after this date (YYYY-MM-DD)'),
          to: z.string().describe('Report on time entries spent on or before this date (YYYY-MM-DD). The range cannot exceed 365 days'),
          include_fixed_fee: z.boolean().optional().describe('When true, billable amounts are calculated and included for fixed fee projects'),
          page: z.number().optional().describe('Page number'),
          per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ from, to, include_fixed_fee, page, per_page }) => {
        try {
          const params: Record<string, string> = { from, to };
          if (include_fixed_fee !== undefined) params.include_fixed_fee = String(include_fixed_fee);
          if (page !== undefined) params.page = String(page);
          if (per_page !== undefined) params.per_page = String(per_page);
          return ok(await harvestFetch('reports/time/tasks', params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.report_time_team.enabled) {
    server.registerTool(
      'report_time_team',
      {
        description: config.report_time_team.description,
        inputSchema: z.object({
          from: z.string().describe('Report on time entries spent on or after this date (YYYY-MM-DD)'),
          to: z.string().describe('Report on time entries spent on or before this date (YYYY-MM-DD). The range cannot exceed 365 days'),
          include_fixed_fee: z.boolean().optional().describe('When true, billable amounts are calculated and included for fixed fee projects'),
          include_forecast: z
            .boolean()
            .optional()
            .describe(
              'When true, each result gains a scheduled_hours field holding the user’s scheduled Forecast hours over the timeframe — use this to retrieve scheduled forecast hours alongside tracked hours. Requires the account to be connected to Forecast; null when the user has no Forecast assignments',
            ),
          page: z.number().optional().describe('Page number'),
          per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ from, to, include_fixed_fee, include_forecast, page, per_page }) => {
        try {
          const params: Record<string, string> = { from, to };
          if (include_fixed_fee !== undefined) params.include_fixed_fee = String(include_fixed_fee);
          if (include_forecast !== undefined) params.include_forecast = String(include_forecast);
          if (page !== undefined) params.page = String(page);
          if (per_page !== undefined) params.per_page = String(per_page);
          return ok(await harvestFetch('reports/time/team', params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  // ── Forecast ────────────────────────────────────────────────────────────────
  //
  // Harvest is what was actually burned; Forecast is what is scheduled. These
  // tools hit https://api.forecastapp.com with the same personal access token
  // and return raw seconds — conversion to hours is left to the caller so the
  // numbers can be reconciled against Forecast's own UI.

  if (config.forecast__test_connection.enabled) {
    server.registerTool(
      'forecast__test_connection',
      {
        description: config.forecast__test_connection.description,
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          return ok({ success: true, whoami: await whoami() });
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.forecast__list_assignments.enabled) {
    server.registerTool(
      'forecast__list_assignments',
      {
        description: config.forecast__list_assignments.description,
        inputSchema: z.object({
          start_date: z
            .string()
            .regex(DATE, 'Must be YYYY-MM-DD')
            .describe('Start of the window to pull assignments for (YYYY-MM-DD). Required — the unbounded response is too large to be usable'),
          end_date: z
            .string()
            .regex(DATE, 'Must be YYYY-MM-DD')
            .describe('End of the window to pull assignments for (YYYY-MM-DD), inclusive. Required — the unbounded response is too large to be usable'),
          project_id: z.number().optional().describe('Filter to a Forecast project id (not the Harvest project id — see forecast__list_forecast_projects.harvest_id)'),
          person_id: z.number().optional().describe('Filter to a Forecast person id (not the Harvest user id — see forecast__list_people.harvest_user_id)'),
          state: z.string().optional().describe('Filter by assignment state, e.g. "active"'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ start_date, end_date, project_id, person_id, state }) => {
        try {
          if (start_date > end_date) {
            throw new Error(
              `start_date (${start_date}) must be on or before end_date (${end_date})`,
            );
          }
          const params: Record<string, string> = { start_date, end_date };
          if (project_id !== undefined) params.project_id = String(project_id);
          if (person_id !== undefined) params.person_id = String(person_id);
          if (state !== undefined) params.state = state;
          return ok(await listAssignments(params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.forecast__list_people.enabled) {
    server.registerTool(
      'forecast__list_people',
      {
        description: config.forecast__list_people.description,
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          return ok(await listPeople());
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.forecast__list_forecast_projects.enabled) {
    server.registerTool(
      'forecast__list_forecast_projects',
      {
        description: config.forecast__list_forecast_projects.description,
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          return ok(await listForecastProjects());
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.forecast__list_placeholders.enabled) {
    server.registerTool(
      'forecast__list_placeholders',
      {
        description: config.forecast__list_placeholders.description,
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          return ok(await listPlaceholders());
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.forecast__list_clients.enabled) {
    server.registerTool(
      'forecast__list_clients',
      {
        description: config.forecast__list_clients.description,
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          return ok(await listClients());
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.forecast__list_roles.enabled) {
    server.registerTool(
      'forecast__list_roles',
      {
        description: config.forecast__list_roles.description,
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          return ok(await listRoles());
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.forecast__list_milestones.enabled) {
    server.registerTool(
      'forecast__list_milestones',
      {
        description: config.forecast__list_milestones.description,
        inputSchema: z.object({
          project_id: z.number().optional().describe('Filter to a Forecast project id. Omit to return every milestone on the account'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ project_id }) => {
        try {
          const params: Record<string, string> = {};
          if (project_id !== undefined) params.project_id = String(project_id);
          return ok(await listMilestones(params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  // ── Harvest: task assignments ───────────────────────────────────────────────
  //
  // A project only accepts time against the tasks assigned to it, and the
  // task_assignment carries the billable/hourly-rate defaults. Resolve the
  // task_id here before calling create_time_entry — a plain list_tasks id may
  // not be assigned to the project and the write will be rejected.

  if (config.list_task_assignments.enabled) {
    server.registerTool(
      'list_task_assignments',
      {
        description: config.list_task_assignments.description,
        inputSchema: z.object({
          project_id: z
            .number()
            .optional()
            .describe('Filter to a specific project. Omit to return task assignments across every project'),
          is_active: z.boolean().optional().describe('Filter by active status'),
          updated_since: z.string().optional().describe('Filter by modification date (ISO 8601)'),
          page: z.number().optional().describe('Page number'),
          per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ project_id, is_active, updated_since, page, per_page }) => {
        try {
          const path = project_id
            ? `projects/${project_id}/task_assignments`
            : 'task_assignments';
          const params: Record<string, string> = {};
          if (is_active !== undefined) params.is_active = String(is_active);
          if (updated_since !== undefined) params.updated_since = updated_since;
          if (page !== undefined) params.page = String(page);
          if (per_page !== undefined) params.per_page = String(per_page);
          return ok(await harvestFetch(path, params));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  // ── Harvest: timesheet writes ───────────────────────────────────────────────
  //
  // Everything above reads. These four write to a real timesheet, so they are
  // registered without readOnlyHint and the host will prompt before each one.
  //
  // Harvest accounts are configured to track time EITHER by duration OR by
  // start/end time, and the create endpoint takes a different shape for each —
  // `hours` for a duration account, `started_time`/`ended_time` for a
  // start-and-end-time account. get_account_settings-style info is not exposed
  // here, so if a create is rejected with a 422 mentioning the wrong field,
  // retry with the other shape rather than assuming the entry failed for
  // another reason.

  if (config.create_time_entry.enabled) {
    server.registerTool(
      'create_time_entry',
      {
        description: config.create_time_entry.description,
        inputSchema: z.object({
          project_id: z.number().describe('The project to log against (a Harvest project id — see list_projects)'),
          task_id: z
            .number()
            .describe('The task to log against. Must be a task ASSIGNED to this project — resolve it with list_task_assignments, not list_tasks'),
          spent_date: z
            .string()
            .regex(DATE, 'Must be YYYY-MM-DD')
            .describe('The date the time was spent (YYYY-MM-DD)'),
          hours: z
            .number()
            .positive()
            .optional()
            .describe('Duration in decimal hours, e.g. 1.5 for 90 minutes. For a duration-tracking account. Omit to start a running timer'),
          started_time: z
            .string()
            .optional()
            .describe('Start time, e.g. "8:00am". For a start-and-end-time account. Omit to start a running timer'),
          ended_time: z
            .string()
            .optional()
            .describe('End time, e.g. "3:00pm". For a start-and-end-time account. Omit to leave the timer running'),
          notes: z.string().optional().describe('Notes describing the work — what appears on the timesheet line'),
          user_id: z
            .number()
            .optional()
            .describe('Log on behalf of another user. Omit to log to your own timesheet (the authenticated user); passing someone else requires admin or manager permission'),
          external_reference: z
            .object({
              id: z.string().describe('The id of the linked record in the external system'),
              group_id: z.string().describe('The id of the group the linked record belongs to'),
              account_id: z.string().optional().describe('The id of the external account'),
              permalink: z.string().describe('A URL back to the linked record'),
            })
            .optional()
            .describe('Link the entry to a record in another system'),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async ({ project_id, task_id, spent_date, hours, started_time, ended_time, notes, user_id, external_reference }) => {
        try {
          // Harvest rejects the mixed shape with an opaque 422; say why up front.
          if (hours !== undefined && (started_time !== undefined || ended_time !== undefined)) {
            throw new Error(
              'Pass either hours (duration-tracking account) or started_time/ended_time ' +
                '(start-and-end-time account), not both.',
            );
          }
          if (ended_time !== undefined && started_time === undefined) {
            throw new Error('ended_time requires started_time.');
          }
          return ok(
            await harvestRequest('POST', 'time_entries', {
              body: body({
                project_id,
                task_id,
                spent_date,
                hours,
                started_time,
                ended_time,
                notes,
                user_id,
                external_reference,
              }),
            }),
          );
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.update_time_entry.enabled) {
    server.registerTool(
      'update_time_entry',
      {
        description: config.update_time_entry.description,
        inputSchema: z.object({
          time_entry_id: z.number().describe('The time entry to update — see list_time_entries'),
          project_id: z.number().optional().describe('Move the entry to a different project'),
          task_id: z
            .number()
            .optional()
            .describe('Move the entry to a different task. Must be a task assigned to the entry’s project'),
          spent_date: z
            .string()
            .regex(DATE, 'Must be YYYY-MM-DD')
            .optional()
            .describe('Change the date the time was spent (YYYY-MM-DD)'),
          hours: z.number().positive().optional().describe('Change the duration, in decimal hours'),
          started_time: z.string().optional().describe('Change the start time, e.g. "8:00am"'),
          ended_time: z.string().optional().describe('Change the end time, e.g. "3:00pm"'),
          notes: z.string().optional().describe('Replace the notes on the entry'),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      },
      async ({ time_entry_id, ...fields }) => {
        try {
          const payload = body(fields);
          if (Object.keys(payload).length === 0) {
            throw new Error('Pass at least one field to change.');
          }
          return ok(
            await harvestRequest('PATCH', `time_entries/${time_entry_id}`, { body: payload }),
          );
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.delete_time_entry.enabled) {
    server.registerTool(
      'delete_time_entry',
      {
        description: config.delete_time_entry.description,
        inputSchema: z.object({
          time_entry_id: z.number().describe('The time entry to delete — see list_time_entries'),
        }),
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async ({ time_entry_id }) => {
        try {
          return ok(await harvestRequest('DELETE', `time_entries/${time_entry_id}`));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.restart_time_entry.enabled) {
    server.registerTool(
      'restart_time_entry',
      {
        description: config.restart_time_entry.description,
        inputSchema: z.object({
          time_entry_id: z.number().describe('The stopped time entry to restart'),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      },
      async ({ time_entry_id }) => {
        try {
          return ok(await harvestRequest('PATCH', `time_entries/${time_entry_id}/restart`));
        } catch (error) {
          return err(error);
        }
      },
    );
  }

  if (config.stop_time_entry.enabled) {
    server.registerTool(
      'stop_time_entry',
      {
        description: config.stop_time_entry.description,
        inputSchema: z.object({
          time_entry_id: z.number().describe('The running time entry to stop'),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      },
      async ({ time_entry_id }) => {
        try {
          return ok(await harvestRequest('PATCH', `time_entries/${time_entry_id}/stop`));
        } catch (error) {
          return err(error);
        }
      },
    );
  }
}
