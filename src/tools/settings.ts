import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerSettingsTools(server: McpServer, client: RemnawaveClient, readonly: boolean) {
    server.tool('settings_get', 'Get Remnawave panel settings', {}, async () => {
        try { return toolResult(await client.getSettings()); } catch (e) { return toolError(e); }
    });

    server.tool(
        'subscription_settings_get',
        'Get subscription settings: response rules (user-agent/header based template selection), custom remarks, custom response headers, HWID settings, randomizeHosts, serveJsonAtBaseSubscription. Returns the uuid needed for updates.',
        {},
        async () => {
            try { return toolResult(await client.getSubscriptionSettings()); } catch (e) { return toolError(e); }
        },
    );

    if (readonly) return;

    server.tool(
        'subscription_settings_update',
        'Update subscription settings. Only provided fields are changed; object fields (responseRules, customRemarks, hwidSettings, customResponseHeaders) are replaced as a whole - read them with subscription_settings_get first.',
        {
            uuid: z.string().describe('Subscription settings UUID (from subscription_settings_get)'),
            serveJsonAtBaseSubscription: z.boolean().optional().describe('Serve Xray JSON at the base subscription URL for supported clients'),
            isShowCustomRemarks: z.boolean().optional().describe('Show custom remarks (expired/limited/disabled placeholders)'),
            customRemarks: z.record(z.unknown()).optional().describe('Custom remarks object'),
            customResponseHeaders: z.record(z.string()).optional().describe('Custom response headers: { headerName: value }'),
            randomizeHosts: z.boolean().optional().describe('Randomize host order in subscriptions'),
            responseRules: z
                .object({
                    version: z.string().describe('Config version, e.g. "1"'),
                    settings: z.record(z.unknown()).optional().describe('e.g. { disableSubscriptionAccessByPath: false }'),
                    rules: z.array(z.record(z.unknown())).describe(
                        'Ordered rules. Each: { name, description?, enabled, operator: "AND"|"OR", conditions: [{ headerName: "user-agent", operator: e.g. "CONTAINS"|"REGEX"|"EQUALS"..., value, caseSensitive }], responseType: e.g. "MIHOMO"|"STASH"|"CLASH"|"SINGBOX"|"XRAY_JSON"|"XRAY_BASE64"|"BROWSER"|"BLOCK"..., responseModifications?: { headers?: [{key,value}], subscriptionTemplate?: "<template name>", ignoreHostXrayJsonTemplate?, ignoreServeJsonAtBaseSubscription?, ... } }',
                    ),
                })
                .passthrough()
                .optional()
                .describe('Subscription response rules config (replaces the whole config)'),
            hwidSettings: z.record(z.unknown()).optional().describe('HWID settings object'),
        },
        async (params) => {
            try {
                const body: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(params)) if (v !== undefined) body[k] = v;
                return toolResult(await client.updateSubscriptionSettings(body));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool('settings_update', 'Update Remnawave panel settings', {
        settings: z.record(z.unknown()).describe('Settings key-value pairs to update'),
    }, async ({ settings }) => {
        try { return toolResult(await client.updateSettings(settings)); } catch (e) { return toolError(e); }
    });
}
