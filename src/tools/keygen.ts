import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerKeygenTools(server: McpServer, client: RemnawaveClient) {
    server.tool('keygen_get', 'Generate a new SECRET_KEY for node configuration', {}, async () => {
        try {
            return toolResult(await client.getKeygen());
        } catch (e) {
            return toolError(e);
        }
    });
}
