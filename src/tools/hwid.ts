import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerHwidTools(server: McpServer, client: RemnawaveClient, readonly: boolean) {
    server.tool(
        'hwid_devices_list',
        'List HWID devices for a specific user',
        {
            userUuid: z.string().describe('User UUID'),
        },
        async ({ userUuid }) => {
            try {
                const result = await client.getUserHwidDevices(userUuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool('hwid_devices_list_all', 'List all HWID devices across all users', {}, async () => {
        try {
            const result = await client.getAllHwidDevices();
            return toolResult(result);
        } catch (e) {
            return toolError(e);
        }
    });

    server.tool('hwid_stats', 'Get HWID device statistics', {}, async () => {
        try {
            const result = await client.getHwidStats();
            return toolResult(result);
        } catch (e) {
            return toolError(e);
        }
    });

    server.tool('hwid_top_users', 'Get users with most HWID devices', {}, async () => {
        try {
            const result = await client.getHwidTopUsers();
            return toolResult(result);
        } catch (e) {
            return toolError(e);
        }
    });

    if (readonly) return;

    server.tool(
        'hwid_device_create',
        'Create a HWID device entry for a user',
        {
            userUuid: z.string().describe('User UUID'),
            hwid: z.string().describe('Hardware ID'),
            platform: z.string().optional().describe('Device platform'),
            osVersion: z.string().optional().describe('OS version'),
            deviceModel: z.string().optional().describe('Device model'),
            userAgent: z.string().optional().describe('User agent string'),
        },
        async (params) => {
            try {
                const result = await client.createUserHwidDevice(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'hwid_device_delete',
        'Delete a specific HWID device',
        {
            userUuid: z.string().describe('User UUID'),
            hwid: z.string().describe('HWID of the device to delete'),
        },
        async ({ userUuid, hwid }) => {
            try {
                const result = await client.deleteHwidDevice(userUuid, hwid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'hwid_devices_delete_all',
        'Delete all HWID devices for a user',
        {
            userUuid: z.string().describe('User UUID'),
        },
        async ({ userUuid }) => {
            try {
                const result = await client.deleteAllUserHwidDevices(userUuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
