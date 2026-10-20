import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerSquadTools(
    server: McpServer,
    client: RemnawaveClient,
    readonly: boolean,
) {
    server.tool(
        'squads_list',
        'List all internal squads',
        {},
        async () => {
            try {
                const result = await client.getInternalSquads();
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'squads_accessible_nodes',
        'Get nodes accessible to a specific squad',
        {
            uuid: z.string().describe('Squad UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.getSquadAccessibleNodes(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    if (readonly) return;

    server.tool(
        'squads_create',
        'Create a new internal squad',
        {
            name: z.string().describe('Squad name'),
            inbounds: z.array(z.string()).describe('Array of inbound UUIDs'),
        },
        async (params) => {
            try {
                const result = await client.createInternalSquad(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'squads_update',
        'Update an internal squad. `inbounds` REPLACES the squad\'s inbound set: fetch the current list with squads_list and send the full array.',
        {
            uuid: z.string().describe('Squad UUID'),
            name: z.string().optional().describe('New squad name'),
            inbounds: z.array(z.string()).optional().describe('Full array of inbound UUIDs (replaces existing)'),
        },
        async (params) => {
            try {
                const result = await client.updateInternalSquad(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'squads_delete',
        'Delete an internal squad',
        {
            uuid: z.string().describe('Squad UUID to delete'),
        },
        async ({ uuid }) => {
            try {
                await client.deleteInternalSquad(uuid);
                return toolResult({
                    success: true,
                    message: `Squad ${uuid} deleted`,
                });
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'squads_add_users',
        'Add specific users (by numeric user ID) to an internal squad',
        {
            squadUuid: z.string().describe('Squad UUID'),
            userIds: z
                .array(z.number().int())
                .min(1)
                .describe('Array of numeric user IDs to add (max 1000)'),
        },
        async ({ squadUuid, userIds }) => {
            try {
                const result = await client.addUsersToSquad(
                    squadUuid,
                    userIds,
                );
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'squads_remove_users',
        'Remove specific users (by numeric user ID) from an internal squad',
        {
            squadUuid: z.string().describe('Squad UUID'),
            userIds: z
                .array(z.number().int())
                .min(1)
                .describe('Array of numeric user IDs to remove (max 1000)'),
        },
        async ({ squadUuid, userIds }) => {
            try {
                const result = await client.removeUsersFromSquad(
                    squadUuid,
                    userIds,
                );
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'squads_add_all_users',
        'Add ALL users to an internal squad',
        { squadUuid: z.string().describe('Squad UUID') },
        async ({ squadUuid }) => {
            try { return toolResult(await client.addAllUsersToSquad(squadUuid)); } catch (e) { return toolError(e); }
        },
    );

    server.tool(
        'squads_remove_all_users',
        'Remove ALL users from an internal squad',
        { squadUuid: z.string().describe('Squad UUID') },
        async ({ squadUuid }) => {
            try { return toolResult(await client.removeAllUsersFromSquad(squadUuid)); } catch (e) { return toolError(e); }
        },
    );
}
