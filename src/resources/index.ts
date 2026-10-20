import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RemnawaveClient } from '../client/index.js';

export function registerAllResources(server: McpServer, client: RemnawaveClient) {
    server.resource(
        'panel-stats',
        'remnawave://stats',
        {
            description: 'Current Remnawave panel statistics (users, nodes, traffic, system)',
            mimeType: 'application/json',
        },
        async () => {
            const stats = await client.getStats();
            return {
                contents: [
                    {
                        uri: 'remnawave://stats',
                        mimeType: 'application/json',
                        text: JSON.stringify(stats, null, 2),
                    },
                ],
            };
        },
    );

    server.resource(
        'panel-nodes',
        'remnawave://nodes',
        {
            description: 'Status of all Remnawave nodes (online/offline, traffic)',
            mimeType: 'application/json',
        },
        async () => {
            const nodes = await client.getNodes();
            return {
                contents: [
                    {
                        uri: 'remnawave://nodes',
                        mimeType: 'application/json',
                        text: JSON.stringify(nodes, null, 2),
                    },
                ],
            };
        },
    );

    server.resource(
        'panel-health',
        'remnawave://health',
        {
            description: 'Remnawave panel health check',
            mimeType: 'application/json',
        },
        async () => {
            const health = await client.getHealth();
            return {
                contents: [
                    {
                        uri: 'remnawave://health',
                        mimeType: 'application/json',
                        text: JSON.stringify(health, null, 2),
                    },
                ],
            };
        },
    );

    server.resource(
        'user-details',
        new ResourceTemplate('remnawave://users/{uuid}', {
            list: undefined,
        }),
        {
            description: 'Detailed information about a specific Remnawave user',
            mimeType: 'application/json',
        },
        async (uri, params) => {
            const uuid = params.uuid as string;
            const user = await client.getUserByUuid(uuid);
            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: JSON.stringify(user, null, 2),
                    },
                ],
            };
        },
    );
}
