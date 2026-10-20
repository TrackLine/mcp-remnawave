import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

const SUBSCRIPTION_TYPES = ['XRAY_JSON', 'XRAY_BASE64', 'MIHOMO', 'STASH', 'CLASH', 'SINGBOX'] as const;
const ALPN_VALUES = ['h3', 'h2', 'http/1.1', 'h2,http/1.1', 'h3,h2,http/1.1', 'h3,h2'] as const;
const MIHOMO_IP_VERSIONS = ['dual', 'ipv4', 'ipv6', 'ipv4-prefer', 'ipv6-prefer'] as const;
const jsonObject = () => z.record(z.unknown());

// Fields shared by create / update / bulk update, matching
// CreateHostCommand / UpdateHostCommand in @remnawave/backend-contract 3.4.x.
// Nullable fields accept `null` to clear the value.
const hostFields = {
    configProfileUuid: z
        .string()
        .optional()
        .describe('Config profile UUID (must be given together with configProfileInboundUuid)'),
    configProfileInboundUuid: z
        .string()
        .optional()
        .describe('Config profile inbound UUID (must be given together with configProfileUuid)'),
    path: z.string().nullable().optional().describe('URL path'),
    sni: z.string().nullable().optional().describe('SNI (Server Name Indication)'),
    host: z.string().nullable().optional().describe('Host header'),
    alpn: z.enum(ALPN_VALUES).nullable().optional().describe('ALPN protocol'),
    fingerprint: z
        .string()
        .nullable()
        .optional()
        .describe('TLS fingerprint: chrome, firefox, safari, ios, android, edge, qq, 360, random, randomized'),
    isDisabled: z.boolean().optional().describe('Disabled state'),
    isHidden: z.boolean().optional().describe('Hide host from subscriptions'),
    securityLayer: z.enum(['DEFAULT', 'TLS', 'NONE']).optional().describe('Security layer'),
    xhttpExtraParams: jsonObject().nullable().optional().describe('XHTTP extra params (JSON object)'),
    muxParams: jsonObject().nullable().optional().describe('Mux params (JSON object)'),
    sockoptParams: jsonObject().nullable().optional().describe('Sockopt params (JSON object)'),
    finalMask: jsonObject().nullable().optional().describe('Final mask (JSON object)'),
    serverDescription: z.string().max(30).nullable().optional().describe('Server description (max 30 chars)'),
    tags: z
        .array(z.string())
        .max(10)
        .optional()
        .describe('Host tags (uppercase letters, digits, _ and :, max 36 chars each, max 10)'),
    overrideSniFromAddress: z.boolean().optional().describe('Override SNI from address'),
    keepSniBlank: z.boolean().optional().describe('Keep SNI field blank'),
    pinnedPeerCertSha256: z.string().nullable().optional().describe('Pinned peer certificate SHA256'),
    verifyPeerCertByName: z.string().nullable().optional().describe('Verify peer certificate by name'),
    vlessRouteId: z.number().int().min(0).max(65535).nullable().optional().describe('VLESS route ID (0-65535)'),
    shuffleHost: z.boolean().optional().describe('Enable host shuffling'),
    mihomoX25519: z.boolean().optional().describe('Enable Mihomo X25519'),
    mihomoIpVersion: z.enum(MIHOMO_IP_VERSIONS).nullable().optional().describe('Mihomo ip-version'),
    nodes: z.array(z.string()).optional().describe('Node UUIDs this host is bound to'),
    xrayJsonTemplateUuid: z.string().nullable().optional().describe('Xray JSON subscription template UUID'),
    excludeFromSubscriptionTypes: z
        .array(z.enum(SUBSCRIPTION_TYPES))
        .optional()
        .describe('Subscription types to exclude this host from'),
    internalSquads: z
        .object({
            mode: z
                .enum(['EXCLUDE', 'ALLOW_ONLY'])
                .describe('EXCLUDE: hide host from users of listed squads. ALLOW_ONLY: show host only to users of listed squads (needs at least one squad)'),
            squads: z.array(z.string()).describe('Internal squad UUIDs'),
        })
        .optional()
        .describe('Internal squad filtering. Use { mode: "EXCLUDE", squads: [] } to disable filtering'),
    mapper: jsonObject()
        .optional()
        .describe('Host mapper: { xrayJson?, mihomo?, base64?, singbox? } - each an array of ops like { op: "set", to, value } | { op: "copy", from, to } | { op: "unset", to }'),
};

function buildHostBody(params: Record<string, unknown>): Record<string, unknown> {
    const { configProfileUuid, configProfileInboundUuid, ...rest } = params;
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) body[k] = v;
    }
    if (configProfileUuid !== undefined || configProfileInboundUuid !== undefined) {
        if (configProfileUuid === undefined || configProfileInboundUuid === undefined) {
            throw new Error('configProfileUuid and configProfileInboundUuid must be provided together');
        }
        body.inbound = { configProfileUuid, configProfileInboundUuid };
    }
    return body;
}

export function registerHostTools(server: McpServer, client: RemnawaveClient, readonly: boolean) {
    server.tool(
        'hosts_list',
        'List all Remnawave hosts',
        {},
        async () => {
            try {
                const result = await client.getHosts();
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

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

    server.tool(
        'hosts_tags_list',
        'List all host tags',
        {},
        async () => {
            try {
                const result = await client.getHostTags();
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    if (readonly) return;

    server.tool(
        'hosts_create',
        'Create a new host in Remnawave',
        {
            remark: z.string().describe('Host remark/name (1-100 chars)'),
            address: z.string().describe('Host address'),
            port: z.number().int().describe('Host port'),
            ...hostFields,
            configProfileUuid: z.string().describe('Config profile UUID'),
            configProfileInboundUuid: z.string().describe('Config profile inbound UUID'),
        },
        async (params) => {
            try {
                const result = await client.createHost(buildHostBody(params));
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'hosts_update',
        'Update an existing host. Only provided fields are changed; pass null to clear nullable fields.',
        {
            uuid: z.string().describe('Host UUID to update'),
            remark: z.string().optional().describe('New remark/name (1-100 chars)'),
            address: z.string().optional().describe('New address'),
            port: z.number().int().optional().describe('New port'),
            ...hostFields,
        },
        async (params) => {
            try {
                const result = await client.updateHost(buildHostBody(params));
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
        'hosts_reorder',
        'Reorder hosts',
        {
            hosts: z
                .array(z.object({
                    viewPosition: z.number().int().describe('Sort position'),
                    uuid: z.string().describe('Host UUID'),
                }))
                .describe('Array of { viewPosition, uuid }'),
        },
        async (params) => {
            try { return toolResult(await client.reorderHosts(params)); } catch (e) { return toolError(e); }
        },
    );

    server.tool(
        'hosts_bulk_enable',
        'Bulk enable selected hosts',
        { uuids: z.array(z.string()).describe('Array of host UUIDs') },
        async (params) => {
            try { return toolResult(await client.bulkEnableHosts(params)); } catch (e) { return toolError(e); }
        },
    );

    server.tool(
        'hosts_bulk_disable',
        'Bulk disable selected hosts',
        { uuids: z.array(z.string()).describe('Array of host UUIDs') },
        async (params) => {
            try { return toolResult(await client.bulkDisableHosts(params)); } catch (e) { return toolError(e); }
        },
    );

    server.tool(
        'hosts_bulk_delete',
        'Bulk delete selected hosts',
        { uuids: z.array(z.string()).describe('Array of host UUIDs') },
        async (params) => {
            try { return toolResult(await client.bulkDeleteHosts(params)); } catch (e) { return toolError(e); }
        },
    );

    server.tool(
        'hosts_bulk_update',
        'Bulk update selected hosts: the same provided fields are applied to every host in uuids',
        {
            uuids: z.array(z.string()).min(1).describe('Array of host UUIDs'),
            remark: z.string().optional().describe('New remark/name'),
            address: z.string().optional().describe('New address'),
            port: z.number().int().optional().describe('New port'),
            ...hostFields,
        },
        async (params) => {
            try { return toolResult(await client.bulkUpdateHosts(buildHostBody(params))); } catch (e) { return toolError(e); }
        },
    );

    server.tool(
        'hosts_bulk_set_inbound',
        'Bulk set inbound for selected hosts (shortcut for hosts_bulk_update)',
        {
            uuids: z.array(z.string()).min(1).describe('Array of host UUIDs'),
            configProfileUuid: z.string().describe('Config profile UUID'),
            configProfileInboundUuid: z.string().describe('Inbound UUID'),
        },
        async (params) => {
            try { return toolResult(await client.bulkUpdateHosts(buildHostBody(params))); } catch (e) { return toolError(e); }
        },
    );

    server.tool(
        'hosts_bulk_set_port',
        'Bulk set port for selected hosts (shortcut for hosts_bulk_update)',
        {
            uuids: z.array(z.string()).min(1).describe('Array of host UUIDs'),
            port: z.number().int().describe('New port number'),
        },
        async (params) => {
            try { return toolResult(await client.bulkUpdateHosts(params)); } catch (e) { return toolError(e); }
        },
    );
}
