import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

const SUBSCRIPTION_TYPES = [
    'XRAY_JSON',
    'XRAY_BASE64',
    'MIHOMO',
    'STASH',
    'CLASH',
    'SINGBOX',
] as const;

export function registerHostTools(server: McpServer, client: RemnawaveClient, readonly: boolean) {
    server.tool('hosts_list', 'List all Remnawave hosts', {}, async () => {
        try {
            const result = await client.getHosts();
            return toolResult(result);
        } catch (e) {
            return toolError(e);
        }
    });

    server.tool(
        'hosts_get',
        'Get a specific host by UUID',
        {
            uuid: z.string().describe('Host UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.getHostByUuid(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool('hosts_tags_list', 'List all host tags', {}, async () => {
        try {
            const result = await client.getHostTags();
            return toolResult(result);
        } catch (e) {
            return toolError(e);
        }
    });

    if (readonly) return;

    server.tool(
        'hosts_create',
        'Create a new host in Remnawave',
        {
            remark: z.string().describe('Host remark/name'),
            address: z.string().describe('Host address'),
            port: z.number().describe('Host port'),
            configProfileUuid: z.string().describe('Config profile UUID'),
            configProfileInboundUuid: z.string().describe('Config profile inbound UUID'),
            path: z.string().optional().describe('URL path'),
            sni: z.string().optional().describe('SNI (Server Name Indication)'),
            host: z.string().optional().describe('Host header'),
            alpn: z
                .enum(['h3', 'h2', 'http/1.1', 'h2,http/1.1', 'h3,h2,http/1.1', 'h3,h2'])
                .optional()
                .describe('ALPN protocol'),
            fingerprint: z
                .enum([
                    'chrome',
                    'firefox',
                    'safari',
                    'ios',
                    'android',
                    'edge',
                    'qq',
                    'random',
                    'randomized',
                ])
                .optional()
                .describe('TLS fingerprint'),
            isDisabled: z.boolean().optional().describe('Create in disabled state'),
            isHidden: z.boolean().optional().describe('Hide from subscription list'),
            securityLayer: z.enum(['DEFAULT', 'TLS', 'NONE']).optional().describe('Security layer'),
            tag: z.string().optional().describe('Host tag'),
            serverDescription: z.string().optional().describe('Server description'),
            nodes: z.array(z.string()).optional().describe('Array of node UUIDs to assign'),
            excludeFromSubscriptionTypes: z
                .array(z.enum(SUBSCRIPTION_TYPES))
                .optional()
                .describe('Subscription types to exclude this host from'),
            xrayJsonTemplateUuid: z.string().optional().describe('Xray JSON template UUID'),
            excludedInternalSquads: z
                .array(z.string())
                .optional()
                .describe('Internal squad UUIDs to exclude host from'),
            overrideSniFromAddress: z.boolean().optional().describe('Override SNI from address'),
            keepSniBlank: z.boolean().optional().describe('Keep SNI field blank'),
            allowInsecure: z.boolean().optional().describe('Allow insecure connections'),
            vlessRouteId: z.number().optional().describe('VLESS route ID (0-65535)'),
            shuffleHost: z.boolean().optional().describe('Enable host shuffling'),
            mihomoX25519: z.boolean().optional().describe('Enable Mihomo X25519'),
        },
        async (params) => {
            try {
                const body: Record<string, unknown> = {
                    remark: params.remark,
                    address: params.address,
                    port: params.port,
                    inbound: {
                        configProfileUuid: params.configProfileUuid,
                        configProfileInboundUuid: params.configProfileInboundUuid,
                    },
                };
                if (params.path !== undefined) body.path = params.path;
                if (params.sni !== undefined) body.sni = params.sni;
                if (params.host !== undefined) body.host = params.host;
                if (params.alpn !== undefined) body.alpn = params.alpn;
                if (params.fingerprint !== undefined) body.fingerprint = params.fingerprint;
                if (params.isDisabled !== undefined) body.isDisabled = params.isDisabled;
                if (params.isHidden !== undefined) body.isHidden = params.isHidden;
                if (params.securityLayer !== undefined) body.securityLayer = params.securityLayer;
                if (params.tag !== undefined) body.tag = params.tag;
                if (params.serverDescription !== undefined)
                    body.serverDescription = params.serverDescription;
                if (params.nodes !== undefined) body.nodes = params.nodes;
                if (params.excludeFromSubscriptionTypes !== undefined)
                    body.excludeFromSubscriptionTypes = params.excludeFromSubscriptionTypes;
                if (params.xrayJsonTemplateUuid !== undefined)
                    body.xrayJsonTemplateUuid = params.xrayJsonTemplateUuid;
                if (params.excludedInternalSquads !== undefined)
                    body.excludedInternalSquads = params.excludedInternalSquads;
                if (params.overrideSniFromAddress !== undefined)
                    body.overrideSniFromAddress = params.overrideSniFromAddress;
                if (params.keepSniBlank !== undefined) body.keepSniBlank = params.keepSniBlank;
                if (params.allowInsecure !== undefined) body.allowInsecure = params.allowInsecure;
                if (params.vlessRouteId !== undefined) body.vlessRouteId = params.vlessRouteId;
                if (params.shuffleHost !== undefined) body.shuffleHost = params.shuffleHost;
                if (params.mihomoX25519 !== undefined) body.mihomoX25519 = params.mihomoX25519;

                const result = await client.createHost(body);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'hosts_update',
        'Update an existing host',
        {
            uuid: z.string().describe('Host UUID to update'),
            remark: z.string().optional().describe('New remark/name'),
            address: z.string().optional().describe('New address'),
            port: z.number().optional().describe('New port'),
            configProfileUuid: z.string().optional().describe('New config profile UUID'),
            configProfileInboundUuid: z
                .string()
                .optional()
                .describe('New config profile inbound UUID'),
            path: z.string().optional().describe('New URL path'),
            sni: z.string().optional().describe('New SNI'),
            host: z.string().optional().describe('New host header'),
            alpn: z
                .enum(['h3', 'h2', 'http/1.1', 'h2,http/1.1', 'h3,h2,http/1.1', 'h3,h2'])
                .optional()
                .describe('New ALPN'),
            fingerprint: z
                .enum([
                    'chrome',
                    'firefox',
                    'safari',
                    'ios',
                    'android',
                    'edge',
                    'qq',
                    'random',
                    'randomized',
                ])
                .optional()
                .describe('New fingerprint'),
            isDisabled: z.boolean().optional().describe('Enable/disable host'),
            isHidden: z.boolean().optional().describe('Hide from subscription list'),
            securityLayer: z
                .enum(['DEFAULT', 'TLS', 'NONE'])
                .optional()
                .describe('New security layer'),
            tag: z.string().optional().describe('New tag'),
            serverDescription: z.string().optional().describe('New server description'),
            nodes: z.array(z.string()).optional().describe('New node UUIDs'),
            excludeFromSubscriptionTypes: z
                .array(z.enum(SUBSCRIPTION_TYPES))
                .optional()
                .describe('Subscription types to exclude this host from'),
            xrayJsonTemplateUuid: z.string().optional().describe('Xray JSON template UUID'),
            excludedInternalSquads: z
                .array(z.string())
                .optional()
                .describe('Internal squad UUIDs to exclude host from'),
            overrideSniFromAddress: z.boolean().optional().describe('Override SNI from address'),
            keepSniBlank: z.boolean().optional().describe('Keep SNI field blank'),
            allowInsecure: z.boolean().optional().describe('Allow insecure connections'),
            vlessRouteId: z.number().optional().describe('VLESS route ID (0-65535)'),
            shuffleHost: z.boolean().optional().describe('Enable host shuffling'),
            mihomoX25519: z.boolean().optional().describe('Enable Mihomo X25519'),
        },
        async (params) => {
            try {
                const { uuid, configProfileUuid, configProfileInboundUuid, ...fields } = params;
                const body: Record<string, unknown> = { uuid, ...fields };
                if (configProfileUuid !== undefined || configProfileInboundUuid !== undefined) {
                    body.inbound = {
                        ...(configProfileUuid !== undefined ? { configProfileUuid } : {}),
                        ...(configProfileInboundUuid !== undefined
                            ? { configProfileInboundUuid }
                            : {}),
                    };
                }
                const result = await client.updateHost(body);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'hosts_delete',
        'Delete a host from Remnawave',
        {
            uuid: z.string().describe('Host UUID to delete'),
        },
        async ({ uuid }) => {
            try {
                await client.deleteHost(uuid);
                return toolResult({
                    success: true,
                    message: `Host ${uuid} deleted`,
                });
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'hosts_bulk_enable',
        'Bulk enable selected hosts',
        { uuids: z.array(z.string()).describe('Array of host UUIDs') },
        async (params) => {
            try {
                return toolResult(await client.bulkEnableHosts(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'hosts_bulk_disable',
        'Bulk disable selected hosts',
        { uuids: z.array(z.string()).describe('Array of host UUIDs') },
        async (params) => {
            try {
                return toolResult(await client.bulkDisableHosts(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'hosts_bulk_delete',
        'Bulk delete selected hosts',
        { uuids: z.array(z.string()).describe('Array of host UUIDs') },
        async (params) => {
            try {
                return toolResult(await client.bulkDeleteHosts(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'hosts_bulk_set_inbound',
        'Bulk set inbound for selected hosts',
        {
            uuids: z.array(z.string()).describe('Array of host UUIDs'),
            configProfileUuid: z.string().describe('Config profile UUID'),
            configProfileInboundUuid: z.string().describe('Inbound UUID'),
        },
        async (params) => {
            try {
                return toolResult(await client.bulkSetHostInbound(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'hosts_bulk_set_port',
        'Bulk set port for selected hosts',
        {
            uuids: z.array(z.string()).describe('Array of host UUIDs'),
            port: z.number().describe('New port number'),
        },
        async (params) => {
            try {
                return toolResult(await client.bulkSetHostPort(params));
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
