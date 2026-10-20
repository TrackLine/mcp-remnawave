import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

const TEMPLATE_TYPES = ['XRAY_JSON', 'XRAY_BASE64', 'MIHOMO', 'STASH', 'CLASH', 'SINGBOX'] as const;

type TemplateLike = { encodedTemplateYaml?: string | null; templateYaml?: string | null };

// The API transports YAML templates base64-encoded (`encodedTemplateYaml`).
// For convenience, decode it into a plain `templateYaml` field in responses.
function decodeTemplate<T extends TemplateLike>(tpl: T): T {
    if (tpl && typeof tpl.encodedTemplateYaml === 'string') {
        tpl.templateYaml = Buffer.from(tpl.encodedTemplateYaml, 'base64').toString('utf8');
    }
    return tpl;
}

function decodeResponse(result: unknown, includeEncoded: boolean): unknown {
    const r = result as { response?: TemplateLike & { templates?: TemplateLike[] } };
    if (!r?.response) return result;
    const strip = (t: TemplateLike) => {
        decodeTemplate(t);
        if (!includeEncoded) delete t.encodedTemplateYaml;
        return t;
    };
    if (Array.isArray(r.response.templates)) {
        r.response.templates.forEach(strip);
    } else {
        strip(r.response);
    }
    return result;
}

export function registerSubscriptionTemplateTools(server: McpServer, client: RemnawaveClient, readonly: boolean) {
    server.tool(
        'subscription_templates_list',
        'List all subscription templates (Mihomo/Stash/Clash YAML, Xray JSON, Sing-box JSON). Content may be omitted; use subscription_templates_get for the body.',
        {},
        async () => {
            try { return toolResult(decodeResponse(await client.getSubscriptionTemplates(), false)); } catch (e) { return toolError(e); }
        },
    );

    server.tool(
        'subscription_templates_get',
        'Get a subscription template by UUID. YAML templates are returned decoded in `templateYaml`; JSON templates in `templateJson`.',
        {
            uuid: z.string().describe('Template UUID'),
            includeEncoded: z.boolean().optional().describe('Also return the raw base64 `encodedTemplateYaml` (default false)'),
        },
        async ({ uuid, includeEncoded }) => {
            try { return toolResult(decodeResponse(await client.getSubscriptionTemplate(uuid), includeEncoded ?? false)); } catch (e) { return toolError(e); }
        },
    );

    if (readonly) return;

    server.tool(
        'subscription_templates_create',
        'Create an empty subscription template (name + type). Set its content afterwards with subscription_templates_update.',
        {
            name: z.string().describe('Template name (2-255 chars: letters, digits, _, -, spaces). Referenced by response rules via responseModifications.subscriptionTemplate'),
            templateType: z.enum(TEMPLATE_TYPES).describe('Template type'),
        },
        async (params) => {
            try { return toolResult(decodeResponse(await client.createSubscriptionTemplate(params), false)); } catch (e) { return toolError(e); }
        },
    );

    server.tool(
        'subscription_templates_update',
        'Update a subscription template. For MIHOMO/STASH/CLASH pass `templateYaml` (plain YAML text, base64-encoded automatically). For XRAY_JSON/SINGBOX pass `templateJson` (JSON object or JSON string). YAML and JSON cannot be sent together.',
        {
            uuid: z.string().describe('Template UUID'),
            name: z.string().optional().describe('New template name'),
            templateYaml: z.string().optional().describe('Full YAML body (plain text) for MIHOMO/STASH/CLASH templates'),
            encodedTemplateYaml: z.string().optional().describe('Alternative to templateYaml: YAML body already base64-encoded'),
            templateJson: z
                .union([z.record(z.unknown()), z.string()])
                .optional()
                .describe('Full JSON body for XRAY_JSON/SINGBOX templates (object, or a JSON string)'),
        },
        async ({ uuid, name, templateYaml, encodedTemplateYaml, templateJson }) => {
            try {
                if (templateYaml !== undefined && encodedTemplateYaml !== undefined) {
                    throw new Error('Provide either templateYaml or encodedTemplateYaml, not both');
                }
                const body: Record<string, unknown> = { uuid };
                if (name !== undefined) body.name = name;
                if (templateYaml !== undefined) {
                    body.encodedTemplateYaml = Buffer.from(templateYaml, 'utf8').toString('base64');
                }
                if (encodedTemplateYaml !== undefined) body.encodedTemplateYaml = encodedTemplateYaml;
                if (templateJson !== undefined) {
                    body.templateJson = typeof templateJson === 'string' ? JSON.parse(templateJson) : templateJson;
                }
                return toolResult(decodeResponse(await client.updateSubscriptionTemplate(body), false));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'subscription_templates_delete',
        'Delete a subscription template',
        { uuid: z.string().describe('Template UUID') },
        async ({ uuid }) => {
            try { return toolResult(await client.deleteSubscriptionTemplate(uuid)); } catch (e) { return toolError(e); }
        },
    );

    server.tool(
        'subscription_templates_reorder',
        'Reorder subscription templates',
        {
            items: z
                .array(z.object({
                    viewPosition: z.number().int().describe('Sort position'),
                    uuid: z.string().describe('Template UUID'),
                }))
                .describe('Array of { viewPosition, uuid }'),
        },
        async (params) => {
            try { return toolResult(decodeResponse(await client.reorderSubscriptionTemplates(params), false)); } catch (e) { return toolError(e); }
        },
    );
}
