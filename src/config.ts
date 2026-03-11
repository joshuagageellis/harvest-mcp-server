export const HARVEST_API_ENDPOINT = 'https://api.harvestapp.com/v2/';
export const HarvestAccountID = process.env.HarvestAccountID;
export const AuthorizationBearer = process.env.AuthorizationBearer;

export type ToolsConfig = Record<string, { description: string; enabled: boolean }>;
