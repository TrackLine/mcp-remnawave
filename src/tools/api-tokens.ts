import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerApiTokenTools(server: McpServer, client: RemnawaveClient, readonly: boolean) {
    server.tool('api_tokens_list', 'List all API tokens', {}, async () => {
        try { return toolResult(await client.getApiTokens()); } catch (e) { return toolError(e); }
    });

    if (readonly) return;

    server.tool('api_tokens_create', 'Create a new API token. The panel forbids creating a token with an API key; it needs an admin JWT.', {
        name: z.string(),
        expiresInDays: z.number().describe('Days until the token expires'),
        scopes: z.array(z.string()).optional().describe('Token scopes. Omit for the panel default of all scopes'),
    }, async ({ name, expiresInDays, scopes }) => {
        try {
            return toolResult(await client.createApiToken({
                name,
                expiresInDays,
                ...(scopes !== undefined ? { scopes } : {}),
            }));
        } catch (e) { return toolError(e); }
    });

    server.tool('api_tokens_delete', 'Delete an API token', {
        uuid: z.string().describe('Token UUID to delete'),
    }, async ({ uuid }) => {
        try { await client.deleteApiToken(uuid); return toolResult({ success: true, message: `Token ${uuid} deleted` }); } catch (e) { return toolError(e); }
    });
}
