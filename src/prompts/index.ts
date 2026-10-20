import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerAllPrompts(server: McpServer) {
    server.prompt(
        'create_user_wizard',
        'Step-by-step guide to create a new VPN user',
        {
            username: z.string().describe('Username for the new user'),
        },
        async ({ username }) => ({
            messages: [
                {
                    role: 'user' as const,
                    content: {
                        type: 'text' as const,
                        text: `I want to create a new VPN user with username "${username}". Please guide me through the process:

1. First, check if the username is already taken using users_get_by_username
2. Get the list of available config profiles using config_profiles_list
3. Get the list of available internal squads using squads_list
4. Create the user with appropriate settings (ask me about traffic limit, expiration date, and which squads to assign)
5. Confirm the user was created successfully and show the subscription URL`,
                    },
                },
            ],
        }),
    );

    server.prompt(
        'node_diagnostics',
        'Diagnose issues with a specific node',
        {
            nodeUuid: z.string().describe('UUID of the node to diagnose'),
        },
        async ({ nodeUuid }) => ({
            messages: [
                {
                    role: 'user' as const,
                    content: {
                        type: 'text' as const,
                        text: `Please run diagnostics on node ${nodeUuid}:

1. Get node details using nodes_get
2. Check system health using system_health
3. Get node metrics using system_nodes_metrics
4. Check bandwidth stats using system_bandwidth_stats
5. Summarize the node's status: connection state, xray version, uptime, traffic usage, online users
6. Flag any issues found (offline, high traffic usage, errors)`,
                    },
                },
            ],
        }),
    );

    server.prompt(
        'traffic_report',
        'Generate a traffic usage report',
        {
            startDate: z.string().optional().describe('Start date (ISO 8601)'),
            endDate: z.string().optional().describe('End date (ISO 8601)'),
        },
        async ({ startDate, endDate }) => {
            const period = startDate && endDate ? `from ${startDate} to ${endDate}` : 'current';
            return {
                messages: [
                    {
                        role: 'user' as const,
                        content: {
                            type: 'text' as const,
                            text: `Generate a traffic report for the ${period} period:

1. Get overall system stats using system_stats
2. Get bandwidth statistics using system_bandwidth_stats
3. Get node statistics using system_nodes_statistics
4. List all users and their traffic using users_list
5. Provide a summary including:
   - Total traffic consumed
   - Per-node traffic breakdown
   - Top users by traffic consumption
   - Users who exceeded their traffic limits
   - Users with expired subscriptions`,
                        },
                    },
                ],
            };
        },
    );

    server.prompt(
        'user_audit',
        'Complete audit of a specific user',
        {
            uuid: z.string().describe('User UUID to audit'),
        },
        async ({ uuid }) => ({
            messages: [
                {
                    role: 'user' as const,
                    content: {
                        type: 'text' as const,
                        text: `Perform a complete audit of user ${uuid}:

1. Get full user details using users_get
2. Get subscription info using subscriptions_get_by_uuid
3. Get HWID devices using hwid_devices_list
4. Summarize:
   - Account status and expiration
   - Traffic usage vs limit
   - Subscription URL and last access
   - Connected devices (HWID)
   - Squad memberships
   - Any issues or concerns`,
                    },
                },
            ],
        }),
    );

    server.prompt(
        'bulk_user_cleanup',
        'Find and manage expired or inactive users',
        {},
        async () => ({
            messages: [
                {
                    role: 'user' as const,
                    content: {
                        type: 'text' as const,
                        text: `Help me clean up users:

1. List all users using users_list with a large page size
2. Identify:
   - Users with EXPIRED status
   - Users with DISABLED status
   - Users with LIMITED status (exceeded traffic)
   - Users who haven't connected recently
3. Present the findings in a clear table
4. Ask what action to take (disable, delete, extend, reset traffic)
5. Execute the chosen action after confirmation`,
                    },
                },
            ],
        }),
    );
}
