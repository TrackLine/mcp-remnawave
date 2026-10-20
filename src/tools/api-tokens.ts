import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerApiTokenTools(
    server: McpServer,
    client: RemnawaveClient,
    readonly: boolean,
) {
    server.tool('api_tokens_list', 'List all API tokens', {}, async () => {
        try {
            return toolResult(await client.getApiTokens());
        } catch (e) {
            return toolError(e);
        }
    });

    if (readonly) return;

    server.tool(
        'api_tokens_create',
        'Create a new API token',
        {
            tokenName: z.string().describe('Token name'),
        },
        async (params) => {
            try {
                return toolResult(await client.createApiToken(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'api_tokens_delete',
        'Delete an API token',
        {
            uuid: z.string().describe('Token UUID to delete'),
        },
        async ({ uuid }) => {
            try {
                await client.deleteApiToken(uuid);
                return toolResult({ success: true, message: `Token ${uuid} deleted` });
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
