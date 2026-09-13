import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Strips secret values out of every tool and resource response.
 *
 * Why this is needed: the Remnawave panel returns Reality private keys inline in the body of
 * `nodes_list`, `nodes_get`, the config-profile tools and the `remnawave://nodes` resource.
 * The server serializes those responses with `JSON.stringify`, so the keys end up verbatim in
 * the MCP client's conversation log — which is stored on disk, may be synced, and is often
 * shared when asking for help. A leaked Reality private key means rotating keys on the node and
 * re-issuing the subscription on every client device.
 *
 * Doing it here rather than in each tool keeps it impossible to forget: a new tool added later
 * is covered automatically, because the wrapper sits on the registration methods themselves.
 *
 * What is NOT redacted (deliberate, so the guarantee is not overstated):
 *   - text that does not parse as JSON — a secret written in prose stays;
 *   - non-text content parts (image/audio/blob);
 *   - error text: when a handler throws, the SDK builds the response without passing through here.
 */

/** Keys whose value must never reach the client. */
const SECRET_KEYS =
    /^(privateKey|private_key|password|secret|secretKey|apiKey|api_key|token|accessToken|refreshToken)$/i;

/**
 * Tools whose entire purpose is to hand out a secret. Redacting these would make them useless,
 * so they are passed through untouched.
 */
const SECRET_PRODUCERS = new Set([
    'system_generate_x25519',
    'keygen_get',
    'api_tokens_create',
]);

function redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            out[key] =
                SECRET_KEYS.test(key) && typeof item === 'string' && item.length > 0
                    ? '[redacted by mcp server]'
                    : redact(item);
        }
        return out;
    }
    return value;
}

/** Redacts JSON carried inside a `text` field. Leaves anything that is not JSON alone. */
function redactTextParts(parts: unknown): void {
    if (!Array.isArray(parts)) return;
    for (const part of parts as Array<{ text?: unknown }>) {
        if (!part || typeof part.text !== 'string') continue;
        try {
            part.text = JSON.stringify(redact(JSON.parse(part.text)), null, 2);
        } catch {
            // not JSON — nothing to do
        }
    }
}

/** Covers tool responses (`content`, `structuredContent`) and resource responses (`contents`). */
function redactResult(result: unknown): unknown {
    const payload = result as {
        content?: unknown;
        contents?: unknown;
        structuredContent?: unknown;
    };
    if (!payload || typeof payload !== 'object') return result;
    redactTextParts(payload.content);
    redactTextParts(payload.contents);
    if (payload.structuredContent && typeof payload.structuredContent === 'object') {
        payload.structuredContent = redact(payload.structuredContent);
    }
    return result;
}

function wrapCallback(name: string, callback: unknown): unknown {
    if (typeof callback !== 'function') return callback;
    const handler = callback as (...args: unknown[]) => unknown;
    if (SECRET_PRODUCERS.has(name)) return handler;
    return async (...args: unknown[]) => redactResult(await handler(...args));
}

/**
 * Wraps the server so that every handler registered through it redacts secrets on the way out.
 * Registration code itself does not change.
 *
 * All four registration methods are covered — `tool`, `registerTool`, `resource` and
 * `registerResource` — because covering only `tool` would leave the resources uncovered, and
 * `remnawave://nodes` is exactly where the Reality keys show up.
 *
 * Not covered: replacing the callback of an already registered tool via
 * `RegisteredTool.update({ callback })`. Redaction would have to be applied to the new callback
 * by hand.
 */
export function withSecretRedaction(server: McpServer): McpServer {
    const WRAPPED = new Set(['tool', 'registerTool', 'resource', 'registerResource']);
    return new Proxy(server, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            // Everything else is bound to the real server: called on the proxy, these methods
            // would get `this` = proxy and every access to the SDK's internal state would be
            // routed back through these traps.
            if (typeof prop !== 'string' || !WRAPPED.has(prop)) {
                return typeof value === 'function' ? value.bind(target) : value;
            }
            const original = value as (...args: unknown[]) => unknown;
            return (name: string, ...rest: unknown[]) => {
                const args = [...rest];
                args[args.length - 1] = wrapCallback(name, args[args.length - 1]);
                return original.apply(target, [name, ...args]);
            };
        },
    });
}
