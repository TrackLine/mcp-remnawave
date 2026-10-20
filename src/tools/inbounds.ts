import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

const configProfileName = z
    .string()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_\s-]+$/)
    .describe('Profile name (2-30 letters, numbers, spaces, underscores, or dashes)');

export function registerInboundTools(
    server: McpServer,
    client: RemnawaveClient,
    readonly: boolean,
) {
    server.tool('config_profiles_list', 'List all config profiles', {}, async () => {
        try {
            const result = await client.getConfigProfiles();
            return toolResult(result);
        } catch (e) {
            return toolError(e);
        }
    });

    server.tool(
        'config_profiles_get',
        'Get a config profile by UUID',
        {
            uuid: z.string().uuid().describe('Config profile UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.getConfigProfileByUuid(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool('inbounds_list', 'List all inbounds from all config profiles', {}, async () => {
        try {
            const result = await client.getAllInbounds();
            return toolResult(result);
        } catch (e) {
            return toolError(e);
        }
    });

    server.tool(
        'config_profiles_get_inbounds',
        'Get inbounds for a specific config profile',
        {
            uuid: z.string().uuid().describe('Config profile UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.getInboundsByProfileUuid(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'config_profiles_get_computed_config',
        'Get computed configuration for a config profile',
        {
            uuid: z.string().uuid().describe('Config profile UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.getComputedConfigByProfileUuid(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    if (readonly) return;

    server.tool(
        'config_profiles_create',
        'Create a new config profile',
        {
            name: configProfileName,
            config: z.object({}).passthrough().describe('Config profile configuration object'),
        },
        async (params) => {
            try {
                const result = await client.createConfigProfile(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'config_profiles_update',
        'Update a config profile',
        {
            uuid: z.string().uuid().describe('Profile UUID'),
            name: configProfileName.optional().describe('New profile name'),
            config: z
                .object({})
                .passthrough()
                .optional()
                .describe('Config profile configuration object'),
        },
        async (params) => {
            try {
                const result = await client.updateConfigProfile(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'config_profiles_delete',
        'Delete a config profile',
        {
            uuid: z.string().uuid().describe('Profile UUID'),
        },
        async ({ uuid }) => {
            try {
                await client.deleteConfigProfile(uuid);
                return toolResult({ success: true, message: `Profile ${uuid} deleted` });
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'config_profiles_reorder',
        'Reorder config profiles',
        {
            items: z
                .array(
                    z.object({
                        viewPosition: z.number().describe('Sort position (0-based)'),
                        uuid: z.string().uuid().describe('Config profile UUID'),
                    }),
                )
                .describe('Ordered array of { viewPosition, uuid } objects'),
        },
        async (params) => {
            try {
                const result = await client.reorderConfigProfiles(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
