import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer as createHttpServer, Server, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Config } from './config.js';
import { createServer } from './server.js';

const MCP_PATH = '/mcp';
const HEALTH_PATH = '/healthz';
const READINESS_PATH = '/readyz';
const METRICS_PATH = '/metrics';

interface McpSession {
    server: ReturnType<typeof createServer>;
    transport: StreamableHTTPServerTransport;
    lastActivityAt: number;
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, string>) {
    response.writeHead(statusCode, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
}

function sendText(response: ServerResponse, statusCode: number, body: string): void {
    response.writeHead(statusCode, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    response.end(body);
}

function logEvent(event: string, fields: Record<string, string | number | boolean> = {}): void {
    process.stderr.write(`${JSON.stringify({ event, ...fields })}\n`);
}

function isAuthorized(
    authorization: string | string[] | undefined,
    token: string | undefined,
): boolean {
    if (!token) {
        return true;
    }

    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    const expected = `Bearer ${token}`;
    if (!value || Buffer.byteLength(value) !== Buffer.byteLength(expected)) {
        return false;
    }

    return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

function isRequestBodyTooLarge(
    contentLength: string | string[] | undefined,
    maxBodyBytes: number,
): boolean {
    const value = Array.isArray(contentLength) ? contentLength[0] : contentLength;
    if (!value) {
        return false;
    }

    const size = Number(value);
    return Number.isFinite(size) && size > maxBodyBytes;
}

function getRoute(pathname: string): string {
    if (pathname === MCP_PATH) return MCP_PATH;
    if (pathname === HEALTH_PATH) return HEALTH_PATH;
    if (pathname === READINESS_PATH) return READINESS_PATH;
    if (pathname === METRICS_PATH) return METRICS_PATH;
    return 'other';
}

function panelHeaders(config: Config): Record<string, string> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
    };
    if (config.apiKey) headers['X-Api-Key'] = config.apiKey;
    if (config.cfAccessClientId) headers['CF-Access-Client-Id'] = config.cfAccessClientId;
    if (config.cfAccessClientSecret)
        headers['CF-Access-Client-Secret'] = config.cfAccessClientSecret;
    return headers;
}

function renderMetrics(
    requestCounts: Map<string, number>,
    activeSessions: number,
    errorCount: number,
): string {
    const lines = [
        '# HELP remnawave_mcp_http_requests_total Total HTTP responses by route and status.',
        '# TYPE remnawave_mcp_http_requests_total counter',
    ];
    for (const [key, count] of [...requestCounts.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
    )) {
        const [route, status] = key.split('|');
        lines.push(
            `remnawave_mcp_http_requests_total{route="${route}",status="${status}"} ${count}`,
        );
    }
    lines.push(
        '# HELP remnawave_mcp_http_active_sessions Current active stateful MCP sessions.',
        '# TYPE remnawave_mcp_http_active_sessions gauge',
        `remnawave_mcp_http_active_sessions ${activeSessions}`,
        '# HELP remnawave_mcp_http_errors_total Total HTTP responses with 5xx status.',
        '# TYPE remnawave_mcp_http_errors_total counter',
        `remnawave_mcp_http_errors_total ${errorCount}`,
        '',
    );
    return lines.join('\n');
}

export async function startHttpServer(config: Config): Promise<Server> {
    const sessions = new Map<string, McpSession>();
    const pendingSessions = new Set<McpSession>();
    const requestCounts = new Map<string, number>();
    let errorCount = 0;

    const closeSession = async (session: McpSession): Promise<void> => {
        pendingSessions.delete(session);
        if (session.transport.sessionId) {
            sessions.delete(session.transport.sessionId);
        }
        await session.server.close();
    };

    const expireIdleSessions = (): void => {
        const now = Date.now();
        for (const session of sessions.values()) {
            if (now - session.lastActivityAt > config.http.sessionTtlMs) {
                void closeSession(session).catch((error: unknown) => {
                    process.stderr.write(
                        `Failed to close expired MCP HTTP session: ${error instanceof Error ? error.message : String(error)}\n`,
                    );
                });
            }
        }
    };

    const cleanupInterval = setInterval(
        expireIdleSessions,
        Math.max(1_000, Math.min(config.http.sessionTtlMs, 60_000)),
    );
    cleanupInterval.unref();

    const httpServer = createHttpServer(
        { maxHeaderSize: config.http.maxHeaderSizeBytes },
        async (request, response) => {
            const url = new URL(
                request.url || '/',
                `http://${request.headers.host || 'localhost'}`,
            );
            const route = getRoute(url.pathname);
            response.once('finish', () => {
                const key = `${route}|${response.statusCode}`;
                requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
                if (response.statusCode >= 500) errorCount += 1;
            });

            // Health probes must remain usable without credentials so orchestration can detect a live process.
            if (request.method === 'GET' && url.pathname === HEALTH_PATH) {
                sendJson(response, 200, { status: 'ok' });
                return;
            }

            if (request.method === 'GET' && url.pathname === READINESS_PATH) {
                const controller = new AbortController();
                const timeout = setTimeout(
                    () => controller.abort(),
                    config.http.readinessTimeoutMs,
                );
                try {
                    const panelResponse = await fetch(`${config.baseUrl}/api/system/health`, {
                        method: 'GET',
                        headers: panelHeaders(config),
                        signal: controller.signal,
                    });
                    const isReady = panelResponse.ok;
                    await panelResponse.body?.cancel().catch(() => undefined);
                    if (!isReady) {
                        logEvent('mcp_http_readiness_failed', {
                            upstream_status: panelResponse.status,
                        });
                        sendJson(response, 503, { status: 'unavailable' });
                        return;
                    }
                    sendJson(response, 200, { status: 'ok' });
                    return;
                } catch {
                    logEvent('mcp_http_readiness_failed', { reason: 'timeout_or_network_error' });
                    sendJson(response, 503, { status: 'unavailable' });
                    return;
                } finally {
                    clearTimeout(timeout);
                }
            }

            if (request.method === 'GET' && url.pathname === METRICS_PATH) {
                if (!isAuthorized(request.headers.authorization, config.http.authToken)) {
                    response.setHeader('WWW-Authenticate', 'Bearer');
                    sendJson(response, 401, { error: 'Unauthorized' });
                    return;
                }
                sendText(response, 200, renderMetrics(requestCounts, sessions.size, errorCount));
                return;
            }

            if (url.pathname !== MCP_PATH) {
                sendJson(response, 404, { error: 'Not found' });
                return;
            }

            if (!isAuthorized(request.headers.authorization, config.http.authToken)) {
                response.setHeader('WWW-Authenticate', 'Bearer');
                sendJson(response, 401, { error: 'Unauthorized' });
                return;
            }

            if (
                isRequestBodyTooLarge(request.headers['content-length'], config.http.maxBodyBytes)
            ) {
                sendJson(response, 413, { error: 'MCP request body is too large' });
                return;
            }

            expireIdleSessions();

            const sessionId = request.headers['mcp-session-id'];
            const requestedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
            const existingSession = requestedSessionId
                ? sessions.get(requestedSessionId)
                : undefined;

            if (requestedSessionId && !existingSession) {
                sendJson(response, 404, { error: 'Unknown MCP session' });
                return;
            }

            let server = existingSession?.server;
            let transport = existingSession?.transport;
            let isNewSession = false;
            let newSession: McpSession | undefined;

            if (!server || !transport) {
                if (sessions.size + pendingSessions.size >= config.http.maxSessions) {
                    sendJson(response, 503, { error: 'MCP session capacity reached' });
                    return;
                }

                isNewSession = true;
                server = createServer(config);
                transport = new StreamableHTTPServerTransport({
                    enableJsonResponse: true,
                    sessionIdGenerator: randomUUID,
                    onsessioninitialized: (id) => {
                        if (!newSession) {
                            return;
                        }
                        pendingSessions.delete(newSession);
                        newSession.lastActivityAt = Date.now();
                        sessions.set(id, newSession);
                    },
                });
                newSession = { server, transport, lastActivityAt: Date.now() };
                pendingSessions.add(newSession);
                transport.onclose = () => {
                    if (transport?.sessionId) {
                        sessions.delete(transport.sessionId);
                    }
                    if (newSession) {
                        pendingSessions.delete(newSession);
                    }
                };
            } else if (existingSession) {
                existingSession.lastActivityAt = Date.now();
            }

            try {
                if (isNewSession) {
                    await server.connect(transport);
                }
                await transport.handleRequest(request, response);
            } catch (error) {
                if (!response.headersSent) {
                    sendJson(response, 500, { error: 'Failed to handle MCP request' });
                }
                logEvent('mcp_http_request_failed', {
                    route: MCP_PATH,
                    error_type: error instanceof Error ? error.name : 'unknown',
                });
            } finally {
                if (isNewSession && newSession && !transport.sessionId) {
                    await closeSession(newSession).catch((error: unknown) => {
                        process.stderr.write(
                            `Failed to close uninitialized MCP HTTP session: ${error instanceof Error ? error.message : String(error)}\n`,
                        );
                    });
                }
            }
        },
    );

    httpServer.requestTimeout = config.http.requestTimeoutMs;
    httpServer.headersTimeout = config.http.headersTimeoutMs;
    httpServer.keepAliveTimeout = config.http.keepAliveTimeoutMs;
    httpServer.on('close', () => {
        clearInterval(cleanupInterval);
        for (const session of [...sessions.values(), ...pendingSessions]) {
            void closeSession(session).catch((error: unknown) => {
                process.stderr.write(
                    `Failed to close MCP HTTP session: ${error instanceof Error ? error.message : String(error)}\n`,
                );
            });
        }
    });

    await new Promise<void>((resolve, reject) => {
        const onListenError = (error: Error) => {
            logEvent('mcp_http_listen_failed', { error_type: error.name });
            reject(error);
        };
        httpServer.once('error', onListenError);
        httpServer.listen(config.http.port, config.http.host, () => {
            httpServer.off('error', onListenError);
            logEvent('mcp_http_listening', { host: config.http.host, port: config.http.port });
            resolve();
        });
    });

    return httpServer;
}
