import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RemnawaveClient } from './client/index.js';
import { Config } from './config.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';
import { registerAllPrompts } from './prompts/index.js';
import { registerV3 } from './v3/register.js';

function registerV2(server: McpServer, config: Config): void {
    const client = new RemnawaveClient(config);

    registerAllTools(server, client, config.readonly);
    registerAllResources(server, client);
    registerAllPrompts(server);
}

export function createServer(config: Config): McpServer {
    const server = new McpServer({
        name: 'remnawave-mcp',
        version: '1.3.1',
    });

    if (config.release === 'v2') {
        registerV2(server, config);
    } else {
        registerV3(server, config);
    }

    return server;
}
