import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerConnectionTools(server: McpServer, client: RemnawaveClient, readonly: boolean) {
    server.tool('connections_by_user', "Queue a job that lists a user's active connections. Returns a job id.", {
        userId: z.number().describe('Numeric user id'),
    }, async ({ userId }) => {
        try { return toolResult(await client.requestUserConnections(userId)); } catch (e) { return toolError(e); }
    });

    server.tool('connections_by_user_result', 'Get the result of a user connections job', {
        jobId: z.string().describe('Job ID from connections_by_user'),
    }, async ({ jobId }) => {
        try { return toolResult(await client.getUserConnectionsResult(jobId)); } catch (e) { return toolError(e); }
    });

    server.tool('connections_by_node', "Queue a job that lists a node's active connections. Returns a job id.", {
        nodeUuid: z.string().describe('Node UUID'),
    }, async ({ nodeUuid }) => {
        try { return toolResult(await client.requestNodeConnections(nodeUuid)); } catch (e) { return toolError(e); }
    });

    server.tool('connections_by_node_result', 'Get the result of a node connections job', {
        jobId: z.string().describe('Job ID from connections_by_node'),
    }, async ({ jobId }) => {
        try { return toolResult(await client.getNodeConnectionsResult(jobId)); } catch (e) { return toolError(e); }
    });

    server.tool('connections_geocheck', 'Queue a node geocheck job. Returns a job id. Only one of ip or interface is allowed.', {
        nodeUuid: z.string().describe('Node UUID'),
        ip: z.string().optional().describe('IP address to check'),
        interface: z.string().optional().describe('Network interface to check'),
    }, async ({ nodeUuid, ip, interface: iface }) => {
        if (ip !== undefined && iface !== undefined) {
            return toolError('only one of ip or interface is allowed');
        }
        const body: { ip?: string; interface?: string } = {};
        if (ip !== undefined) body.ip = ip;
        if (iface !== undefined) body.interface = iface;
        try { return toolResult(await client.requestNodeGeocheck(nodeUuid, body)); } catch (e) { return toolError(e); }
    });

    server.tool('connections_geocheck_result', 'Get the result of a node geocheck job', {
        jobId: z.string().describe('Job ID from connections_geocheck'),
    }, async ({ jobId }) => {
        try { return toolResult(await client.getNodeGeocheckResult(jobId)); } catch (e) { return toolError(e); }
    });

    if (readonly) return;

    server.tool('connections_drop', 'Drop active connections by numeric user ids or IP addresses', {
        dropBy: z.union([
            z.object({
                by: z.literal('userIds'),
                userIds: z.array(z.number()).min(1).describe('Array of numeric user ids'),
            }),
            z.object({
                by: z.literal('ipAddresses'),
                ipAddresses: z.array(z.string()).min(1).describe('Array of IP addresses'),
            }),
        ]).describe('What to drop connections by'),
        targetNodes: z.union([
            z.object({
                target: z.literal('allNodes'),
            }),
            z.object({
                target: z.literal('specificNodes'),
                nodeUuids: z.array(z.string()).min(1).describe('Array of node UUIDs'),
            }),
        ]).describe('Which nodes to target'),
    }, async (params) => {
        try { return toolResult(await client.dropConnections(params)); } catch (e) { return toolError(e); }
    });
}
