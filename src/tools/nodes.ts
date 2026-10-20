import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerNodeTools(server: McpServer, client: RemnawaveClient, readonly: boolean) {
    server.tool(
        'nodes_list',
        'List all Remnawave nodes',
        {},
        async () => {
            try {
                const result = await client.getNodes();
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_get',
        'Get a specific node by UUID',
        {
            uuid: z.string().describe('Node UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.getNodeByUuid(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_tags_list',
        'List all node tags',
        {},
        async () => {
            try {
                const result = await client.getNodeTags();
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    if (readonly) return;

    const nodeFields = {
        port: z.number().int().min(1).max(65535).optional().describe('Node port'),
        countryCode: z
            .string()
            .max(2)
            .optional()
            .describe('Country code (e.g. US, DE, NL)'),
        isTrafficTrackingActive: z
            .boolean()
            .optional()
            .describe('Enable traffic tracking'),
        trafficLimitBytes: z
            .number()
            .min(0)
            .optional()
            .describe('Traffic limit in bytes'),
        trafficResetDay: z
            .number()
            .int()
            .min(1)
            .max(31)
            .optional()
            .describe('Day of month to reset traffic (1-31)'),
        notifyPercent: z
            .number()
            .int()
            .min(0)
            .max(100)
            .optional()
            .describe('Traffic notification threshold percentage'),
        consumptionMultiplier: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe('Multiplier applied to user traffic consumed on this node'),
        nodeConsumptionMultiplier: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe('Multiplier applied to the node\'s own traffic counter'),
        proxyUrl: z
            .string()
            .nullable()
            .optional()
            .describe('Outbound proxy for panel-to-node connection, socks5://[user:pass@]host:port (null to clear)'),
        providerUuid: z
            .string()
            .nullable()
            .optional()
            .describe('Infra billing provider UUID (null to clear)'),
        tags: z
            .array(z.string())
            .max(10)
            .optional()
            .describe('Node tags (uppercase letters, digits, _ and :; max 10). Replaces existing tags'),
        activePluginUuid: z
            .string()
            .nullable()
            .optional()
            .describe('Active node plugin UUID (null to clear)'),
        integrationUuids: z
            .array(z.string())
            .max(20)
            .optional()
            .describe('Integration UUIDs (replaces existing)'),
        note: z.string().max(255).optional().describe('Free-form note'),
    };

    const stripUndefined = (obj: Record<string, unknown>) =>
        Object.fromEntries(
            Object.entries(obj).filter(([, v]) => v !== undefined),
        );

    server.tool(
        'nodes_create',
        'Create a new node in Remnawave',
        {
            name: z.string().min(3).max(30).describe('Node name'),
            address: z.string().describe('Node address (IP or hostname)'),
            activeConfigProfileUuid: z
                .string()
                .describe('Config profile UUID to assign'),
            activeInbounds: z
                .array(z.string())
                .describe('Array of inbound UUIDs to enable'),
            ...nodeFields,
        },
        async ({ activeConfigProfileUuid, activeInbounds, ...rest }) => {
            try {
                const result = await client.createNode({
                    ...stripUndefined(rest),
                    configProfile: { activeConfigProfileUuid, activeInbounds },
                });
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_update',
        'Update an existing node. To change the node\'s active config profile or active inbounds, pass configProfileUuid AND activeInbounds together (activeInbounds is the full set of inbound UUIDs the node should run, replacing the current set). A node only serves inbounds listed in its activeInbounds: adding an inbound to a profile does not activate it. Changing these restarts Xray on the node and briefly drops connected users.',
        {
            uuid: z.string().describe('Node UUID to update'),
            name: z.string().min(3).max(30).optional().describe('New node name'),
            address: z.string().optional().describe('New address'),
            configProfileUuid: z
                .string()
                .optional()
                .describe('Active config profile UUID (requires activeInbounds)'),
            activeInbounds: z
                .array(z.string())
                .optional()
                .describe('Full array of inbound UUIDs to activate on the node (requires configProfileUuid)'),
            ...nodeFields,
        },
        async ({ configProfileUuid, activeInbounds, ...rest }) => {
            try {
                if ((configProfileUuid === undefined) !== (activeInbounds === undefined)) {
                    throw new Error(
                        'configProfileUuid and activeInbounds must be provided together',
                    );
                }
                const body = stripUndefined(rest);
                if (configProfileUuid !== undefined) {
                    body.configProfile = {
                        activeConfigProfileUuid: configProfileUuid,
                        activeInbounds,
                    };
                }
                const result = await client.updateNode(body);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_delete',
        'Delete a node from Remnawave',
        {
            uuid: z.string().describe('Node UUID to delete'),
        },
        async ({ uuid }) => {
            try {
                await client.deleteNode(uuid);
                return toolResult({
                    success: true,
                    message: `Node ${uuid} deleted`,
                });
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_enable',
        'Enable a disabled node',
        {
            uuid: z.string().describe('Node UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.enableNode(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_disable',
        'Disable a node',
        {
            uuid: z.string().describe('Node UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.disableNode(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_restart',
        'Restart a specific node',
        {
            uuid: z.string().describe('Node UUID'),
            forceRestart: z
                .boolean()
                .optional()
                .default(false)
                .describe('Force an Xray restart even if the node config has not changed (default false)'),
        },
        async ({ uuid, forceRestart }) => {
            try {
                const result = await client.restartNode(uuid, forceRestart);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_restart_all',
        'Restart all nodes',
        {
            forceRestart: z
                .boolean()
                .optional()
                .default(false)
                .describe('Force an Xray restart even if the node config has not changed (default false)'),
        },
        async ({ forceRestart }) => {
            try {
                const result = await client.restartAllNodes(forceRestart);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_reset_traffic',
        'Reset traffic counter for a node',
        {
            uuid: z.string().describe('Node UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.resetNodeTraffic(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_reorder',
        'Reorder nodes by providing an ordered array of node positions',
        {
            nodes: z
                .array(z.object({
                    viewPosition: z.number().describe('Sort position (0-based)'),
                    uuid: z.string().describe('Node UUID'),
                }))
                .describe('Ordered array of { viewPosition, uuid } objects'),
        },
        async ({ nodes }) => {
            try {
                const result = await client.reorderNodes(nodes);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_bulk_profile_modification',
        'Set the active config profile and active inbounds on selected nodes. activeInbounds replaces the current set. Restarts Xray on the affected nodes and briefly drops connected users.',
        {
            uuids: z.array(z.string()).min(1).describe('Array of node UUIDs'),
            configProfileUuid: z.string().describe('New config profile UUID'),
            activeInbounds: z.array(z.string()).min(1).describe('Full array of inbound UUIDs to activate'),
        },
        async (params) => {
            try {
                const body = {
                    uuids: params.uuids,
                    configProfile: {
                        activeConfigProfileUuid: params.configProfileUuid,
                        activeInbounds: params.activeInbounds,
                    },
                };
                const result = await client.bulkNodeProfileModification(body);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_bulk_actions',
        'Bulk actions on selected nodes (enable/disable/restart/reset traffic)',
        {
            uuids: z.array(z.string()).describe('Array of node UUIDs'),
            action: z.enum(['ENABLE', 'DISABLE', 'RESTART', 'RESET_TRAFFIC']).describe('Action to perform'),
        },
        async (params) => {
            try {
                const result = await client.bulkNodeActions(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'nodes_bulk_update',
        'Bulk update properties for selected nodes',
        {
            uuids: z.array(z.string()).min(1).describe('Array of node UUIDs'),
            countryCode: nodeFields.countryCode,
            consumptionMultiplier: nodeFields.consumptionMultiplier,
            nodeConsumptionMultiplier: nodeFields.nodeConsumptionMultiplier,
            providerUuid: nodeFields.providerUuid,
            tags: nodeFields.tags,
            activePluginUuid: nodeFields.activePluginUuid,
            integrationUuids: nodeFields.integrationUuids,
            note: nodeFields.note,
        },
        async ({ uuids, ...fields }) => {
            try {
                const result = await client.bulkUpdateNodes({
                    uuids,
                    fields: stripUndefined(fields),
                });
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
