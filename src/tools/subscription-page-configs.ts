import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerSubPageConfigTools(
    server: McpServer,
    client: RemnawaveClient,
    readonly: boolean,
) {
    server.tool(
        'sub_page_configs_list',
        'List all subscription page configurations',
        {},
        async () => {
            try {
                return toolResult(await client.getSubscriptionPageConfigs());
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'sub_page_configs_get',
        'Get a subscription page config by UUID',
        {
            uuid: z.string().describe('Config UUID'),
        },
        async ({ uuid }) => {
            try {
                return toolResult(await client.getSubscriptionPageConfig(uuid));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    if (readonly) return;

    server.tool(
        'sub_page_configs_create',
        'Create a subscription page configuration',
        {
            name: z.string().describe('Config name'),
        },
        async (params) => {
            try {
                return toolResult(await client.createSubscriptionPageConfig(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'sub_page_configs_update',
        'Update a subscription page configuration',
        {
            uuid: z.string().describe('Config UUID'),
            name: z.string().optional().describe('New name'),
        },
        async (params) => {
            try {
                return toolResult(await client.updateSubscriptionPageConfig(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'sub_page_configs_delete',
        'Delete a subscription page configuration',
        {
            uuid: z.string().describe('Config UUID'),
        },
        async ({ uuid }) => {
            try {
                await client.deleteSubscriptionPageConfig(uuid);
                return toolResult({ success: true, message: `Config ${uuid} deleted` });
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'sub_page_configs_reorder',
        'Reorder subscription page configurations',
        {
            items: z
                .array(
                    z.object({
                        viewPosition: z.number().describe('Sort position (0-based)'),
                        uuid: z.string().describe('Config UUID'),
                    }),
                )
                .describe('Ordered array of { viewPosition, uuid } objects'),
        },
        async (params) => {
            try {
                return toolResult(await client.reorderSubscriptionPageConfigs(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'sub_page_configs_clone',
        'Clone a subscription page configuration',
        {
            cloneFromUuid: z.string().describe('Config UUID to clone'),
        },
        async (params) => {
            try {
                return toolResult(await client.cloneSubscriptionPageConfig(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
