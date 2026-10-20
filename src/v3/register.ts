import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Config } from '../config.js';
import { V3_COMPONENT_SCHEMAS, V3_OPERATIONS } from './operations.generated.js';
import { RemnawaveV3Client } from './client.js';
import { registerV3Tools } from './tools.js';

/** Register the OpenAPI-derived Remnawave v3 MCP tools. */
export function registerV3(server: McpServer, config: Config): void {
    registerV3Tools(
        server,
        new RemnawaveV3Client(config),
        config.readonly,
        V3_OPERATIONS,
        V3_COMPONENT_SCHEMAS,
    );
}
