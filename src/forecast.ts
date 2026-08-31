import { z } from 'zod';
import { FORECAST_API_ENDPOINT, ForecastAccountID, AuthorizationBearer } from './config.js';

// ── Shared fetch helper ───────────────────────────────────────────────────────

/**
 * The Forecast API accepts the same Harvest personal access token; only the base
 * URL and the account header differ. It is stable in practice but is not
 * officially documented or supported, so every response is validated against a
 * pinned schema below and a shape change fails loudly rather than silently
 * returning partial data.
 */
async function forecastFetch(path: string, params?: Record<string, string>) {
  if (!ForecastAccountID || !AuthorizationBearer) {
    throw new Error(
      'Missing required environment variables: ForecastAccountID and/or AuthorizationBearer. ' +
        'ForecastAccountID is distinct from HarvestAccountID — it is the numeric id in the ' +
        'Forecast web URL (https://forecastapp.com/<ForecastAccountID>/schedule/team).',
    );
  }

  const url = new URL(`${FORECAST_API_ENDPOINT}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${AuthorizationBearer}`,
      'Forecast-Account-Id': ForecastAccountID,
      'User-Agent': 'Forecast MCP Server',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Forecast API request failed: ${response.status} ${response.statusText}\n${errorText}`,
    );
  }

  return response.json();
}

/**
 * Validates a Forecast response against its pinned schema. Because the API is
 * undocumented, a mismatch means the shape moved underneath us — throw instead
 * of handing back a partially understood payload that reads as authoritative.
 */
function parsePinned<T>(schema: z.ZodType<T>, path: string, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `Forecast API response shape changed for GET /${path} — refusing to return partial data. ` +
        `Update the pinned schema in src/forecast.ts.\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

// ── Pinned response schemas ───────────────────────────────────────────────────
//
// Every object uses z.looseObject so fields Forecast adds later pass through
// untouched. Only the fields callers actually depend on are required; a wrong
// answer would come from those going missing, not from the incidental ones.

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();

const AssignmentSchema = z.looseObject({
  id: z.number(),
  project_id: z.number(),
  /** Forecast person id — NOT the Harvest user id. Join via people.harvest_user_id. */
  person_id: nullableNumber,
  /** Set instead of person_id for unnamed/TBD resources. */
  placeholder_id: nullableNumber,
  /** Inclusive span. */
  start_date: z.string(),
  end_date: z.string(),
  /**
   * Seconds per working DAY, not total seconds for the span. Null means a full
   * day (the person's default daily capacity), NOT zero — most time-off rows
   * come back null, so reading null as zero silently erases PTO.
   */
  allocation: nullableNumber,
  notes: nullableString.optional(),
  // The live API returns repeated_assignment_set_id; the ...set spelling is
  // accepted too in case it varies by account. Neither is load-bearing.
  repeated_assignment_set_id: nullableNumber.optional(),
  repeated_assignment_set: nullableNumber.optional(),
});

const PersonSchema = z.looseObject({
  id: z.number(),
  first_name: nullableString,
  last_name: nullableString,
  email: nullableString,
  roles: z.array(z.string()),
  /** Seconds per week. */
  weekly_capacity: nullableNumber,
  /** Per-weekday booleans; drives the working-days count in an allocation span. */
  working_days: z.looseObject({
    monday: z.boolean(),
    tuesday: z.boolean(),
    wednesday: z.boolean(),
    thursday: z.boolean(),
    friday: z.boolean(),
    saturday: z.boolean().optional(),
    sunday: z.boolean().optional(),
  }),
  archived: z.boolean(),
  /** The join key to Harvest actuals. */
  harvest_user_id: nullableNumber,
});

const ForecastProjectSchema = z.looseObject({
  id: z.number(),
  name: nullableString,
  code: nullableString,
  /** The join to Harvest projects. */
  harvest_id: nullableNumber,
  client_id: nullableNumber,
  start_date: nullableString,
  end_date: nullableString,
  archived: z.boolean(),
  tags: z.array(z.string()),
  color: nullableString,
});

const PlaceholderSchema = z.looseObject({
  id: z.number(),
  name: nullableString,
  roles: z.array(z.string()),
  archived: z.boolean(),
});

const ClientSchema = z.looseObject({
  id: z.number(),
  name: nullableString,
  harvest_id: nullableNumber,
  archived: z.boolean(),
});

const RoleSchema = z.looseObject({
  id: z.number(),
  name: nullableString,
  person_ids: z.array(z.number()),
});

const MilestoneSchema = z.looseObject({
  id: z.number(),
  name: nullableString,
  date: z.string(),
  project_id: z.number(),
});

// ── Typed endpoint wrappers ───────────────────────────────────────────────────

function envelope<K extends string, T>(key: K, item: z.ZodType<T>) {
  return z.looseObject({ [key]: z.array(item) } as Record<K, z.ZodArray<z.ZodType<T>>>);
}

async function getList<T>(path: string, key: string, item: z.ZodType<T>, params?: Record<string, string>) {
  const data = await forecastFetch(path, params);
  return parsePinned(envelope(key, item), path, data);
}

export function listAssignments(params: Record<string, string>) {
  return getList('assignments', 'assignments', AssignmentSchema, params);
}

export function listPeople() {
  return getList('people', 'people', PersonSchema);
}

export function listForecastProjects() {
  return getList('projects', 'projects', ForecastProjectSchema);
}

export function listPlaceholders() {
  return getList('placeholders', 'placeholders', PlaceholderSchema);
}

export function listClients() {
  return getList('clients', 'clients', ClientSchema);
}

export function listRoles() {
  return getList('roles', 'roles', RoleSchema);
}

export function listMilestones(params: Record<string, string>) {
  return getList('milestones', 'milestones', MilestoneSchema, params);
}

export function whoami() {
  return forecastFetch('whoami');
}
