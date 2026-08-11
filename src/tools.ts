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
}
