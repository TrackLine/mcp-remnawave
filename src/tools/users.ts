import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RemnawaveClient } from '../client/index.js';
import { toolResult, toolError } from './helpers.js';

export function registerUserTools(server: McpServer, client: RemnawaveClient, readonly: boolean) {
    server.tool(
        'users_list',
        'List all Remnawave VPN users with pagination',
        {
            start: z.number().default(0).describe('Offset for pagination'),
            size: z.number().default(25).describe('Number of users to return'),
        },
        async ({ start, size }) => {
            try {
                const result = await client.getUsers(start, size);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_get',
        'Get a specific Remnawave user by their UUID',
        {
            uuid: z.string().describe('User UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.getUserByUuid(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_get_by_username',
        'Get a Remnawave user by their username',
        {
            username: z.string().describe('Username'),
        },
        async ({ username }) => {
            try {
                const result = await client.getUserByUsername(username);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_get_by_short_uuid',
        'Get a Remnawave user by their short UUID',
        {
            shortUuid: z.string().describe('Short UUID'),
        },
        async ({ shortUuid }) => {
            try {
                const result = await client.getUserByShortUuid(shortUuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_get_by_telegram_id',
        'Get a Remnawave user by their Telegram ID',
        {
            telegramId: z.string().describe('Telegram user ID'),
        },
        async ({ telegramId }) => {
            try {
                const result = await client.getUserByTelegramId(telegramId);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_get_by_email',
        'Get a Remnawave user by their email',
        {
            email: z.string().describe('User email'),
        },
        async ({ email }) => {
            try {
                const result = await client.getUserByEmail(email);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_get_by_tag',
        'Get Remnawave users by tag',
        {
            tag: z.string().describe('User tag'),
        },
        async ({ tag }) => {
            try {
                const result = await client.getUserByTag(tag);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_get_by_subscription_uuid',
        'Get a Remnawave user by subscription UUID',
        {
            subscriptionUuid: z.string().describe('Subscription UUID'),
        },
        async ({ subscriptionUuid }) => {
            try {
                const result = await client.getUserBySubscriptionUuid(subscriptionUuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool('users_tags_list', 'List all user tags', {}, async () => {
        try {
            const result = await client.getUserTags();
            return toolResult(result);
        } catch (e) {
            return toolError(e);
        }
    });

    if (readonly) return;

    server.tool(
        'users_resolve',
        'Search and resolve users by UUID, ID, short UUID, or username',
        {
            uuid: z.string().optional().describe('User UUID'),
            id: z.number().optional().describe('User numeric ID'),
            shortUuid: z.string().optional().describe('Short UUID'),
            username: z.string().optional().describe('Username'),
        },
        async (params) => {
            try {
                const result = await client.resolveUsers(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_create',
        'Create a new VPN user in Remnawave',
        {
            username: z.string().describe('Unique username'),
            expireAt: z.string().describe('Expiration date in ISO 8601 format'),
            trafficLimitBytes: z
                .number()
                .optional()
                .describe('Traffic limit in bytes (0 = unlimited)'),
            trafficLimitStrategy: z
                .enum(['NO_RESET', 'DAY', 'WEEK', 'MONTH', 'MONTH_ROLLING'])
                .optional()
                .describe('Traffic reset period'),
            status: z.enum(['ACTIVE', 'DISABLED']).optional().describe('Initial user status'),
            description: z.string().optional().describe('User description'),
            tag: z.string().optional().describe('User tag for grouping'),
            telegramId: z.number().optional().describe('Telegram user ID'),
            email: z.string().optional().describe('User email'),
            hwidDeviceLimit: z.number().optional().describe('Max number of HWID devices'),
            activeInternalSquads: z
                .array(z.string())
                .optional()
                .describe('Array of internal squad UUIDs'),
            uuid: z.string().optional().describe('Custom UUID for the user'),
            externalSquadUuid: z.string().optional().describe('External squad UUID'),
        },
        async (params) => {
            try {
                const result = await client.createUser(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_update',
        'Update an existing Remnawave user',
        {
            uuid: z.string().describe('User UUID to update'),
            username: z.string().optional().describe('New username'),
            expireAt: z.string().optional().describe('New expiration date (ISO 8601)'),
            trafficLimitBytes: z.number().optional().describe('New traffic limit in bytes'),
            trafficLimitStrategy: z
                .enum(['NO_RESET', 'DAY', 'WEEK', 'MONTH', 'MONTH_ROLLING'])
                .optional()
                .describe('Traffic reset period'),
            status: z.enum(['ACTIVE', 'DISABLED']).optional().describe('User status'),
            description: z.string().optional().describe('User description'),
            tag: z.string().optional().describe('User tag'),
            telegramId: z.number().optional().describe('Telegram user ID'),
            email: z.string().optional().describe('User email'),
            hwidDeviceLimit: z.number().optional().describe('Max HWID devices'),
            activeInternalSquads: z.array(z.string()).optional().describe('Internal squad UUIDs'),
            externalSquadUuid: z.string().optional().describe('External squad UUID'),
        },
        async (params) => {
            try {
                const result = await client.updateUser(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_delete',
        'Permanently delete a Remnawave user',
        {
            uuid: z.string().describe('User UUID to delete'),
        },
        async ({ uuid }) => {
            try {
                await client.deleteUser(uuid);
                return toolResult({ success: true, message: `User ${uuid} deleted` });
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_enable',
        'Enable a disabled Remnawave user (restore VPN access)',
        {
            uuid: z.string().describe('User UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.enableUser(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_disable',
        'Disable a Remnawave user (block VPN access)',
        {
            uuid: z.string().describe('User UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.disableUser(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_revoke_subscription',
        'Revoke subscription for a Remnawave user (generates new subscription link)',
        {
            uuid: z.string().describe('User UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.revokeUserSubscription(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_reset_traffic',
        'Reset traffic counter for a Remnawave user',
        {
            uuid: z.string().describe('User UUID'),
        },
        async ({ uuid }) => {
            try {
                const result = await client.resetUserTraffic(uuid);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_bulk_delete_by_status',
        'Bulk delete users by status',
        {
            status: z
                .enum(['ACTIVE', 'DISABLED', 'LIMITED', 'EXPIRED'])
                .describe('User status to delete'),
        },
        async (params) => {
            try {
                const result = await client.bulkDeleteUsersByStatus(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_bulk_update',
        'Bulk update selected users',
        {
            uuids: z.array(z.string()).describe('Array of user UUIDs to update'),
            status: z
                .enum(['ACTIVE', 'DISABLED', 'LIMITED', 'EXPIRED'])
                .optional()
                .describe('New status'),
            expireAt: z.string().optional().describe('New expiration date (ISO 8601)'),
            trafficLimitBytes: z.number().optional().describe('New traffic limit'),
            trafficLimitStrategy: z
                .enum(['NO_RESET', 'DAY', 'WEEK', 'MONTH', 'MONTH_ROLLING'])
                .optional()
                .describe('Traffic reset period'),
            description: z.string().optional().describe('User description'),
            telegramId: z.number().optional().describe('Telegram user ID'),
            email: z.string().optional().describe('User email'),
            tag: z.string().optional().describe('User tag'),
            hwidDeviceLimit: z.number().optional().describe('Max HWID devices'),
            externalSquadUuid: z.string().optional().describe('External squad UUID'),
        },
        async (params) => {
            try {
                const { uuids, ...fields } = params;
                const result = await client.bulkUpdateUsers({ uuids, fields });
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_bulk_reset_traffic',
        'Bulk reset traffic for selected users',
        {
            uuids: z.array(z.string()).describe('Array of user UUIDs'),
        },
        async (params) => {
            try {
                const result = await client.bulkResetUsersTraffic(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_bulk_revoke_subscription',
        'Bulk revoke subscriptions for selected users',
        {
            uuids: z.array(z.string()).describe('Array of user UUIDs'),
        },
        async (params) => {
            try {
                const result = await client.bulkRevokeUsersSubscription(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_bulk_delete',
        'Bulk delete selected users',
        {
            uuids: z.array(z.string()).describe('Array of user UUIDs to delete'),
        },
        async (params) => {
            try {
                const result = await client.bulkDeleteUsers(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_bulk_update_squads',
        'Bulk update squad assignments for selected users',
        {
            uuids: z.array(z.string()).describe('Array of user UUIDs'),
            activeInternalSquads: z.array(z.string()).describe('Squad UUIDs to assign'),
        },
        async (params) => {
            try {
                const result = await client.bulkUpdateUserSquads(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_bulk_extend_expiration',
        'Bulk extend expiration date for selected users',
        {
            uuids: z.array(z.string()).describe('Array of user UUIDs'),
            extendDays: z.number().describe('Number of days to extend'),
        },
        async (params) => {
            try {
                const result = await client.bulkExtendUsersExpiration(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_bulk_all_update',
        'Update ALL users at once',
        {
            status: z
                .enum(['ACTIVE', 'DISABLED', 'LIMITED', 'EXPIRED'])
                .optional()
                .describe('New status for all'),
            expireAt: z.string().optional().describe('New expiration date for all'),
            trafficLimitBytes: z.number().optional().describe('Traffic limit in bytes'),
            trafficLimitStrategy: z
                .enum(['NO_RESET', 'DAY', 'WEEK', 'MONTH', 'MONTH_ROLLING'])
                .optional()
                .describe('Traffic reset period'),
            description: z.string().optional().describe('User description'),
            telegramId: z.number().optional().describe('Telegram user ID'),
            email: z.string().optional().describe('User email'),
            tag: z.string().optional().describe('User tag'),
            hwidDeviceLimit: z.number().optional().describe('Max HWID devices'),
        },
        async (params) => {
            try {
                const result = await client.bulkAllUpdateUsers(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_bulk_all_reset_traffic',
        'Reset traffic counters for ALL users',
        {},
        async () => {
            try {
                const result = await client.bulkAllResetUsersTraffic();
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );

    server.tool(
        'users_bulk_all_extend_expiration',
        'Extend expiration date for ALL users',
        {
            extendDays: z.number().describe('Number of days to extend'),
        },
        async (params) => {
            try {
                const result = await client.bulkAllExtendUsersExpiration(params);
                return toolResult(result);
            } catch (e) {
                return toolError(e);
            }
        },
    );
}
