import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RemnawaveClient } from './client/index.js';
import { Config } from './config.js';
import { registerAllTools } from './tools/index.js';
import { withSecretRedaction } from './tools/redact.js';
import { registerAllResources } from './resources/index.js';
import { registerAllPrompts } from './prompts/index.js';

export function createServer(config: Config): McpServer {
    const server = new McpServer({
        name: 'remnawave-mcp',
        version: '1.0.0',
    });

    const client = new RemnawaveClient(config);

    // Everything is registered through the redacting wrapper, so Reality private keys and
    // other secrets never reach the client's conversation log. See src/tools/redact.ts.
    const guarded = withSecretRedaction(server);

    registerAllTools(guarded, client, config.readonly);
    registerAllResources(guarded, client);
    registerAllPrompts(guarded);

    return guarded;
}
