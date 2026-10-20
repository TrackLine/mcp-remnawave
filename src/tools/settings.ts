import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerSettingsTools(
    server: McpServer,
    client: RemnawaveClient,
    readonly: boolean,
) {
    server.tool('settings_get', 'Get Remnawave panel settings', {}, async () => {
        try {
            return toolResult(await client.getSettings());
        } catch (e) {
            return toolError(e);
        }
    });

    if (readonly) return;

    server.tool(
        'settings_update',
        'Update Remnawave panel settings',
        {
            settings: z.record(z.unknown()).describe('Settings key-value pairs to update'),
        },
        async ({ settings }) => {
            try {
                return toolResult(await client.updateSettings(settings));
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
