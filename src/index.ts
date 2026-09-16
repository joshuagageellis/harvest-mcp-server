import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { registerTools } from './tools.js';
import { TOOLS_CONFIG } from './tools-config.js';

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
