# mcp-remnawave

[English](#english) | [Русский](#русский)

---

<a id="english"></a>

## MCP Server for Remnawave Panel

MCP server ([Model Context Protocol](https://modelcontextprotocol.io)) providing LLM clients (Claude Desktop, Cursor, Windsurf, etc.) with tools to manage a [Remnawave](https://github.com/remnawave/) VPN panel.

**Version:** 1.3.0 | **Remnawave API:** 3.4.4 (backend-contract 3.4.15)

### Features

- **Tool set follows Remnawave 3.4.4** — full management of users, nodes, hosts, subscriptions, squads, HWID, config profiles, inbounds, API tokens, billing, snippets, external squads, settings, subscription page configs, node plugins, and metadata
- **3 resources** — real-time panel stats, node status, health checks
- **5 prompts** — guided workflows for common tasks
- **Readonly mode** — write tools stay unregistered
- **Caddy support** — `X-Api-Key` header for panels behind Caddy with custom path
- **Type-safe** — built on [@remnawave/backend-contract](https://www.npmjs.com/package/@remnawave/backend-contract) for API route validation
- **stdio transport** — works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible client

### API 3.4.4

- Users are addressed by numeric id. Lookup by email, telegram id, tag and subscription uuid was removed. Use `users_stream` filters, `users_get_by_username`, `users_get_by_short_uuid`, or `users_resolve` (exactly one of id, shortUuid, username).
- Bulk user operations and HWID device calls take `userIds` / `userId`, not UUIDs.
- IP control tools were removed. Connection tools replace them: `connections_by_user`, `connections_by_node`, `connections_geocheck`, `connections_drop` (drop by userIds or ip addresses).
- Internal squad membership of specific users uses numeric user ids (`squads_add_users` / `squads_remove_users`). `squads_add_all_users`, `squads_remove_all_users`, `external_squads_add_all_users` and `external_squads_remove_all_users` affect every user.
- API token create fields are `name`, `expiresInDays` and optional `scopes`.

### Requirements

- Node.js >= 22
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

| Variable | Required | Description |
|----------|----------|-------------|
| `REMNAWAVE_BASE_URL` | Yes | Panel URL (e.g. `https://vpn.example.com`) |
| `REMNAWAVE_API_TOKEN` | Yes | API token from panel settings |
| `REMNAWAVE_API_KEY` | No | API key for Caddy reverse proxy authentication |
| `REMNAWAVE_READONLY` | No | Set to `true` to enable readonly mode |

```env
REMNAWAVE_BASE_URL=https://vpn.example.com
REMNAWAVE_API_TOKEN=your-api-token-here
```

### Caddy with Custom Path

If your Remnawave panel is deployed behind [Caddy with a custom path and API key protection](https://docs.remnawave.com/docs/security/caddy-with-custom-path/), set the base URL to include the custom path and provide the API key:

```env
REMNAWAVE_BASE_URL=https://example.com/your-secret-path/api
REMNAWAVE_API_KEY=your-caddy-api-key
```

The `X-Api-Key` header will be added to every request automatically.

### Readonly Mode

Set `REMNAWAVE_READONLY=true` to disable all write operations (create, update, delete, enable, disable, restart, revoke, reset). Only read/list tools will be registered.

Useful for monitoring dashboards or shared environments where you want to prevent accidental changes.

In readonly mode, write tools are not registered. The read-only set follows Remnawave 3.4.4:

| Category | Available tools |
|----------|----------------|
| Users | `users_list`, `users_get`, `users_get_by_username`, `users_get_by_short_uuid`, `users_stream`, `users_tags_list`, `users_resolve`, `users_accessible_nodes`, `users_subscription_request_history` |
| Nodes (3) | `nodes_list`, `nodes_get`, `nodes_tags_list` |
| Hosts (3) | `hosts_list`, `hosts_get`, `hosts_tags_list` |
| System (10) | all tools (read-only by nature) |
| Subscriptions (10) | all tools (read-only by nature) |
| Config Profiles & Inbounds (5) | `config_profiles_list`, `config_profiles_get`, `inbounds_list`, `config_profiles_get_inbounds`, `config_profiles_get_computed_config` |
| Internal Squads (2) | `squads_list`, `squads_accessible_nodes` |
| HWID (4) | `hwid_devices_list`, `hwid_devices_list_all`, `hwid_stats`, `hwid_top_users` |
| API Tokens (1) | `api_tokens_list` |
| Keygen (1) | `keygen_get` |
| Infra Billing (4) | `billing_providers_list`, `billing_provider_get`, `billing_nodes_list`, `billing_history_list` |
| Snippets (1) | `snippets_list` |
| External Squads (2) | `external_squads_list`, `external_squads_get` |
| Settings (1) | `settings_get` |
| Sub Page Configs (2) | `sub_page_configs_list`, `sub_page_configs_get` |
| Node Plugins (4) | `node_plugins_list`, `node_plugins_get`, `node_plugins_torrent_reports`, `node_plugins_torrent_stats` |
| Connections | `connections_by_user`, `connections_by_user_result`, `connections_by_node`, `connections_by_node_result`, `connections_geocheck`, `connections_geocheck_result` |
| Metadata (2) | `metadata_node_get`, `metadata_user_get` |

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
        "REMNAWAVE_API_KEY": "your-caddy-api-key",
        "REMNAWAVE_READONLY": "false"
      }
    }
  }
}
```

### Docker

```bash
npm run build
docker compose up -d
```

Environment variables are passed via `.env` file or `docker-compose.yml`.

### Available Tools

#### Users (27 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `users_list` | List all users with pagination | read |
| `users_get` | Get user by numeric id | read |
| `users_get_by_username` | Get user by username | read |
| `users_get_by_short_uuid` | Get user by short UUID | read |
| `users_stream` | List users by cursor, with email, tag and telegram filters | read |
| `users_accessible_nodes` | Nodes available to a user | read |
| `users_subscription_request_history` | Recent subscription requests for a user | read |
| `users_tags_list` | List all user tags | read |
| `users_resolve` | Resolve users by multiple criteria | read |
| `users_create` | Create a new user | write |
| `users_update` | Update user settings | write |
| `users_delete` | Delete a user | write |
| `users_enable` | Enable a disabled user | write |
| `users_disable` | Disable a user | write |
| `users_revoke_subscription` | Revoke subscription (regenerate link) | write |
| `users_reset_traffic` | Reset traffic counter | write |
| `users_extend_expiration` | Extend one user's expiration by a number of days | write |
| `users_bulk_delete_by_status` | Bulk delete users by status | write |
| `users_bulk_update` | Bulk update users | write |
| `users_bulk_reset_traffic` | Bulk reset traffic | write |
| `users_bulk_revoke_subscription` | Bulk revoke subscriptions | write |
| `users_bulk_delete` | Bulk delete users | write |
| `users_bulk_update_squads` | Bulk update user squads | write |
| `users_bulk_extend_expiration` | Bulk extend expiration dates | write |
| `users_bulk_all_update` | Bulk update all users | write |
| `users_bulk_all_reset_traffic` | Bulk reset all users traffic | write |
| `users_bulk_all_extend_expiration` | Bulk extend all users expiration | write |

#### Nodes (15 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `nodes_list` | List all nodes | read |
| `nodes_get` | Get node by UUID | read |
| `nodes_tags_list` | List all node tags | read |
| `nodes_create` | Create a new node | write |
| `nodes_update` | Update node settings | write |
| `nodes_delete` | Delete a node | write |
| `nodes_enable` | Enable a node | write |
| `nodes_disable` | Disable a node | write |
| `nodes_restart` | Restart a specific node | write |
| `nodes_restart_all` | Restart all nodes | write |
| `nodes_reset_traffic` | Reset node traffic counter | write |
| `nodes_reorder` | Reorder nodes | write |
| `nodes_bulk_profile_modification` | Bulk modify node profiles | write |
| `nodes_bulk_actions` | Bulk node actions | write |
| `nodes_bulk_update` | Bulk update nodes | write |

#### Hosts (11 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `hosts_list` | List all hosts | read |
| `hosts_get` | Get host by UUID | read |
| `hosts_tags_list` | List all host tags | read |
| `hosts_create` | Create a new host | write |
| `hosts_update` | Update host settings | write |
| `hosts_delete` | Delete a host | write |
| `hosts_bulk_enable` | Bulk enable hosts | write |
| `hosts_bulk_disable` | Bulk disable hosts | write |
| `hosts_bulk_delete` | Bulk delete hosts | write |
| `hosts_bulk_update` | Bulk update hosts (inbound and port) | write |

#### System (10 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `system_stats` | Panel statistics (users, nodes, traffic, CPU, memory) | read |
| `system_bandwidth_stats` | Bandwidth statistics | read |
| `system_nodes_metrics` | Node metrics | read |
| `system_nodes_statistics` | Node statistics | read |
| `system_health` | Panel health check | read |
| `system_metadata` | Panel version and metadata | read |
| `system_generate_x25519` | Generate X25519 key pair | read |
| `auth_status` | Check authentication status | read |
| `system_stats_recap` | System statistics recap | read |
| `system_srr_matcher` | Test SRR routing rules | read |

#### Subscriptions (10 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `subscriptions_list` | List all subscriptions | read |
| `subscriptions_get_by_user_id` | Get subscription by numeric user id | read |
| `subscriptions_get_by_username` | Get subscription by username | read |
| `subscriptions_get_by_short_uuid` | Get subscription by short UUID | read |
| `subscriptions_get_raw_by_short_uuid` | Get raw subscription by short UUID | read |
| `subscriptions_get_subpage_config` | Get subscription subpage config | read |
| `subscriptions_get_connection_keys` | Get connection keys by UUID | read |
| `subscription_info` | Get subscription info | read |
| `subscription_request_history_list` | Subscription request history | read |
| `subscription_request_history_stats` | Subscription request history stats | read |

#### Config Profiles & Inbounds (9 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `config_profiles_list` | List config profiles | read |
| `config_profiles_get` | Get config profile by UUID | read |
| `inbounds_list` | List all inbounds | read |
| `config_profiles_get_inbounds` | Get inbounds by profile UUID | read |
| `config_profiles_get_computed_config` | Get computed config by profile UUID | read |
| `config_profiles_create` | Create config profile | write |
| `config_profiles_update` | Update config profile | write |
| `config_profiles_delete` | Delete config profile | write |
| `config_profiles_reorder` | Reorder config profiles | write |

#### Internal Squads (7 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `squads_list` | List all squads | read |
| `squads_accessible_nodes` | Get squad accessible nodes | read |
| `squads_create` | Create a squad | write |
| `squads_update` | Update a squad | write |
| `squads_delete` | Delete a squad | write |
| `squads_add_users` | Add users (numeric ids) to a squad | write |
| `squads_remove_users` | Remove users (numeric ids) from a squad | write |
| `squads_add_all_users` | Add every user to a squad | write |
| `squads_remove_all_users` | Remove every user from a squad | write |

#### HWID Devices (7 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `hwid_devices_list` | List user's HWID devices | read |
| `hwid_devices_list_all` | List all HWID devices | read |
| `hwid_stats` | Get HWID statistics | read |
| `hwid_top_users` | Get top users by devices | read |
| `hwid_device_create` | Create HWID device | write |
| `hwid_device_delete` | Delete a specific device | write |
| `hwid_devices_delete_all` | Delete all user's devices | write |

#### API Tokens (3 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `api_tokens_list` | List API tokens | read |
| `api_tokens_create` | Create API token | write |
| `api_tokens_delete` | Delete API token | write |

#### Keygen (1 tool)

| Tool | Description | Mode |
|------|-------------|------|
| `keygen_get` | Get keygen data | read |

#### Infra Billing (12 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `billing_providers_list` | List billing providers | read |
| `billing_provider_get` | Get billing provider by UUID | read |
| `billing_nodes_list` | List billing nodes | read |
| `billing_history_list` | List billing history | read |
| `billing_provider_create` | Create billing provider | write |
| `billing_provider_update` | Update billing provider | write |
| `billing_provider_delete` | Delete billing provider | write |
| `billing_node_create` | Create billing node | write |
| `billing_node_update` | Update billing node | write |
| `billing_node_delete` | Delete billing node | write |
| `billing_history_create` | Create billing history entry | write |
| `billing_history_delete` | Delete billing history entry | write |

#### Snippets (4 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `snippets_list` | List snippets | read |
| `snippets_create` | Create snippet | write |
| `snippets_update` | Update snippet | write |
| `snippets_delete` | Delete snippet | write |

#### External Squads (8 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `external_squads_list` | List external squads | read |
| `external_squads_get` | Get external squad by UUID | read |
| `external_squads_create` | Create external squad | write |
| `external_squads_update` | Update external squad | write |
| `external_squads_delete` | Delete external squad | write |
| `external_squads_add_all_users` | Add every user to an external squad | write |
| `external_squads_remove_all_users` | Remove every user from an external squad | write |
| `external_squads_reorder` | Reorder external squads | write |

#### Settings (2 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `settings_get` | Get panel settings | read |
| `settings_update` | Update panel settings | write |

#### Subscription Page Configs (7 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `sub_page_configs_list` | List subscription page configs | read |
| `sub_page_configs_get` | Get subscription page config | read |
| `sub_page_configs_create` | Create subscription page config | write |
| `sub_page_configs_update` | Update subscription page config | write |
| `sub_page_configs_delete` | Delete subscription page config | write |
| `sub_page_configs_reorder` | Reorder subscription page configs | write |
| `sub_page_configs_clone` | Clone subscription page config | write |

#### Node Plugins (11 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `node_plugins_list` | List node plugins | read |
| `node_plugins_get` | Get node plugin by UUID | read |
| `node_plugins_torrent_reports` | Get torrent blocker reports | read |
| `node_plugins_torrent_stats` | Get torrent blocker stats | read |
| `node_plugins_create` | Create node plugin | write |
| `node_plugins_update` | Update node plugin | write |
| `node_plugins_delete` | Delete node plugin | write |
| `node_plugins_reorder` | Reorder node plugins | write |
| `node_plugins_clone` | Clone node plugin | write |
| `node_plugins_execute` | Execute node plugin | write |
| `node_plugins_torrent_truncate` | Truncate torrent blocker reports | write |

#### Connections (7 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `connections_by_user` | Queue a user's active connections | read |
| `connections_by_user_result` | Read that job | read |
| `connections_by_node` | Queue a node's active connections | read |
| `connections_by_node_result` | Read that job | read |
| `connections_geocheck` | Queue a node geocheck | read |
| `connections_geocheck_result` | Read that job | read |
| `connections_drop` | Drop connections by user ids or IP addresses | write |

#### Metadata (4 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `metadata_node_get` | Get node metadata | read |
| `metadata_user_get` | Get user metadata | read |
| `metadata_node_upsert` | Upsert node metadata | write |
| `metadata_user_upsert` | Upsert user metadata | write |

### Resources

| URI | Description |
|-----|-------------|
| `remnawave://stats` | Current panel statistics |
| `remnawave://nodes` | All nodes status |
| `remnawave://health` | Panel health status |
| `remnawave://users/{uuid}` | Specific user details |

### Prompts

| Prompt | Description |
|--------|-------------|
| `create_user_wizard` | Step-by-step user creation guide |
| `node_diagnostics` | Node troubleshooting |
| `traffic_report` | Traffic usage report |
| `user_audit` | Complete user audit |
| `bulk_user_cleanup` | Find and manage expired users |

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

**Версия:** 1.3.0 | **Remnawave API:** 3.4.4 (backend-contract 3.4.15)

### Возможности

- **Набор инструментов соответствует Remnawave 3.4.4** — полное управление пользователями, нодами, хостами, подписками, группами, HWID, конфиг-профилями, inbounds, API-токенами, биллингом, сниппетами, внешними группами, настройками, страницами подписок, плагинами нод и метаданными
- **3 ресурса** — статистика панели, статус нод, проверка здоровья в реальном времени
- **5 промптов** — пошаговые сценарии для типичных задач
- **Readonly-режим** — инструменты записи не регистрируются
- **Поддержка Caddy** — заголовок `X-Api-Key` для панелей за Caddy с кастомным путём
- **Type-safe** — построен на [@remnawave/backend-contract](https://www.npmjs.com/package/@remnawave/backend-contract) для валидации API-маршрутов
- **stdio транспорт** — работает с Claude Desktop, Cursor, Windsurf и любым MCP-совместимым клиентом

### API 3.4.4

- Пользователь адресуется числовым id. Поиск по email, Telegram, тегу и UUID подписки снят. Фильтры: `users_stream`, `users_get_by_username`, `users_get_by_short_uuid`, `users_resolve` (ровно одно из id, shortUuid, username).
- Массовые операции и HWID принимают `userIds` / `userId`.
- IP-контроль заменён инструментами соединений: `connections_by_user`, `connections_by_node`, `connections_geocheck`, `connections_drop`.
- Выборочное членство во внутренней группе — числовые id (`squads_add_users` / `squads_remove_users`). `squads_add_all_users`, `squads_remove_all_users`, `external_squads_add_all_users` и `external_squads_remove_all_users` затрагивают всех пользователей.
- Создание API-токена: `name`, `expiresInDays` и необязательные `scopes`.

### Требования

- Node.js >= 22
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

| Переменная | Обязательная | Описание |
|------------|-------------|----------|
| `REMNAWAVE_BASE_URL` | Да | URL панели (например `https://vpn.example.com`) |
| `REMNAWAVE_API_TOKEN` | Да | API-токен из настроек панели |
| `REMNAWAVE_API_KEY` | Нет | API-ключ для аутентификации через Caddy reverse proxy |
| `REMNAWAVE_READONLY` | Нет | `true` для включения режима только чтения |

```env
REMNAWAVE_BASE_URL=https://vpn.example.com
REMNAWAVE_API_TOKEN=ваш-api-токен
```

### Caddy с кастомным путём

Если ваша панель Remnawave развёрнута за [Caddy с кастомным путём и защитой API-ключом](https://docs.remnawave.com/docs/security/caddy-with-custom-path/), укажите полный путь в base URL и предоставьте API-ключ:

```env
REMNAWAVE_BASE_URL=https://example.com/your-secret-path/api
REMNAWAVE_API_KEY=ваш-caddy-api-ключ
```

Заголовок `X-Api-Key` будет автоматически добавляться к каждому запросу.

### Режим Readonly

Установите `REMNAWAVE_READONLY=true`, чтобы отключить все операции записи (создание, обновление, удаление, включение, отключение, перезапуск, отзыв, сброс). Будут зарегистрированы только инструменты чтения.

Полезно для мониторинговых дашбордов или общих окружений, где нужно исключить случайные изменения.

В readonly-режиме инструменты записи не регистрируются. Набор инструментов только для чтения соответствует Remnawave 3.4.4:

| Категория | Доступные инструменты |
|-----------|----------------------|
| Пользователи | `users_list`, `users_get`, `users_get_by_username`, `users_get_by_short_uuid`, `users_stream`, `users_tags_list`, `users_resolve`, `users_accessible_nodes`, `users_subscription_request_history` |
| Ноды (3) | `nodes_list`, `nodes_get`, `nodes_tags_list` |
| Хосты (3) | `hosts_list`, `hosts_get`, `hosts_tags_list` |
| Система (10) | все инструменты (только чтение по природе) |
| Подписки (10) | все инструменты (только чтение по природе) |
| Конфиг-профили и Inbounds (5) | `config_profiles_list`, `config_profiles_get`, `inbounds_list`, `config_profiles_get_inbounds`, `config_profiles_get_computed_config` |
| Внутренние группы (2) | `squads_list`, `squads_accessible_nodes` |
| HWID (4) | `hwid_devices_list`, `hwid_devices_list_all`, `hwid_stats`, `hwid_top_users` |
| API-токены (1) | `api_tokens_list` |
| Keygen (1) | `keygen_get` |
| Биллинг (4) | `billing_providers_list`, `billing_provider_get`, `billing_nodes_list`, `billing_history_list` |
| Сниппеты (1) | `snippets_list` |
| Внешние группы (2) | `external_squads_list`, `external_squads_get` |
| Настройки (1) | `settings_get` |
| Страницы подписок (2) | `sub_page_configs_list`, `sub_page_configs_get` |
| Плагины нод (4) | `node_plugins_list`, `node_plugins_get`, `node_plugins_torrent_reports`, `node_plugins_torrent_stats` |
| Соединения | `connections_by_user`, `connections_by_user_result`, `connections_by_node`, `connections_by_node_result`, `connections_geocheck`, `connections_geocheck_result` |
| Метаданные (2) | `metadata_node_get`, `metadata_user_get` |

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
        "REMNAWAVE_API_KEY": "ваш-caddy-api-ключ",
        "REMNAWAVE_READONLY": "false"
      }
    }
  }
}
```

### Docker

```bash
npm run build
docker compose up -d
```

Переменные окружения передаются через `.env` файл или `docker-compose.yml`.

### Доступные инструменты

#### Пользователи (27 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `users_list` | Список пользователей с пагинацией | read |
| `users_get` | Получить пользователя по числовому id | read |
| `users_get_by_username` | Получить пользователя по username | read |
| `users_get_by_short_uuid` | Получить пользователя по short UUID | read |
| `users_stream` | Список по курсору, фильтры email, тег и Telegram | read |
| `users_accessible_nodes` | Ноды, доступные пользователю | read |
| `users_subscription_request_history` | Недавние запросы подписки пользователя | read |
| `users_tags_list` | Список тегов пользователей | read |
| `users_resolve` | Поиск пользователей по нескольким критериям | read |
| `users_create` | Создать нового пользователя | write |
| `users_update` | Обновить настройки пользователя | write |
| `users_delete` | Удалить пользователя | write |
| `users_enable` | Включить пользователя | write |
| `users_disable` | Отключить пользователя | write |
| `users_revoke_subscription` | Отозвать подписку (перегенерировать ссылку) | write |
| `users_reset_traffic` | Сбросить счётчик трафика | write |
| `users_extend_expiration` | Продлить срок одному пользователю на число дней | write |
| `users_bulk_delete_by_status` | Массовое удаление по статусу | write |
| `users_bulk_update` | Массовое обновление | write |
| `users_bulk_reset_traffic` | Массовый сброс трафика | write |
| `users_bulk_revoke_subscription` | Массовый отзыв подписок | write |
| `users_bulk_delete` | Массовое удаление | write |
| `users_bulk_update_squads` | Массовое обновление групп | write |
| `users_bulk_extend_expiration` | Массовое продление срока | write |
| `users_bulk_all_update` | Обновить всех пользователей | write |
| `users_bulk_all_reset_traffic` | Сбросить трафик всех пользователей | write |
| `users_bulk_all_extend_expiration` | Продлить срок всех пользователей | write |

#### Ноды (15 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `nodes_list` | Список всех нод | read |
| `nodes_get` | Получить ноду по UUID | read |
| `nodes_tags_list` | Список тегов нод | read |
| `nodes_create` | Создать новую ноду | write |
| `nodes_update` | Обновить настройки ноды | write |
| `nodes_delete` | Удалить ноду | write |
| `nodes_enable` | Включить ноду | write |
| `nodes_disable` | Отключить ноду | write |
| `nodes_restart` | Перезапустить ноду | write |
| `nodes_restart_all` | Перезапустить все ноды | write |
| `nodes_reset_traffic` | Сбросить трафик ноды | write |
| `nodes_reorder` | Переупорядочить ноды | write |
| `nodes_bulk_profile_modification` | Массовое изменение профилей нод | write |
| `nodes_bulk_actions` | Массовые действия с нодами | write |
| `nodes_bulk_update` | Массовое обновление нод | write |

#### Хосты (11 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `hosts_list` | Список всех хостов | read |
| `hosts_get` | Получить хост по UUID | read |
| `hosts_tags_list` | Список тегов хостов | read |
| `hosts_create` | Создать новый хост | write |
| `hosts_update` | Обновить настройки хоста | write |
| `hosts_delete` | Удалить хост | write |
| `hosts_bulk_enable` | Массовое включение хостов | write |
| `hosts_bulk_disable` | Массовое отключение хостов | write |
| `hosts_bulk_delete` | Массовое удаление хостов | write |
| `hosts_bulk_update` | Массовое обновление хостов (inbound и порт) | write |

#### Система (10 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `system_stats` | Статистика панели (пользователи, ноды, трафик, CPU, память) | read |
| `system_bandwidth_stats` | Статистика пропускной способности | read |
| `system_nodes_metrics` | Метрики нод | read |
| `system_nodes_statistics` | Статистика нод | read |
| `system_health` | Проверка здоровья панели | read |
| `system_metadata` | Версия и метаданные панели | read |
| `system_generate_x25519` | Генерация пары ключей X25519 | read |
| `auth_status` | Проверка статуса аутентификации | read |
| `system_stats_recap` | Обзор статистики | read |
| `system_srr_matcher` | Тест SRR-правил маршрутизации | read |

#### Подписки (10 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `subscriptions_list` | Список всех подписок | read |
| `subscriptions_get_by_user_id` | Подписка по числовому id пользователя | read |
| `subscriptions_get_by_username` | Подписка по username | read |
| `subscriptions_get_by_short_uuid` | Подписка по short UUID | read |
| `subscriptions_get_raw_by_short_uuid` | Сырая подписка по short UUID | read |
| `subscriptions_get_subpage_config` | Конфиг субстраницы подписки | read |
| `subscriptions_get_connection_keys` | Ключи подключения по UUID | read |
| `subscription_info` | Информация о подписке | read |
| `subscription_request_history_list` | История запросов подписок | read |
| `subscription_request_history_stats` | Статистика запросов подписок | read |

#### Конфиг-профили и Inbounds (9 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `config_profiles_list` | Список конфиг-профилей | read |
| `config_profiles_get` | Получить конфиг-профиль по UUID | read |
| `inbounds_list` | Список всех inbounds | read |
| `config_profiles_get_inbounds` | Inbounds по UUID профиля | read |
| `config_profiles_get_computed_config` | Вычисленный конфиг по UUID профиля | read |
| `config_profiles_create` | Создать конфиг-профиль | write |
| `config_profiles_update` | Обновить конфиг-профиль | write |
| `config_profiles_delete` | Удалить конфиг-профиль | write |
| `config_profiles_reorder` | Переупорядочить конфиг-профили | write |

#### Внутренние группы (7 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `squads_list` | Список групп | read |
| `squads_accessible_nodes` | Доступные ноды группы | read |
| `squads_create` | Создать группу | write |
| `squads_update` | Обновить группу | write |
| `squads_delete` | Удалить группу | write |
| `squads_add_users` | Добавить пользователей (числовые id) в группу | write |
| `squads_remove_users` | Убрать пользователей (числовые id) из группы | write |
| `squads_add_all_users` | Добавить всех пользователей в группу | write |
| `squads_remove_all_users` | Убрать всех пользователей из группы | write |

#### HWID-устройства (7 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `hwid_devices_list` | Список устройств пользователя | read |
| `hwid_devices_list_all` | Список всех устройств | read |
| `hwid_stats` | Статистика HWID | read |
| `hwid_top_users` | Топ пользователей по устройствам | read |
| `hwid_device_create` | Создать HWID-устройство | write |
| `hwid_device_delete` | Удалить конкретное устройство | write |
| `hwid_devices_delete_all` | Удалить все устройства пользователя | write |

#### API-токены (3 инструмента)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `api_tokens_list` | Список API-токенов | read |
| `api_tokens_create` | Создать API-токен | write |
| `api_tokens_delete` | Удалить API-токен | write |

#### Keygen (1 инструмент)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `keygen_get` | Получить данные keygen | read |

#### Биллинг инфраструктуры (12 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `billing_providers_list` | Список провайдеров биллинга | read |
| `billing_provider_get` | Получить провайдера по UUID | read |
| `billing_nodes_list` | Список биллинговых нод | read |
| `billing_history_list` | История биллинга | read |
| `billing_provider_create` | Создать провайдера | write |
| `billing_provider_update` | Обновить провайдера | write |
| `billing_provider_delete` | Удалить провайдера | write |
| `billing_node_create` | Создать биллинговую ноду | write |
| `billing_node_update` | Обновить биллинговую ноду | write |
| `billing_node_delete` | Удалить биллинговую ноду | write |
| `billing_history_create` | Создать запись истории | write |
| `billing_history_delete` | Удалить запись истории | write |

#### Сниппеты (4 инструмента)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `snippets_list` | Список сниппетов | read |
| `snippets_create` | Создать сниппет | write |
| `snippets_update` | Обновить сниппет | write |
| `snippets_delete` | Удалить сниппет | write |

#### Внешние группы (8 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `external_squads_list` | Список внешних групп | read |
| `external_squads_get` | Получить внешнюю группу по UUID | read |
| `external_squads_create` | Создать внешнюю группу | write |
| `external_squads_update` | Обновить внешнюю группу | write |
| `external_squads_delete` | Удалить внешнюю группу | write |
| `external_squads_add_all_users` | Добавить всех пользователей во внешнюю группу | write |
| `external_squads_remove_all_users` | Убрать всех пользователей из внешней группы | write |
| `external_squads_reorder` | Переупорядочить | write |

#### Настройки (2 инструмента)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `settings_get` | Получить настройки панели | read |
| `settings_update` | Обновить настройки панели | write |

#### Страницы подписок (7 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `sub_page_configs_list` | Список конфигов страниц | read |
| `sub_page_configs_get` | Получить конфиг страницы | read |
| `sub_page_configs_create` | Создать конфиг страницы | write |
| `sub_page_configs_update` | Обновить конфиг страницы | write |
| `sub_page_configs_delete` | Удалить конфиг страницы | write |
| `sub_page_configs_reorder` | Переупорядочить | write |
| `sub_page_configs_clone` | Клонировать конфиг | write |

#### Плагины нод (11 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `node_plugins_list` | Список плагинов | read |
| `node_plugins_get` | Получить плагин по UUID | read |
| `node_plugins_torrent_reports` | Отчёты торрент-блокировщика | read |
| `node_plugins_torrent_stats` | Статистика торрент-блокировщика | read |
| `node_plugins_create` | Создать плагин | write |
| `node_plugins_update` | Обновить плагин | write |
| `node_plugins_delete` | Удалить плагин | write |
| `node_plugins_reorder` | Переупорядочить плагины | write |
| `node_plugins_clone` | Клонировать плагин | write |
| `node_plugins_execute` | Выполнить плагин | write |
| `node_plugins_torrent_truncate` | Очистить отчёты торрент-блокировщика | write |

#### Соединения (7 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `connections_by_user` | Поставить в очередь соединения пользователя | read |
| `connections_by_user_result` | Прочитать эту задачу | read |
| `connections_by_node` | Поставить в очередь соединения ноды | read |
| `connections_by_node_result` | Прочитать эту задачу | read |
| `connections_geocheck` | Поставить в очередь геопроверку ноды | read |
| `connections_geocheck_result` | Прочитать эту задачу | read |
| `connections_drop` | Сбросить соединения по id пользователей или IP | write |

#### Метаданные (4 инструмента)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `metadata_node_get` | Получить метаданные ноды | read |
| `metadata_user_get` | Получить метаданные пользователя | read |
| `metadata_node_upsert` | Обновить метаданные ноды | write |
| `metadata_user_upsert` | Обновить метаданные пользователя | write |

### Ресурсы

| URI | Описание |
|-----|----------|
| `remnawave://stats` | Текущая статистика панели |
| `remnawave://nodes` | Статус всех нод |
| `remnawave://health` | Состояние здоровья панели |
| `remnawave://users/{uuid}` | Данные конкретного пользователя |

### Промпты

| Промпт | Описание |
|--------|----------|
| `create_user_wizard` | Пошаговое создание пользователя |
| `node_diagnostics` | Диагностика ноды |
| `traffic_report` | Отчёт по трафику |
| `user_audit` | Полный аудит пользователя |
| `bulk_user_cleanup` | Поиск и управление просроченными пользователями |

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
