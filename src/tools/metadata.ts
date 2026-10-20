import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerMetadataTools(
    server: McpServer,
    client: RemnawaveClient,
    readonly: boolean,
) {
    server.tool(
        'metadata_node_get',
        'Get metadata for a specific node',
        {
            uuid: z.string().describe('Node UUID'),
        },
        async ({ uuid }) => {
            try {
                return toolResult(await client.getNodeMetadata(uuid));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'metadata_user_get',
        'Get metadata for a specific user',
        {
            uuid: z.string().describe('User UUID'),
        },
        async ({ uuid }) => {
            try {
                return toolResult(await client.getUserMetadata(uuid));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    if (readonly) return;

    server.tool(
        'metadata_node_upsert',
        'Create or update metadata for a node',
        {
            uuid: z.string().describe('Node UUID'),
            metadata: z.record(z.unknown()).describe('Metadata key-value pairs'),
        },
        async ({ uuid, metadata }) => {
            try {
                return toolResult(await client.upsertNodeMetadata(uuid, metadata));
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'metadata_user_upsert',
        'Create or update metadata for a user',
        {
            uuid: z.string().describe('User UUID'),
            metadata: z.record(z.unknown()).describe('Metadata key-value pairs'),
        },
        async ({ uuid, metadata }) => {
            try {
                return toolResult(await client.upsertUserMetadata(uuid, metadata));
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
