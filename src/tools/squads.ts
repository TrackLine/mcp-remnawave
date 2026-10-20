import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerSquadTools(server: McpServer, client: RemnawaveClient, readonly: boolean) {
    server.tool('squads_list', 'List all internal squads', {}, async () => {
        try {
            const result = await client.getInternalSquads();
            return toolResult(result);
        } catch (e) {
            return toolError(e);
        }
    });

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
        'Update an internal squad',
        {
            uuid: z.string().describe('Squad UUID'),
            name: z.string().optional().describe('New squad name'),
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
        'Add users to an internal squad',
        {
            squadUuid: z.string().describe('Squad UUID'),
            userUuids: z.array(z.string()).describe('Array of user UUIDs to add'),
        },
        async ({ squadUuid, userUuids }) => {
            try {
                const result = await client.addUsersToSquad(squadUuid, userUuids);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'squads_remove_users',
        'Remove users from an internal squad',
        {
            squadUuid: z.string().describe('Squad UUID'),
            userUuids: z.array(z.string()).describe('Array of user UUIDs to remove'),
        },
        async ({ squadUuid, userUuids }) => {
            try {
                const result = await client.removeUsersFromSquad(squadUuid, userUuids);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
