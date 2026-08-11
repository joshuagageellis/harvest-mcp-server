import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { HARVEST_API_ENDPOINT, HarvestAccountID, AuthorizationBearer } from './config.js';
import type { ToolsConfig } from './config.js';

// ── Shared fetch helper ───────────────────────────────────────────────────────

async function harvestFetch(path: string, params?: Record<string, string>) {
  if (!HarvestAccountID || !AuthorizationBearer) {
    throw new Error(
      'Missing required environment variables: HarvestAccountID and/or AuthorizationBearer',
    );
  }

  const url = new URL(`${HARVEST_API_ENDPOINT}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${AuthorizationBearer}`,
      'Harvest-Account-ID': HarvestAccountID,
      'User-Agent': 'Forecast MCP Server',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Harvest API request failed: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }

  return response.json();
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

// ── Tool registration ─────────────────────────────────────────────────────────

export function registerTools(server: McpServer, config: ToolsConfig) {
  if (config.test_harvest_api.enabled) {
    server.tool(
      'test_harvest_api',
      config.test_harvest_api.description,
      {},
      { readOnlyHint: true },
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
    server.tool(
      'list_projects',
      config.list_projects.description,
      {
        is_active: z.boolean().optional().describe('Filter by active status'),
        client_id: z.number().optional().describe('Filter by client ID'),
        updated_since: z.string().optional().describe('Filter by modification date (ISO 8601)'),
        page: z.number().optional().describe('Page number'),
        per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
      },
      { readOnlyHint: true },
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
    server.tool(
      'get_project',
      config.get_project.description,
      {
        project_id: z.number().describe('The project ID'),
      },
      { readOnlyHint: true },
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
    server.tool(
      'list_tasks',
      config.list_tasks.description,
      {
        is_active: z.boolean().optional().describe('Filter by active status'),
        updated_since: z.string().optional().describe('Filter by modification date (ISO 8601)'),
        page: z.number().optional().describe('Page number (deprecated by Harvest)'),
        per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
      },
      { readOnlyHint: true },
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
    server.tool(
      'get_task',
      config.get_task.description,
      {
        task_id: z.number().describe('The task ID'),
      },
      { readOnlyHint: true },
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
    server.tool(
      'list_users',
      config.list_users.description,
      {
        is_active: z.boolean().optional().describe('Filter by active status'),
        updated_since: z.string().optional().describe('Filter by modification date (ISO 8601)'),
        page: z.number().optional().describe('Page number'),
        per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
      },
      { readOnlyHint: true },
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
    server.tool(
      'get_current_user',
      config.get_current_user.description,
      {},
      { readOnlyHint: true },
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
    server.tool(
      'get_user',
      config.get_user.description,
      {
        user_id: z.number().describe('The user ID'),
      },
      { readOnlyHint: true },
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
    server.tool(
      'list_user_assignments',
      config.list_user_assignments.description,
      {
        project_id: z.number().optional().describe('Filter to a specific project'),
        user_id: z.number().optional().describe('Filter by user ID'),
        is_active: z.boolean().optional().describe('Filter by active status'),
        updated_since: z.string().optional().describe('Filter by modification date (ISO 8601)'),
        page: z.number().optional().describe('Page number'),
        per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
      },
      { readOnlyHint: true },
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
    server.tool(
      'list_time_entries',
      config.list_time_entries.description,
      {
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
      },
      { readOnlyHint: true },
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
    server.tool(
      'get_time_entry',
      config.get_time_entry.description,
      {
        time_entry_id: z.number().describe('The time entry ID'),
      },
      { readOnlyHint: true },
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
    server.tool(
      'report_time_clients',
      config.report_time_clients.description,
      {
        from: z.string().describe('Report on time entries spent on or after this date (YYYY-MM-DD)'),
        to: z.string().describe('Report on time entries spent on or before this date (YYYY-MM-DD). The range cannot exceed 365 days'),
        include_fixed_fee: z.boolean().optional().describe('When true, billable amounts are calculated and included for fixed fee projects'),
        page: z.number().optional().describe('Page number'),
        per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
      },
      { readOnlyHint: true },
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
    server.tool(
      'report_time_projects',
      config.report_time_projects.description,
      {
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
      },
      { readOnlyHint: true },
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
    server.tool(
      'report_time_tasks',
      config.report_time_tasks.description,
      {
        from: z.string().describe('Report on time entries spent on or after this date (YYYY-MM-DD)'),
        to: z.string().describe('Report on time entries spent on or before this date (YYYY-MM-DD). The range cannot exceed 365 days'),
        include_fixed_fee: z.boolean().optional().describe('When true, billable amounts are calculated and included for fixed fee projects'),
        page: z.number().optional().describe('Page number'),
        per_page: z.number().min(1).max(2000).optional().describe('Records per page (max 2000)'),
      },
      { readOnlyHint: true },
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
    server.tool(
      'report_time_team',
      config.report_time_team.description,
      {
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
      },
      { readOnlyHint: true },
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
}
