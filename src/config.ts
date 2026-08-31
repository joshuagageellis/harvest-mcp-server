export const HARVEST_API_ENDPOINT = 'https://api.harvestapp.com/v2/';
export const FORECAST_API_ENDPOINT = 'https://api.forecastapp.com/';

export const HarvestAccountID = process.env.HarvestAccountID;
/** Distinct from HarvestAccountID — the numeric id in the Forecast web URL. */
export const ForecastAccountID = process.env.ForecastAccountID;
/** One Harvest personal access token authenticates both APIs. */
export const AuthorizationBearer = process.env.AuthorizationBearer;

export type ToolsConfig = Record<string, { description: string; enabled: boolean }>;
