export interface Config {
    /** The Remnawave API release exposed by this MCP process. */
    release: 'v2' | 'v3';
    baseUrl: string;
    apiToken: string;
    requestTimeoutMs: number;
    apiKey?: string;
    cfAccessClientId?: string;
    cfAccessClientSecret?: string;
    readonly: boolean;
    http: {
        enabled: boolean;
        host: string;
        port: number;
        /** Optional bearer token required for requests to the MCP endpoint. */
        authToken?: string;
        /** Maximum number of active stateful MCP sessions. */
        maxSessions: number;
        /** Idle lifetime of a stateful MCP session. */
        sessionTtlMs: number;
        /** Maximum time allowed to receive a complete HTTP request. */
        requestTimeoutMs: number;
        /** Maximum time allowed to receive HTTP request headers. */
        headersTimeoutMs: number;
        /** How long an idle keep-alive connection may remain open. */
        keepAliveTimeoutMs: number;
        /** Maximum accepted Content-Length for an MCP request body. */
        maxBodyBytes: number;
        /** Maximum combined HTTP request-header size. */
        maxHeaderSizeBytes: number;
        /** Maximum time allowed for the upstream readiness probe. */
        readinessTimeoutMs: number;
    };
}

function readPositiveInteger(name: string, value: string | undefined, fallback: number): number {
    const parsed = Number(value || fallback);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}

function readBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value === '') return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`${name} must be exactly "true" or "false"`);
}

export function loadConfig(): Config {
    const release = process.env.REMNAWAVE_RELEASE ?? 'v3';
    const baseUrl = process.env.REMNAWAVE_BASE_URL;
    const apiToken = process.env.REMNAWAVE_API_TOKEN;
    const apiKey = process.env.REMNAWAVE_API_KEY;
    const requestTimeoutMs = readPositiveInteger(
        'REMNAWAVE_REQUEST_TIMEOUT_MS',
        process.env.REMNAWAVE_REQUEST_TIMEOUT_MS,
        30_000,
    );
    const cfAccessClientId = process.env.CF_ACCESS_CLIENT_ID;
    const cfAccessClientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
    const readonly = readBoolean('REMNAWAVE_READONLY', process.env.REMNAWAVE_READONLY, false);
    const httpEnabled = readBoolean('MCP_HTTP_ENABLED', process.env.MCP_HTTP_ENABLED, false);
    const httpHost = process.env.MCP_HTTP_HOST || '127.0.0.1';
    const httpPort = Number(process.env.MCP_HTTP_PORT || '3100');
    const httpAuthToken = process.env.MCP_HTTP_AUTH_TOKEN;
    const httpMaxSessions = readPositiveInteger(
        'MCP_HTTP_MAX_SESSIONS',
        process.env.MCP_HTTP_MAX_SESSIONS,
        100,
    );
    const httpSessionTtlMs = readPositiveInteger(
        'MCP_HTTP_SESSION_TTL_MS',
        process.env.MCP_HTTP_SESSION_TTL_MS,
        3_600_000,
    );
    const httpRequestTimeoutMs = readPositiveInteger(
        'MCP_HTTP_REQUEST_TIMEOUT_MS',
        process.env.MCP_HTTP_REQUEST_TIMEOUT_MS,
        120_000,
    );
    const httpHeadersTimeoutMs = readPositiveInteger(
        'MCP_HTTP_HEADERS_TIMEOUT_MS',
        process.env.MCP_HTTP_HEADERS_TIMEOUT_MS,
        30_000,
    );
    const httpKeepAliveTimeoutMs = readPositiveInteger(
        'MCP_HTTP_KEEP_ALIVE_TIMEOUT_MS',
        process.env.MCP_HTTP_KEEP_ALIVE_TIMEOUT_MS,
        5_000,
    );
    const httpMaxBodyBytes = readPositiveInteger(
        'MCP_HTTP_MAX_BODY_BYTES',
        process.env.MCP_HTTP_MAX_BODY_BYTES,
        1_048_576,
    );
    const httpMaxHeaderSizeBytes = readPositiveInteger(
        'MCP_HTTP_MAX_HEADER_SIZE_BYTES',
        process.env.MCP_HTTP_MAX_HEADER_SIZE_BYTES,
        16_384,
    );
    const httpReadinessTimeoutMs = readPositiveInteger(
        'MCP_HTTP_READINESS_TIMEOUT_MS',
        process.env.MCP_HTTP_READINESS_TIMEOUT_MS,
        5_000,
    );

    if (!baseUrl) {
        throw new Error('REMNAWAVE_BASE_URL environment variable is required');
    }
    if (!apiToken) {
        throw new Error('REMNAWAVE_API_TOKEN environment variable is required');
    }
    if (release !== 'v2' && release !== 'v3') {
        throw new Error('REMNAWAVE_RELEASE must be exactly "v2" or "v3"');
    }
    if (!Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535) {
        throw new Error('MCP_HTTP_PORT must be an integer between 1 and 65535');
    }
    if (httpHeadersTimeoutMs > httpRequestTimeoutMs) {
        throw new Error('MCP_HTTP_HEADERS_TIMEOUT_MS must not exceed MCP_HTTP_REQUEST_TIMEOUT_MS');
    }

    return {
        release,
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiToken,
        requestTimeoutMs,
        apiKey,
        cfAccessClientId,
        cfAccessClientSecret,
        readonly,
        http: {
            enabled: httpEnabled,
            host: httpHost,
            port: httpPort,
            authToken: httpAuthToken || undefined,
            maxSessions: httpMaxSessions,
            sessionTtlMs: httpSessionTtlMs,
            requestTimeoutMs: httpRequestTimeoutMs,
            headersTimeoutMs: httpHeadersTimeoutMs,
            keepAliveTimeoutMs: httpKeepAliveTimeoutMs,
            maxBodyBytes: httpMaxBodyBytes,
            maxHeaderSizeBytes: httpMaxHeaderSizeBytes,
            readinessTimeoutMs: httpReadinessTimeoutMs,
        },
    };
}
