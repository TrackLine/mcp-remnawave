> [!IMPORTANT]
> PROJECT IS CLOSED, USE PLEASE https://github.com/3APA3A-3AHO3A/remnawave-mcp

# mcp-remnawave

[English](#english) | [Русский](#русский)

---

<a id="english"></a>

## MCP Server for Remnawave Panel

MCP server ([Model Context Protocol](https://modelcontextprotocol.io)) providing LLM clients (Claude Desktop, Cursor, Windsurf, etc.) with tools to manage a [Remnawave](https://github.com/remnawave/) VPN panel.

**Version:** 1.3.1 | **Remnawave API:** v3.4.3 OpenAPI snapshot by default; v2.7.4 compatibility mode

### Features

- **Complete v3 API coverage** — 217 generated MCP tools from the pinned official v3.4.3 OpenAPI snapshot
- **v2.7.4 compatibility** — the existing 153-tool MCP surface remains available when explicitly selected
- **v2 compatibility resources and prompts** — 4 real-time resources and 5 guided workflows are preserved for legacy panels
- **Readonly mode** — safe read-only tool registration for either selected release
- **Caddy support** — `X-Api-Key` header for panels behind Caddy with custom path
- **Type-safe** — v2 uses [@remnawave/backend-contract](https://www.npmjs.com/package/@remnawave/backend-contract); v3 tools derive from the pinned OpenAPI contract
- **stdio and HTTP transports** — local clients plus Streamable HTTP at `/mcp`

### Requirements

- Node.js 22.22.3
- Remnawave panel with API token (Settings > API Tokens)

### Installation

```bash
git clone https://github.com/TrackLine/mcp-remnawave.git
cd mcp-remnawave
npm install
npm run build
```

### Configuration

Create a `.env` file or pass environment variables:

| Variable                         | Required | Description                                                                          |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `REMNAWAVE_BASE_URL`             | Yes      | Panel URL (e.g. `https://vpn.example.com`)                                           |
| `REMNAWAVE_API_TOKEN`            | Yes      | API token from panel settings                                                        |
| `REMNAWAVE_RELEASE`              | No       | API release: exactly `v2` or `v3`; defaults to `v3`. Set `v2` for Remnawave 2.7.4.   |
| `REMNAWAVE_REQUEST_TIMEOUT_MS`   | No       | Outgoing API timeout in milliseconds; defaults to `30000`                            |
| `REMNAWAVE_API_KEY`              | No       | API key for Caddy reverse proxy authentication                                       |
| `REMNAWAVE_READONLY`             | No       | Set to `true` to enable readonly mode                                                |
| `CF_ACCESS_CLIENT_ID`            | No       | Cloudflare Access service-token client ID                                            |
| `CF_ACCESS_CLIENT_SECRET`        | No       | Cloudflare Access service-token client secret                                        |
| `MCP_HTTP_ENABLED`               | No       | Set to `true` to also serve MCP over HTTP                                            |
| `MCP_HTTP_HOST`                  | No       | HTTP bind address; defaults to `127.0.0.1`                                           |
| `MCP_HTTP_PORT`                  | No       | HTTP port; defaults to `3100`                                                        |
| `MCP_HTTP_AUTH_TOKEN`            | No       | Optional bearer token required on `/mcp`; no authentication is enforced when omitted |
| `MCP_HTTP_MAX_SESSIONS`          | No       | Maximum active HTTP MCP sessions; defaults to `100`                                  |
| `MCP_HTTP_SESSION_TTL_MS`        | No       | Idle session lifetime in milliseconds; defaults to `3600000`                         |
| `MCP_HTTP_REQUEST_TIMEOUT_MS`    | No       | Maximum request duration in milliseconds; defaults to `120000`                       |
| `MCP_HTTP_HEADERS_TIMEOUT_MS`    | No       | Maximum header-read duration in milliseconds; defaults to `30000`                    |
| `MCP_HTTP_KEEP_ALIVE_TIMEOUT_MS` | No       | Idle keep-alive timeout in milliseconds; defaults to `5000`                          |
| `MCP_HTTP_MAX_BODY_BYTES`        | No       | Largest declared MCP request body; defaults to `1048576` (1 MiB)                     |
| `MCP_HTTP_MAX_HEADER_SIZE_BYTES` | No       | Largest combined request header size; defaults to `16384` (16 KiB)                   |
| `MCP_HTTP_READINESS_TIMEOUT_MS`  | No       | Upstream panel health-check timeout in milliseconds; defaults to `5000`              |

```env
REMNAWAVE_BASE_URL=https://vpn.example.com
REMNAWAVE_API_TOKEN=your-api-token-here
REMNAWAVE_RELEASE=v3
REMNAWAVE_REQUEST_TIMEOUT_MS=30000
```

### Selecting an API Release

`v3` is the default and exposes 217 tools generated from the pinned Remnawave v3.4.3 OpenAPI snapshot. Tool names use `rw_v3_<operation_id>` in snake case and accept the documented `path`, `query`, and `body` values. Set `REMNAWAVE_RELEASE=v2` only for panels running the legacy 2.7.4 API; this preserves the established v2 tool names, resources, prompts, and behavior. One MCP process exposes exactly one release, so clients cannot accidentally mix v2 and v3 operations.

The snapshot, checksum, and generated operation manifests are in [`openapi/`](openapi). After deliberately updating the snapshot, regenerate the derived artifacts with `npm run openapi:v3:generate`; tests verify that every documented API operation has exactly one MCP tool.

### Caddy with Custom Path

If your Remnawave panel is deployed behind [Caddy with a custom path and API key protection](https://docs.remnawave.com/docs/security/caddy-with-custom-path/), set the base URL to include the custom path and provide the API key:

```env
REMNAWAVE_BASE_URL=https://example.com/your-secret-path/api
REMNAWAVE_API_KEY=your-caddy-api-key
```

The `X-Api-Key` header will be added to every request automatically.

### Cloudflare Access

For a panel protected by Cloudflare Access, configure a service token:

```env
CF_ACCESS_CLIENT_ID=your-client-id
CF_ACCESS_CLIENT_SECRET=your-client-secret
```

Both headers are attached to every Remnawave API request.

### HTTP transport

The server always supports `stdio`, for clients such as Claude Desktop. To also expose an MCP Streamable HTTP endpoint, set `MCP_HTTP_ENABLED=true`. The endpoint is `http://HOST:PORT/mcp`; a non-sensitive liveness probe is available at `/healthz`, and `/readyz` checks the authenticated panel health endpoint.

HTTP is bound to `127.0.0.1` by default. Do not expose this endpoint directly to the public internet: it can operate the panel using the configured Remnawave API token. Publish it through an authenticated reverse proxy when remote access is required. For built-in protection, set `MCP_HTTP_AUTH_TOKEN` and send `Authorization: Bearer <token>` on every `/mcp` request; `/healthz` intentionally remains public for orchestration probes. The token is optional for backwards compatibility, so external deployments should configure it or enforce equivalent proxy authentication.

HTTP sessions are capped and expire after inactivity. Requests, headers, keep-alive connections, and declared request bodies have configurable limits. `/healthz` reports that the MCP process is live; `/readyz` returns only `ok` or `unavailable` after probing the panel without exposing its response. Prometheus metrics are available from `/metrics`; it requires the same bearer token whenever `MCP_HTTP_AUTH_TOKEN` is configured.

### Readonly Mode

Set `REMNAWAVE_READONLY=true` to expose only tools backed by `GET` API operations. This excludes all mutation and action endpoints (create, update, delete, enable, disable, restart, revoke, reset), including safe-looking POST tester endpoints.

Useful for monitoring dashboards or shared environments where you want to prevent accidental changes.

For the v2 compatibility release, readonly mode reduces the available tools from 153 to 65:

| Category                       | Available tools                                                                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users (9)                      | `users_list`, `users_get`, `users_get_by_username`, `users_get_by_short_uuid`, `users_get_by_telegram_id`, `users_get_by_email`, `users_get_by_tag`, `users_get_by_subscription_uuid`, `users_tags_list` |
| Nodes (3)                      | `nodes_list`, `nodes_get`, `nodes_tags_list`                                                                                                                                                             |
| Hosts (3)                      | `hosts_list`, `hosts_get`, `hosts_tags_list`                                                                                                                                                             |
| System (9)                     | all GET tools; the POST-only `system_srr_matcher` is excluded                                                                                                                                            |
| Subscriptions (10)             | all tools (read-only by nature)                                                                                                                                                                          |
| Config Profiles & Inbounds (5) | `config_profiles_list`, `config_profiles_get`, `inbounds_list`, `config_profiles_get_inbounds`, `config_profiles_get_computed_config`                                                                    |
| Internal Squads (2)            | `squads_list`, `squads_accessible_nodes`                                                                                                                                                                 |
| HWID (4)                       | `hwid_devices_list`, `hwid_devices_list_all`, `hwid_stats`, `hwid_top_users`                                                                                                                             |
| API Tokens (1)                 | `api_tokens_list`                                                                                                                                                                                        |
| Keygen (1)                     | `keygen_get`                                                                                                                                                                                             |
| Infra Billing (4)              | `billing_providers_list`, `billing_provider_get`, `billing_nodes_list`, `billing_history_list`                                                                                                           |
| Snippets (1)                   | `snippets_list`                                                                                                                                                                                          |
| External Squads (2)            | `external_squads_list`, `external_squads_get`                                                                                                                                                            |
| Settings (1)                   | `settings_get`                                                                                                                                                                                           |
| Sub Page Configs (2)           | `sub_page_configs_list`, `sub_page_configs_get`                                                                                                                                                          |
| Node Plugins (4)               | `node_plugins_list`, `node_plugins_get`, `node_plugins_torrent_reports`, `node_plugins_torrent_stats`                                                                                                    |
| IP Control (2)                 | `ip_control_get_fetch_ips_result`, `ip_control_get_fetch_users_ips_result`                                                                                                                               |
| Metadata (2)                   | `metadata_node_get`, `metadata_user_get`                                                                                                                                                                 |

### Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
    "mcpServers": {
        "remnawave": {
            "command": "node",
            "args": ["/absolute/path/to/remnawave-mcp/dist/index.js"],
            "env": {
                "REMNAWAVE_BASE_URL": "https://vpn.example.com",
                "REMNAWAVE_API_TOKEN": "your-api-token-here",
                "REMNAWAVE_RELEASE": "v3",
                "REMNAWAVE_API_KEY": "your-caddy-api-key",
                "REMNAWAVE_READONLY": "false"
            }
        }
    }
}
```

### Usage with Cursor / Windsurf

Add to `.cursor/mcp.json` or `.windsurf/mcp.json` in your project:

```json
{
    "mcpServers": {
        "remnawave": {
            "command": "node",
            "args": ["/absolute/path/to/remnawave-mcp/dist/index.js"],
            "env": {
                "REMNAWAVE_BASE_URL": "https://vpn.example.com",
                "REMNAWAVE_API_TOKEN": "your-api-token-here",
                "REMNAWAVE_RELEASE": "v3",
                "REMNAWAVE_API_KEY": "your-caddy-api-key",
                "REMNAWAVE_READONLY": "false"
            }
        }
    }
}
```

### Docker

```bash
docker compose up -d
```

The image builds the application itself. Compose enables HTTP and maps it only to the host loopback interface; connect MCP clients to `http://127.0.0.1:3100/mcp`. Set `MCP_HTTP_AUTH_TOKEN` in `.env` when an HTTP client needs authentication. Environment variables are passed via `.env` file or `docker-compose.yml`.

### CI and releases

Every branch push and pull request runs type checking, tests, and a production dependency audit. A GitHub release is created only from an existing `vX.Y.Z` tag whose version matches `package.json`; it can also be started manually by selecting that existing tag in Actions. Published releases are immutable: the workflow refuses to overwrite one.

### Available Tools (v2.7.4 compatibility release)

#### Users (27 tools)

| Tool                               | Description                           | Mode  |
| ---------------------------------- | ------------------------------------- | ----- |
| `users_list`                       | List all users with pagination        | read  |
| `users_get`                        | Get user by UUID                      | read  |
| `users_get_by_username`            | Get user by username                  | read  |
| `users_get_by_short_uuid`          | Get user by short UUID                | read  |
| `users_get_by_telegram_id`         | Get user by Telegram ID               | read  |
| `users_get_by_email`               | Get user by email                     | read  |
| `users_get_by_tag`                 | Get user by tag                       | read  |
| `users_get_by_subscription_uuid`   | Get user by subscription UUID         | read  |
| `users_tags_list`                  | List all user tags                    | read  |
| `users_resolve`                    | Resolve users by multiple criteria    | read  |
| `users_create`                     | Create a new user                     | write |
| `users_update`                     | Update user settings                  | write |
| `users_delete`                     | Delete a user                         | write |
| `users_enable`                     | Enable a disabled user                | write |
| `users_disable`                    | Disable a user                        | write |
| `users_revoke_subscription`        | Revoke subscription (regenerate link) | write |
| `users_reset_traffic`              | Reset traffic counter                 | write |
| `users_bulk_delete_by_status`      | Bulk delete users by status           | write |
| `users_bulk_update`                | Bulk update users                     | write |
| `users_bulk_reset_traffic`         | Bulk reset traffic                    | write |
| `users_bulk_revoke_subscription`   | Bulk revoke subscriptions             | write |
| `users_bulk_delete`                | Bulk delete users                     | write |
| `users_bulk_update_squads`         | Bulk update user squads               | write |
| `users_bulk_extend_expiration`     | Bulk extend expiration dates          | write |
| `users_bulk_all_update`            | Bulk update all users                 | write |
| `users_bulk_all_reset_traffic`     | Bulk reset all users traffic          | write |
| `users_bulk_all_extend_expiration` | Bulk extend all users expiration      | write |

#### Nodes (15 tools)

| Tool                              | Description                | Mode  |
| --------------------------------- | -------------------------- | ----- |
| `nodes_list`                      | List all nodes             | read  |
| `nodes_get`                       | Get node by UUID           | read  |
| `nodes_tags_list`                 | List all node tags         | read  |
| `nodes_create`                    | Create a new node          | write |
| `nodes_update`                    | Update node settings       | write |
| `nodes_delete`                    | Delete a node              | write |
| `nodes_enable`                    | Enable a node              | write |
| `nodes_disable`                   | Disable a node             | write |
| `nodes_restart`                   | Restart a specific node    | write |
| `nodes_restart_all`               | Restart all nodes          | write |
| `nodes_reset_traffic`             | Reset node traffic counter | write |
| `nodes_reorder`                   | Reorder nodes              | write |
| `nodes_bulk_profile_modification` | Bulk modify node profiles  | write |
| `nodes_bulk_actions`              | Bulk node actions          | write |
| `nodes_bulk_update`               | Bulk update nodes          | write |

#### Hosts (11 tools)

| Tool                     | Description           | Mode  |
| ------------------------ | --------------------- | ----- |
| `hosts_list`             | List all hosts        | read  |
| `hosts_get`              | Get host by UUID      | read  |
| `hosts_tags_list`        | List all host tags    | read  |
| `hosts_create`           | Create a new host     | write |
| `hosts_update`           | Update host settings  | write |
| `hosts_delete`           | Delete a host         | write |
| `hosts_bulk_enable`      | Bulk enable hosts     | write |
| `hosts_bulk_disable`     | Bulk disable hosts    | write |
| `hosts_bulk_delete`      | Bulk delete hosts     | write |
| `hosts_bulk_set_inbound` | Bulk set host inbound | write |
| `hosts_bulk_set_port`    | Bulk set host port    | write |

#### System (10 tools)

| Tool                      | Description                                           | Mode |
| ------------------------- | ----------------------------------------------------- | ---- |
| `system_stats`            | Panel statistics (users, nodes, traffic, CPU, memory) | read |
| `system_bandwidth_stats`  | Bandwidth statistics                                  | read |
| `system_nodes_metrics`    | Node metrics                                          | read |
| `system_nodes_statistics` | Node statistics                                       | read |
| `system_health`           | Panel health check                                    | read |
| `system_metadata`         | Panel version and metadata                            | read |
| `system_generate_x25519`  | Generate X25519 key pair                              | read |
| `auth_status`             | Check authentication status                           | read |
| `system_stats_recap`      | System statistics recap                               | read |
| `system_srr_matcher`      | Test SRR routing rules                                | read |

#### Subscriptions (10 tools)

| Tool                                  | Description                        | Mode |
| ------------------------------------- | ---------------------------------- | ---- |
| `subscriptions_list`                  | List all subscriptions             | read |
| `subscriptions_get_by_uuid`           | Get subscription by UUID           | read |
| `subscriptions_get_by_username`       | Get subscription by username       | read |
| `subscriptions_get_by_short_uuid`     | Get subscription by short UUID     | read |
| `subscriptions_get_raw_by_short_uuid` | Get raw subscription by short UUID | read |
| `subscriptions_get_subpage_config`    | Get subscription subpage config    | read |
| `subscriptions_get_connection_keys`   | Get connection keys by UUID        | read |
| `subscription_info`                   | Get subscription info              | read |
| `subscription_request_history_list`   | Subscription request history       | read |
| `subscription_request_history_stats`  | Subscription request history stats | read |

#### Config Profiles & Inbounds (9 tools)

| Tool                                  | Description                         | Mode  |
| ------------------------------------- | ----------------------------------- | ----- |
| `config_profiles_list`                | List config profiles                | read  |
| `config_profiles_get`                 | Get config profile by UUID          | read  |
| `inbounds_list`                       | List all inbounds                   | read  |
| `config_profiles_get_inbounds`        | Get inbounds by profile UUID        | read  |
| `config_profiles_get_computed_config` | Get computed config by profile UUID | read  |
| `config_profiles_create`              | Create config profile               | write |
| `config_profiles_update`              | Update config profile               | write |
| `config_profiles_delete`              | Delete config profile               | write |
| `config_profiles_reorder`             | Reorder config profiles             | write |

#### Internal Squads (7 tools)

| Tool                      | Description                | Mode  |
| ------------------------- | -------------------------- | ----- |
| `squads_list`             | List all squads            | read  |
| `squads_accessible_nodes` | Get squad accessible nodes | read  |
| `squads_create`           | Create a squad             | write |
| `squads_update`           | Update a squad             | write |
| `squads_delete`           | Delete a squad             | write |
| `squads_add_users`        | Add users to a squad       | write |
| `squads_remove_users`     | Remove users from a squad  | write |

#### HWID Devices (7 tools)

| Tool                      | Description               | Mode  |
| ------------------------- | ------------------------- | ----- |
| `hwid_devices_list`       | List user's HWID devices  | read  |
| `hwid_devices_list_all`   | List all HWID devices     | read  |
| `hwid_stats`              | Get HWID statistics       | read  |
| `hwid_top_users`          | Get top users by devices  | read  |
| `hwid_device_create`      | Create HWID device        | write |
| `hwid_device_delete`      | Delete a specific device  | write |
| `hwid_devices_delete_all` | Delete all user's devices | write |

#### API Tokens (3 tools)

| Tool                | Description      | Mode  |
| ------------------- | ---------------- | ----- |
| `api_tokens_list`   | List API tokens  | read  |
| `api_tokens_create` | Create API token | write |
| `api_tokens_delete` | Delete API token | write |

#### Keygen (1 tool)

| Tool         | Description     | Mode |
| ------------ | --------------- | ---- |
| `keygen_get` | Get keygen data | read |

#### Infra Billing (12 tools)

| Tool                      | Description                  | Mode  |
| ------------------------- | ---------------------------- | ----- |
| `billing_providers_list`  | List billing providers       | read  |
| `billing_provider_get`    | Get billing provider by UUID | read  |
| `billing_nodes_list`      | List billing nodes           | read  |
| `billing_history_list`    | List billing history         | read  |
| `billing_provider_create` | Create billing provider      | write |
| `billing_provider_update` | Update billing provider      | write |
| `billing_provider_delete` | Delete billing provider      | write |
| `billing_node_create`     | Create billing node          | write |
| `billing_node_update`     | Update billing node          | write |
| `billing_node_delete`     | Delete billing node          | write |
| `billing_history_create`  | Create billing history entry | write |
| `billing_history_delete`  | Delete billing history entry | write |

#### Snippets (4 tools)

| Tool              | Description    | Mode  |
| ----------------- | -------------- | ----- |
| `snippets_list`   | List snippets  | read  |
| `snippets_create` | Create snippet | write |
| `snippets_update` | Update snippet | write |
| `snippets_delete` | Delete snippet | write |

#### External Squads (8 tools)

| Tool                           | Description                      | Mode  |
| ------------------------------ | -------------------------------- | ----- |
| `external_squads_list`         | List external squads             | read  |
| `external_squads_get`          | Get external squad by UUID       | read  |
| `external_squads_create`       | Create external squad            | write |
| `external_squads_update`       | Update external squad            | write |
| `external_squads_delete`       | Delete external squad            | write |
| `external_squads_add_users`    | Add users to external squad      | write |
| `external_squads_remove_users` | Remove users from external squad | write |
| `external_squads_reorder`      | Reorder external squads          | write |

#### Settings (2 tools)

| Tool              | Description           | Mode  |
| ----------------- | --------------------- | ----- |
| `settings_get`    | Get panel settings    | read  |
| `settings_update` | Update panel settings | write |

#### Subscription Page Configs (7 tools)

| Tool                       | Description                       | Mode  |
| -------------------------- | --------------------------------- | ----- |
| `sub_page_configs_list`    | List subscription page configs    | read  |
| `sub_page_configs_get`     | Get subscription page config      | read  |
| `sub_page_configs_create`  | Create subscription page config   | write |
| `sub_page_configs_update`  | Update subscription page config   | write |
| `sub_page_configs_delete`  | Delete subscription page config   | write |
| `sub_page_configs_reorder` | Reorder subscription page configs | write |
| `sub_page_configs_clone`   | Clone subscription page config    | write |

#### Node Plugins (11 tools)

| Tool                            | Description                      | Mode  |
| ------------------------------- | -------------------------------- | ----- |
| `node_plugins_list`             | List node plugins                | read  |
| `node_plugins_get`              | Get node plugin by UUID          | read  |
| `node_plugins_torrent_reports`  | Get torrent blocker reports      | read  |
| `node_plugins_torrent_stats`    | Get torrent blocker stats        | read  |
| `node_plugins_create`           | Create node plugin               | write |
| `node_plugins_update`           | Update node plugin               | write |
| `node_plugins_delete`           | Delete node plugin               | write |
| `node_plugins_reorder`          | Reorder node plugins             | write |
| `node_plugins_clone`            | Clone node plugin                | write |
| `node_plugins_execute`          | Execute node plugin              | write |
| `node_plugins_torrent_truncate` | Truncate torrent blocker reports | write |

#### IP Control (5 tools)

| Tool                                    | Description                    | Mode  |
| --------------------------------------- | ------------------------------ | ----- |
| `ip_control_fetch_ips`                  | Fetch IPs for a user           | read  |
| `ip_control_get_fetch_ips_result`       | Get fetch IPs job result       | read  |
| `ip_control_fetch_users_ips`            | Fetch users IPs on a node      | read  |
| `ip_control_get_fetch_users_ips_result` | Get fetch users IPs job result | read  |
| `ip_control_drop_connections`           | Drop user connections          | write |

#### Metadata (4 tools)

| Tool                   | Description          | Mode  |
| ---------------------- | -------------------- | ----- |
| `metadata_node_get`    | Get node metadata    | read  |
| `metadata_user_get`    | Get user metadata    | read  |
| `metadata_node_upsert` | Upsert node metadata | write |
| `metadata_user_upsert` | Upsert user metadata | write |

### Resources

| URI                        | Description              |
| -------------------------- | ------------------------ |
| `remnawave://stats`        | Current panel statistics |
| `remnawave://nodes`        | All nodes status         |
| `remnawave://health`       | Panel health status      |
| `remnawave://users/{uuid}` | Specific user details    |

### Prompts

| Prompt               | Description                      |
| -------------------- | -------------------------------- |
| `create_user_wizard` | Step-by-step user creation guide |
| `node_diagnostics`   | Node troubleshooting             |
| `traffic_report`     | Traffic usage report             |
| `user_audit`         | Complete user audit              |
| `bulk_user_cleanup`  | Find and manage expired users    |

### Example Queries

```
"Show me all users with expired subscriptions"
"Create user vasya with 50 GB limit for one month"
"Restart node amsterdam-01"
"Give me a traffic report for the last week"
"Disable users who exceeded their traffic limit"
"Which nodes are offline right now?"
"Show billing history"
"List all node plugins"
"Get IP connections for user X"
```

### Project Structure

```
src/
├── index.ts                       # Entry point (stdio transport)
├── server.ts                      # McpServer setup
├── config.ts                      # Environment config
├── client/
│   └── index.ts                   # Remnawave HTTP client
├── tools/
│   ├── helpers.ts                 # Result formatting helpers
│   ├── index.ts                   # Tool registration
│   ├── users.ts                   # User management (27 tools)
│   ├── nodes.ts                   # Node management (15 tools)
│   ├── hosts.ts                   # Host management (11 tools)
│   ├── system.ts                  # System & auth (10 tools)
│   ├── subscriptions.ts           # Subscriptions (10 tools)
│   ├── inbounds.ts                # Config profiles & inbounds (9 tools)
│   ├── squads.ts                  # Internal squads (7 tools)
│   ├── hwid.ts                    # HWID devices (7 tools)
│   ├── infra-billing.ts           # Infrastructure billing (12 tools)
│   ├── node-plugins.ts            # Node plugins (11 tools)
│   ├── external-squads.ts         # External squads (8 tools)
│   ├── subscription-page-configs.ts # Subscription page configs (7 tools)
│   ├── ip-control.ts              # IP control (5 tools)
│   ├── snippets.ts                # Snippets (4 tools)
│   ├── metadata.ts                # Node & user metadata (4 tools)
│   ├── api-tokens.ts              # API tokens (3 tools)
│   ├── settings.ts                # Panel settings (2 tools)
│   └── keygen.ts                  # Keygen (1 tool)
├── resources/
│   └── index.ts                   # MCP resources
└── prompts/
    └── index.ts                   # MCP prompts
```

### License

MIT

---

<a id="русский"></a>

## MCP-сервер для Remnawave Panel

MCP-сервер ([Model Context Protocol](https://modelcontextprotocol.io)), предоставляющий LLM-клиентам (Claude Desktop, Cursor, Windsurf и др.) инструменты для управления VPN-панелью [Remnawave](https://github.com/remnawave/).

**Версия:** 1.3.1 | **Remnawave API:** OpenAPI-снапшот v3.4.3 по умолчанию; режим совместимости v2.7.4

### Возможности

- **Полное покрытие API v3** — 217 MCP-инструментов генерируются из закреплённого официального OpenAPI-снапшота v3.4.3
- **Совместимость с v2.7.4** — прежний MCP-интерфейс из 153 инструментов доступен при явном выборе релиза
- **Ресурсы и промпты совместимости v2** — для старых панелей сохранены 4 динамических ресурса и 5 пошаговых сценариев
- **Readonly-режим** — безопасная регистрация инструментов только для чтения для выбранного релиза
- **Поддержка Caddy** — заголовок `X-Api-Key` для панелей за Caddy с кастомным путём
- **Типобезопасность** — v2 использует [@remnawave/backend-contract](https://www.npmjs.com/package/@remnawave/backend-contract), а инструменты v3 строятся из закреплённого OpenAPI-контракта
- **stdio и HTTP транспорты** — локальные клиенты и Streamable HTTP на `/mcp`

### Требования

- Node.js 22.22.3
- Remnawave панель с API-токеном (Настройки > API Tokens)

### Установка

```bash
git clone https://github.com/TrackLine/mcp-remnawave.git
cd mcp-remnawave
npm install
npm run build
```

### Конфигурация

Создайте файл `.env` или передайте переменные окружения:

| Переменная                       | Обязательная | Описание                                                                                        |
| -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `REMNAWAVE_BASE_URL`             | Да           | URL панели (например `https://vpn.example.com`)                                                 |
| `REMNAWAVE_API_TOKEN`            | Да           | API-токен из настроек панели                                                                    |
| `REMNAWAVE_RELEASE`              | Нет          | Релиз API: строго `v2` или `v3`; по умолчанию `v3`. Для Remnawave 2.7.4 установите `v2`.        |
| `REMNAWAVE_REQUEST_TIMEOUT_MS`   | Нет          | Таймаут исходящих API-запросов в миллисекундах; по умолчанию `30000`                            |
| `REMNAWAVE_API_KEY`              | Нет          | API-ключ для аутентификации через Caddy reverse proxy                                           |
| `REMNAWAVE_READONLY`             | Нет          | `true` для включения режима только чтения                                                       |
| `CF_ACCESS_CLIENT_ID`            | Нет          | Client ID сервисного токена Cloudflare Access                                                   |
| `CF_ACCESS_CLIENT_SECRET`        | Нет          | Client secret сервисного токена Cloudflare Access                                               |
| `MCP_HTTP_ENABLED`               | Нет          | `true` для одновременного запуска MCP по HTTP                                                   |
| `MCP_HTTP_HOST`                  | Нет          | Адрес привязки HTTP; по умолчанию `127.0.0.1`                                                   |
| `MCP_HTTP_PORT`                  | Нет          | HTTP-порт; по умолчанию `3100`                                                                  |
| `MCP_HTTP_AUTH_TOKEN`            | Нет          | Необязательный bearer-токен для `/mcp`; если не задан, встроенная аутентификация не применяется |
| `MCP_HTTP_MAX_SESSIONS`          | Нет          | Максимум активных HTTP MCP-сессий; по умолчанию `100`                                           |
| `MCP_HTTP_SESSION_TTL_MS`        | Нет          | Время жизни неактивной сессии в миллисекундах; по умолчанию `3600000`                           |
| `MCP_HTTP_REQUEST_TIMEOUT_MS`    | Нет          | Максимальная длительность запроса в миллисекундах; по умолчанию `120000`                        |
| `MCP_HTTP_HEADERS_TIMEOUT_MS`    | Нет          | Максимальное время чтения заголовков в миллисекундах; по умолчанию `30000`                      |
| `MCP_HTTP_KEEP_ALIVE_TIMEOUT_MS` | Нет          | Таймаут неактивного keep-alive соединения в миллисекундах; по умолчанию `5000`                  |
| `MCP_HTTP_MAX_BODY_BYTES`        | Нет          | Максимальный заявленный размер тела MCP-запроса; по умолчанию `1048576` (1 MiB)                 |
| `MCP_HTTP_MAX_HEADER_SIZE_BYTES` | Нет          | Максимальный суммарный размер заголовков запроса; по умолчанию `16384` (16 KiB)                 |
| `MCP_HTTP_READINESS_TIMEOUT_MS`  | Нет          | Таймаут проверки доступности панели в миллисекундах; по умолчанию `5000`                        |

```env
REMNAWAVE_BASE_URL=https://vpn.example.com
REMNAWAVE_API_TOKEN=ваш-api-токен
REMNAWAVE_RELEASE=v3
REMNAWAVE_REQUEST_TIMEOUT_MS=30000
```

### Выбор релиза API

`v3` используется по умолчанию и предоставляет 217 инструментов, сгенерированных из закреплённого OpenAPI-снапшота Remnawave v3.4.3. Имена имеют формат `rw_v3_<operation_id>` в snake case; аргументы соответствуют документированным `path`, `query` и `body`. Устанавливайте `REMNAWAVE_RELEASE=v2` только для панелей со старым API 2.7.4: так сохраняются прежние имена инструментов, ресурсы, промпты и поведение v2. Один процесс MCP обслуживает только один релиз, поэтому операции v2 и v3 нельзя случайно смешать.

Снапшот, контрольная сумма и сгенерированные манифесты операций находятся в [`openapi/`](openapi). После намеренного обновления снапшота выполните `npm run openapi:v3:generate`; тесты проверяют, что каждой операции API из документации соответствует ровно один MCP-инструмент.

### Caddy с кастомным путём

Если ваша панель Remnawave развёрнута за [Caddy с кастомным путём и защитой API-ключом](https://docs.remnawave.com/docs/security/caddy-with-custom-path/), укажите полный путь в base URL и предоставьте API-ключ:

```env
REMNAWAVE_BASE_URL=https://example.com/your-secret-path/api
REMNAWAVE_API_KEY=ваш-caddy-api-ключ
```

Заголовок `X-Api-Key` будет автоматически добавляться к каждому запросу.

### Cloudflare Access

Для панели, защищённой Cloudflare Access, настройте сервисный токен:

```env
CF_ACCESS_CLIENT_ID=ваш-client-id
CF_ACCESS_CLIENT_SECRET=ваш-client-secret
```

Оба заголовка добавляются к каждому запросу к Remnawave API.

### HTTP-транспорт

Сервер всегда поддерживает `stdio` для клиентов вроде Claude Desktop. Чтобы также открыть MCP Streamable HTTP endpoint, установите `MCP_HTTP_ENABLED=true`. Endpoint: `http://HOST:PORT/mcp`; для liveness-проверки доступен не содержащий секретов `GET /healthz`, а `/readyz` проверяет аутентифицированный health endpoint панели.

По умолчанию HTTP привязан к `127.0.0.1`. Не публикуйте endpoint напрямую в интернете: через него можно управлять панелью с настроенным API-токеном Remnawave. Для удалённого доступа используйте reverse proxy с аутентификацией. Для встроенной защиты задайте `MCP_HTTP_AUTH_TOKEN` и передавайте `Authorization: Bearer <token>` в каждом запросе к `/mcp`; `/healthz` намеренно остаётся публичным для оркестратора. Токен необязателен ради обратной совместимости, поэтому для внешних развёртываний его следует задать либо обеспечить эквивалентную аутентификацию в proxy.

Количество HTTP-сессий ограничено, а неактивные сессии истекают. Для запросов, заголовков, keep-alive соединений и заявленного размера тела действуют настраиваемые лимиты. `/healthz` проверяет, что процесс MCP запущен; `/readyz` возвращает только `ok` или `unavailable` после проверки панели без раскрытия её ответа. Prometheus-метрики доступны на `/metrics`; при заданной `MCP_HTTP_AUTH_TOKEN` для них требуется тот же bearer-токен.

### Режим Readonly

Установите `REMNAWAVE_READONLY=true`, чтобы зарегистрировать только инструменты, использующие API-операции `GET`. Это исключает все операции изменения и действий (создание, обновление, удаление, включение, отключение, перезапуск, отзыв, сброс), в том числе безопасно выглядящие POST-тестеры.

Полезно для мониторинговых дашбордов или общих окружений, где нужно исключить случайные изменения.

Для режима совместимости v2 readonly сокращает количество доступных инструментов с 153 до 65:

| Категория                     | Доступные инструменты                                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Пользователи (9)              | `users_list`, `users_get`, `users_get_by_username`, `users_get_by_short_uuid`, `users_get_by_telegram_id`, `users_get_by_email`, `users_get_by_tag`, `users_get_by_subscription_uuid`, `users_tags_list` |
| Ноды (3)                      | `nodes_list`, `nodes_get`, `nodes_tags_list`                                                                                                                                                             |
| Хосты (3)                     | `hosts_list`, `hosts_get`, `hosts_tags_list`                                                                                                                                                             |
| Система (9)                   | все GET-инструменты; POST-инструмент `system_srr_matcher` исключён                                                                                                                                       |
| Подписки (10)                 | все инструменты (только чтение по природе)                                                                                                                                                               |
| Конфиг-профили и Inbounds (5) | `config_profiles_list`, `config_profiles_get`, `inbounds_list`, `config_profiles_get_inbounds`, `config_profiles_get_computed_config`                                                                    |
| Внутренние группы (2)         | `squads_list`, `squads_accessible_nodes`                                                                                                                                                                 |
| HWID (4)                      | `hwid_devices_list`, `hwid_devices_list_all`, `hwid_stats`, `hwid_top_users`                                                                                                                             |
| API-токены (1)                | `api_tokens_list`                                                                                                                                                                                        |
| Keygen (1)                    | `keygen_get`                                                                                                                                                                                             |
| Биллинг (4)                   | `billing_providers_list`, `billing_provider_get`, `billing_nodes_list`, `billing_history_list`                                                                                                           |
| Сниппеты (1)                  | `snippets_list`                                                                                                                                                                                          |
| Внешние группы (2)            | `external_squads_list`, `external_squads_get`                                                                                                                                                            |
| Настройки (1)                 | `settings_get`                                                                                                                                                                                           |
| Страницы подписок (2)         | `sub_page_configs_list`, `sub_page_configs_get`                                                                                                                                                          |
| Плагины нод (4)               | `node_plugins_list`, `node_plugins_get`, `node_plugins_torrent_reports`, `node_plugins_torrent_stats`                                                                                                    |
| IP-контроль (2)               | `ip_control_get_fetch_ips_result`, `ip_control_get_fetch_users_ips_result`                                                                                                                               |
| Метаданные (2)                | `metadata_node_get`, `metadata_user_get`                                                                                                                                                                 |

### Использование с Claude Desktop

Добавьте в конфигурацию Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` на macOS):

```json
{
    "mcpServers": {
        "remnawave": {
            "command": "node",
            "args": ["/абсолютный/путь/к/remnawave-mcp/dist/index.js"],
            "env": {
                "REMNAWAVE_BASE_URL": "https://vpn.example.com",
                "REMNAWAVE_API_TOKEN": "ваш-api-токен",
                "REMNAWAVE_RELEASE": "v3",
                "REMNAWAVE_API_KEY": "ваш-caddy-api-ключ",
                "REMNAWAVE_READONLY": "false"
            }
        }
    }
}
```

### Использование с Cursor / Windsurf

Добавьте в `.cursor/mcp.json` или `.windsurf/mcp.json` вашего проекта:

```json
{
    "mcpServers": {
        "remnawave": {
            "command": "node",
            "args": ["/абсолютный/путь/к/remnawave-mcp/dist/index.js"],
            "env": {
                "REMNAWAVE_BASE_URL": "https://vpn.example.com",
                "REMNAWAVE_API_TOKEN": "ваш-api-токен",
                "REMNAWAVE_RELEASE": "v3",
                "REMNAWAVE_API_KEY": "ваш-caddy-api-ключ",
                "REMNAWAVE_READONLY": "false"
            }
        }
    }
}
```

### Docker

```bash
docker compose up -d
```

Образ сам собирает приложение. Compose включает HTTP и публикует его только на loopback интерфейсе хоста; подключайте MCP-клиент к `http://127.0.0.1:3100/mcp`. Если HTTP-клиент должен аутентифицироваться, задайте `MCP_HTTP_AUTH_TOKEN` в `.env`. Переменные окружения передаются через `.env` файл или `docker-compose.yml`.

### CI и релизы

Для каждого push в ветку и pull request запускаются typecheck, тесты и аудит production-зависимостей. GitHub Release создаётся только из существующего тега `vX.Y.Z`, версия которого совпадает с `package.json`; его также можно вручную запустить в Actions, выбрав этот существующий тег. Опубликованные релизы неизменяемы: workflow откажется их перезаписывать.

### Доступные инструменты (режим совместимости v2.7.4)

#### Пользователи (27 инструментов)

| Инструмент                         | Описание                                    | Режим |
| ---------------------------------- | ------------------------------------------- | ----- |
| `users_list`                       | Список пользователей с пагинацией           | read  |
| `users_get`                        | Получить пользователя по UUID               | read  |
| `users_get_by_username`            | Получить пользователя по username           | read  |
| `users_get_by_short_uuid`          | Получить пользователя по short UUID         | read  |
| `users_get_by_telegram_id`         | Получить пользователя по Telegram ID        | read  |
| `users_get_by_email`               | Получить пользователя по email              | read  |
| `users_get_by_tag`                 | Получить пользователя по тегу               | read  |
| `users_get_by_subscription_uuid`   | Получить пользователя по UUID подписки      | read  |
| `users_tags_list`                  | Список тегов пользователей                  | read  |
| `users_resolve`                    | Поиск пользователей по нескольким критериям | read  |
| `users_create`                     | Создать нового пользователя                 | write |
| `users_update`                     | Обновить настройки пользователя             | write |
| `users_delete`                     | Удалить пользователя                        | write |
| `users_enable`                     | Включить пользователя                       | write |
| `users_disable`                    | Отключить пользователя                      | write |
| `users_revoke_subscription`        | Отозвать подписку (перегенерировать ссылку) | write |
| `users_reset_traffic`              | Сбросить счётчик трафика                    | write |
| `users_bulk_delete_by_status`      | Массовое удаление по статусу                | write |
| `users_bulk_update`                | Массовое обновление                         | write |
| `users_bulk_reset_traffic`         | Массовый сброс трафика                      | write |
| `users_bulk_revoke_subscription`   | Массовый отзыв подписок                     | write |
| `users_bulk_delete`                | Массовое удаление                           | write |
| `users_bulk_update_squads`         | Массовое обновление групп                   | write |
| `users_bulk_extend_expiration`     | Массовое продление срока                    | write |
| `users_bulk_all_update`            | Обновить всех пользователей                 | write |
| `users_bulk_all_reset_traffic`     | Сбросить трафик всех пользователей          | write |
| `users_bulk_all_extend_expiration` | Продлить срок всех пользователей            | write |

#### Ноды (15 инструментов)

| Инструмент                        | Описание                        | Режим |
| --------------------------------- | ------------------------------- | ----- |
| `nodes_list`                      | Список всех нод                 | read  |
| `nodes_get`                       | Получить ноду по UUID           | read  |
| `nodes_tags_list`                 | Список тегов нод                | read  |
| `nodes_create`                    | Создать новую ноду              | write |
| `nodes_update`                    | Обновить настройки ноды         | write |
| `nodes_delete`                    | Удалить ноду                    | write |
| `nodes_enable`                    | Включить ноду                   | write |
| `nodes_disable`                   | Отключить ноду                  | write |
| `nodes_restart`                   | Перезапустить ноду              | write |
| `nodes_restart_all`               | Перезапустить все ноды          | write |
| `nodes_reset_traffic`             | Сбросить трафик ноды            | write |
| `nodes_reorder`                   | Переупорядочить ноды            | write |
| `nodes_bulk_profile_modification` | Массовое изменение профилей нод | write |
| `nodes_bulk_actions`              | Массовые действия с нодами      | write |
| `nodes_bulk_update`               | Массовое обновление нод         | write |

#### Хосты (11 инструментов)

| Инструмент               | Описание                   | Режим |
| ------------------------ | -------------------------- | ----- |
| `hosts_list`             | Список всех хостов         | read  |
| `hosts_get`              | Получить хост по UUID      | read  |
| `hosts_tags_list`        | Список тегов хостов        | read  |
| `hosts_create`           | Создать новый хост         | write |
| `hosts_update`           | Обновить настройки хоста   | write |
| `hosts_delete`           | Удалить хост               | write |
| `hosts_bulk_enable`      | Массовое включение хостов  | write |
| `hosts_bulk_disable`     | Массовое отключение хостов | write |
| `hosts_bulk_delete`      | Массовое удаление хостов   | write |
| `hosts_bulk_set_inbound` | Массовая установка inbound | write |
| `hosts_bulk_set_port`    | Массовая установка порта   | write |

#### Система (10 инструментов)

| Инструмент                | Описание                                                    | Режим |
| ------------------------- | ----------------------------------------------------------- | ----- |
| `system_stats`            | Статистика панели (пользователи, ноды, трафик, CPU, память) | read  |
| `system_bandwidth_stats`  | Статистика пропускной способности                           | read  |
| `system_nodes_metrics`    | Метрики нод                                                 | read  |
| `system_nodes_statistics` | Статистика нод                                              | read  |
| `system_health`           | Проверка здоровья панели                                    | read  |
| `system_metadata`         | Версия и метаданные панели                                  | read  |
| `system_generate_x25519`  | Генерация пары ключей X25519                                | read  |
| `auth_status`             | Проверка статуса аутентификации                             | read  |
| `system_stats_recap`      | Обзор статистики                                            | read  |
| `system_srr_matcher`      | Тест SRR-правил маршрутизации                               | read  |

#### Подписки (10 инструментов)

| Инструмент                            | Описание                     | Режим |
| ------------------------------------- | ---------------------------- | ----- |
| `subscriptions_list`                  | Список всех подписок         | read  |
| `subscriptions_get_by_uuid`           | Подписка по UUID             | read  |
| `subscriptions_get_by_username`       | Подписка по username         | read  |
| `subscriptions_get_by_short_uuid`     | Подписка по short UUID       | read  |
| `subscriptions_get_raw_by_short_uuid` | Сырая подписка по short UUID | read  |
| `subscriptions_get_subpage_config`    | Конфиг субстраницы подписки  | read  |
| `subscriptions_get_connection_keys`   | Ключи подключения по UUID    | read  |
| `subscription_info`                   | Информация о подписке        | read  |
| `subscription_request_history_list`   | История запросов подписок    | read  |
| `subscription_request_history_stats`  | Статистика запросов подписок | read  |

#### Конфиг-профили и Inbounds (9 инструментов)

| Инструмент                            | Описание                           | Режим |
| ------------------------------------- | ---------------------------------- | ----- |
| `config_profiles_list`                | Список конфиг-профилей             | read  |
| `config_profiles_get`                 | Получить конфиг-профиль по UUID    | read  |
| `inbounds_list`                       | Список всех inbounds               | read  |
| `config_profiles_get_inbounds`        | Inbounds по UUID профиля           | read  |
| `config_profiles_get_computed_config` | Вычисленный конфиг по UUID профиля | read  |
| `config_profiles_create`              | Создать конфиг-профиль             | write |
| `config_profiles_update`              | Обновить конфиг-профиль            | write |
| `config_profiles_delete`              | Удалить конфиг-профиль             | write |
| `config_profiles_reorder`             | Переупорядочить конфиг-профили     | write |

#### Внутренние группы (7 инструментов)

| Инструмент                | Описание                        | Режим |
| ------------------------- | ------------------------------- | ----- |
| `squads_list`             | Список групп                    | read  |
| `squads_accessible_nodes` | Доступные ноды группы           | read  |
| `squads_create`           | Создать группу                  | write |
| `squads_update`           | Обновить группу                 | write |
| `squads_delete`           | Удалить группу                  | write |
| `squads_add_users`        | Добавить пользователей в группу | write |
| `squads_remove_users`     | Убрать пользователей из группы  | write |

#### HWID-устройства (7 инструментов)

| Инструмент                | Описание                            | Режим |
| ------------------------- | ----------------------------------- | ----- |
| `hwid_devices_list`       | Список устройств пользователя       | read  |
| `hwid_devices_list_all`   | Список всех устройств               | read  |
| `hwid_stats`              | Статистика HWID                     | read  |
| `hwid_top_users`          | Топ пользователей по устройствам    | read  |
| `hwid_device_create`      | Создать HWID-устройство             | write |
| `hwid_device_delete`      | Удалить конкретное устройство       | write |
| `hwid_devices_delete_all` | Удалить все устройства пользователя | write |

#### API-токены (3 инструмента)

| Инструмент          | Описание           | Режим |
| ------------------- | ------------------ | ----- |
| `api_tokens_list`   | Список API-токенов | read  |
| `api_tokens_create` | Создать API-токен  | write |
| `api_tokens_delete` | Удалить API-токен  | write |

#### Keygen (1 инструмент)

| Инструмент   | Описание               | Режим |
| ------------ | ---------------------- | ----- |
| `keygen_get` | Получить данные keygen | read  |

#### Биллинг инфраструктуры (12 инструментов)

| Инструмент                | Описание                    | Режим |
| ------------------------- | --------------------------- | ----- |
| `billing_providers_list`  | Список провайдеров биллинга | read  |
| `billing_provider_get`    | Получить провайдера по UUID | read  |
| `billing_nodes_list`      | Список биллинговых нод      | read  |
| `billing_history_list`    | История биллинга            | read  |
| `billing_provider_create` | Создать провайдера          | write |
| `billing_provider_update` | Обновить провайдера         | write |
| `billing_provider_delete` | Удалить провайдера          | write |
| `billing_node_create`     | Создать биллинговую ноду    | write |
| `billing_node_update`     | Обновить биллинговую ноду   | write |
| `billing_node_delete`     | Удалить биллинговую ноду    | write |
| `billing_history_create`  | Создать запись истории      | write |
| `billing_history_delete`  | Удалить запись истории      | write |

#### Сниппеты (4 инструмента)

| Инструмент        | Описание         | Режим |
| ----------------- | ---------------- | ----- |
| `snippets_list`   | Список сниппетов | read  |
| `snippets_create` | Создать сниппет  | write |
| `snippets_update` | Обновить сниппет | write |
| `snippets_delete` | Удалить сниппет  | write |

#### Внешние группы (8 инструментов)

| Инструмент                     | Описание                        | Режим |
| ------------------------------ | ------------------------------- | ----- |
| `external_squads_list`         | Список внешних групп            | read  |
| `external_squads_get`          | Получить внешнюю группу по UUID | read  |
| `external_squads_create`       | Создать внешнюю группу          | write |
| `external_squads_update`       | Обновить внешнюю группу         | write |
| `external_squads_delete`       | Удалить внешнюю группу          | write |
| `external_squads_add_users`    | Добавить пользователей          | write |
| `external_squads_remove_users` | Убрать пользователей            | write |
| `external_squads_reorder`      | Переупорядочить                 | write |

#### Настройки (2 инструмента)

| Инструмент        | Описание                  | Режим |
| ----------------- | ------------------------- | ----- |
| `settings_get`    | Получить настройки панели | read  |
| `settings_update` | Обновить настройки панели | write |

#### Страницы подписок (7 инструментов)

| Инструмент                 | Описание                 | Режим |
| -------------------------- | ------------------------ | ----- |
| `sub_page_configs_list`    | Список конфигов страниц  | read  |
| `sub_page_configs_get`     | Получить конфиг страницы | read  |
| `sub_page_configs_create`  | Создать конфиг страницы  | write |
| `sub_page_configs_update`  | Обновить конфиг страницы | write |
| `sub_page_configs_delete`  | Удалить конфиг страницы  | write |
| `sub_page_configs_reorder` | Переупорядочить          | write |
| `sub_page_configs_clone`   | Клонировать конфиг       | write |

#### Плагины нод (11 инструментов)

| Инструмент                      | Описание                             | Режим |
| ------------------------------- | ------------------------------------ | ----- |
| `node_plugins_list`             | Список плагинов                      | read  |
| `node_plugins_get`              | Получить плагин по UUID              | read  |
| `node_plugins_torrent_reports`  | Отчёты торрент-блокировщика          | read  |
| `node_plugins_torrent_stats`    | Статистика торрент-блокировщика      | read  |
| `node_plugins_create`           | Создать плагин                       | write |
| `node_plugins_update`           | Обновить плагин                      | write |
| `node_plugins_delete`           | Удалить плагин                       | write |
| `node_plugins_reorder`          | Переупорядочить плагины              | write |
| `node_plugins_clone`            | Клонировать плагин                   | write |
| `node_plugins_execute`          | Выполнить плагин                     | write |
| `node_plugins_torrent_truncate` | Очистить отчёты торрент-блокировщика | write |

#### IP-контроль (5 инструментов)

| Инструмент                              | Описание                           | Режим |
| --------------------------------------- | ---------------------------------- | ----- |
| `ip_control_fetch_ips`                  | Получить IP пользователя           | read  |
| `ip_control_get_fetch_ips_result`       | Результат запроса IP               | read  |
| `ip_control_fetch_users_ips`            | Получить IP пользователей на ноде  | read  |
| `ip_control_get_fetch_users_ips_result` | Результат запроса IP пользователей | read  |
| `ip_control_drop_connections`           | Сбросить соединения                | write |

#### Метаданные (4 инструмента)

| Инструмент             | Описание                         | Режим |
| ---------------------- | -------------------------------- | ----- |
| `metadata_node_get`    | Получить метаданные ноды         | read  |
| `metadata_user_get`    | Получить метаданные пользователя | read  |
| `metadata_node_upsert` | Обновить метаданные ноды         | write |
| `metadata_user_upsert` | Обновить метаданные пользователя | write |

### Ресурсы

| URI                        | Описание                        |
| -------------------------- | ------------------------------- |
| `remnawave://stats`        | Текущая статистика панели       |
| `remnawave://nodes`        | Статус всех нод                 |
| `remnawave://health`       | Состояние здоровья панели       |
| `remnawave://users/{uuid}` | Данные конкретного пользователя |

### Промпты

| Промпт               | Описание                                        |
| -------------------- | ----------------------------------------------- |
| `create_user_wizard` | Пошаговое создание пользователя                 |
| `node_diagnostics`   | Диагностика ноды                                |
| `traffic_report`     | Отчёт по трафику                                |
| `user_audit`         | Полный аудит пользователя                       |
| `bulk_user_cleanup`  | Поиск и управление просроченными пользователями |

### Примеры запросов

```
«Покажи мне всех пользователей с истёкшей подпиской»
«Создай пользователя vasya с лимитом 50 ГБ на месяц»
«Перезапусти ноду amsterdam-01»
«Дай отчёт по трафику за последнюю неделю»
«Отключи пользователей, которые превысили лимит трафика»
«Какие ноды сейчас офлайн?»
«Покажи историю биллинга»
«Список плагинов нод»
«Получи IP-соединения пользователя X»
```

### Структура проекта

```
src/
├── index.ts                       # Точка входа (stdio транспорт)
├── server.ts                      # Настройка McpServer
├── config.ts                      # Конфигурация окружения
├── client/
│   └── index.ts                   # HTTP-клиент Remnawave
├── tools/
│   ├── helpers.ts                 # Хелперы форматирования
│   ├── index.ts                   # Регистрация инструментов
│   ├── users.ts                   # Управление пользователями (27)
│   ├── nodes.ts                   # Управление нодами (15)
│   ├── hosts.ts                   # Управление хостами (11)
│   ├── system.ts                  # Система и авторизация (10)
│   ├── subscriptions.ts           # Подписки (10)
│   ├── inbounds.ts                # Конфиг-профили и inbounds (9)
│   ├── squads.ts                  # Внутренние группы (7)
│   ├── hwid.ts                    # HWID-устройства (7)
│   ├── infra-billing.ts           # Биллинг инфраструктуры (12)
│   ├── node-plugins.ts            # Плагины нод (11)
│   ├── external-squads.ts         # Внешние группы (8)
│   ├── subscription-page-configs.ts # Страницы подписок (7)
│   ├── ip-control.ts              # IP-контроль (5)
│   ├── snippets.ts                # Сниппеты (4)
│   ├── metadata.ts                # Метаданные нод и пользователей (4)
│   ├── api-tokens.ts              # API-токены (3)
│   ├── settings.ts                # Настройки панели (2)
│   └── keygen.ts                  # Keygen (1)
├── resources/
│   └── index.ts                   # MCP-ресурсы
└── prompts/
    └── index.ts                   # MCP-промпты
```

### Лицензия

MIT
