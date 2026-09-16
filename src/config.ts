export const HARVEST_API_ENDPOINT = 'https://api.harvestapp.com/v2/';
export const FORECAST_API_ENDPOINT = 'https://api.forecastapp.com/';

/**
 * Read a credential from the environment, treating "not really set" as unset.
 *
 * Claude Desktop substitutes `${user_config.x}` placeholders from the bundle
 * manifest into the environment. An optional field the user left blank can
 * arrive as an empty string, as whitespace, or — on some hosts — as the
 * placeholder itself, none of which are usable values. Collapsing all three to
 * `undefined` means the callers' existing "missing credential" errors fire with
 * their real explanation instead of the API rejecting a nonsense header.
 */
function credential(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || /^\$\{.*\}$/.test(value)) return undefined;
  return value;
}

export const HarvestAccountID = credential('HarvestAccountID');
/** Distinct from HarvestAccountID — the numeric id in the Forecast web URL. */
export const ForecastAccountID = credential('ForecastAccountID');
/** One Harvest personal access token authenticates both APIs. */
export const AuthorizationBearer = credential('AuthorizationBearer');

export type ToolsConfig = Record<string, { description: string; enabled: boolean }>;
