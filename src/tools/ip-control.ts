import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerIpControlTools(
    server: McpServer,
    client: RemnawaveClient,
    readonly: boolean,
) {
    server.tool(
        'ip_control_get_fetch_ips_result',
        'Get result of an IP fetch job',
        {
            jobId: z.string().describe('Job ID from fetch_ips'),
        },
        async ({ jobId }) => {
            try {
                return toolResult(await client.getFetchIpsResult(jobId));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'ip_control_get_fetch_users_ips_result',
        'Get result of a users IP fetch job',
        {
            jobId: z.string().describe('Job ID from fetch_users_ips'),
        },
        async ({ jobId }) => {
            try {
                return toolResult(await client.getFetchUsersIpsResult(jobId));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    if (readonly) return;

    server.tool(
        'ip_control_fetch_ips',
        'Fetch active IPs for a user (async job)',
        {
            uuid: z.string().describe('User UUID'),
        },
        async ({ uuid }) => {
            try {
                return toolResult(await client.fetchIps(uuid));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'ip_control_fetch_users_ips',
        'Fetch IPs for all users on a node (async job)',
        {
            nodeUuid: z.string().describe('Node UUID'),
        },
        async ({ nodeUuid }) => {
            try {
                return toolResult(await client.fetchUsersIps(nodeUuid));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'ip_control_drop_connections',
        'Drop active connections by IP or user UUID on specific/all nodes',
        {
            dropBy: z
                .union([
                    z.object({
                        by: z.literal('ipAddresses'),
                        ipAddresses: z.array(z.string()).min(1).describe('Array of IP addresses'),
                    }),
                    z.object({
                        by: z.literal('userUuids'),
                        userUuids: z.array(z.string()).min(1).describe('Array of user UUIDs'),
                    }),
                ])
                .describe('What to drop connections by'),
            targetNodes: z
                .union([
                    z.object({
                        target: z.literal('allNodes'),
                    }),
                    z.object({
                        target: z.literal('specificNodes'),
                        nodeUuids: z.array(z.string()).min(1).describe('Array of node UUIDs'),
                    }),
                ])
                .describe('Which nodes to target'),
        },
        async (params) => {
            try {
                return toolResult(await client.dropConnections(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
