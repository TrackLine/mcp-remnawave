import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { startHttpServer } from './http.js';
import { createServer } from './server.js';

const config = loadConfig();

if (config.http.enabled) {
    await startHttpServer(config);
    process.stderr.write(
        `MCP HTTP server listening on http://${config.http.host}:${config.http.port}/mcp\n`,
    );
}

const server = createServer(config);
const transport = new StdioServerTransport();

await server.connect(transport);
