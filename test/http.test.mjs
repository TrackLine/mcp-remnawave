import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import test from 'node:test';

async function getFreePort() {
    const server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    server.close();
    await once(server, 'close');
    return address.port;
}

async function waitForHttpServer(child) {
    let stderr = '';

    await new Promise((resolve, reject) => {
        const onData = (chunk) => {
            stderr += chunk;
            if (stderr.includes('/mcp')) {
                cleanup();
                resolve();
            }
        };
        const onExit = (code) => {
            cleanup();
            reject(new Error(`Server stopped before listening: ${code}; ${stderr}`));
        };
        const cleanup = () => {
            child.stderr.off('data', onData);
            child.off('exit', onExit);
        };

        child.stderr.on('data', onData);
        child.once('exit', onExit);
    });
}

test('serves MCP requests over HTTP', { timeout: 10_000 }, async (t) => {
    const port = await getFreePort();
    const child = spawn(process.execPath, ['dist/index.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            REMNAWAVE_BASE_URL: 'https://panel.example.test',
            REMNAWAVE_API_TOKEN: 'test-token',
            REMNAWAVE_RELEASE: 'v2',
            MCP_HTTP_ENABLED: 'true',
            MCP_HTTP_HOST: '127.0.0.1',
            MCP_HTTP_PORT: String(port),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill();
            await once(child, 'exit');
        }
    });

    await waitForHttpServer(child);

    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const headers = {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
    };
    const initialize = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-11-25',
                capabilities: {},
                clientInfo: { name: 'http-test', version: '1.0.0' },
            },
        }),
    });

    assert.equal(initialize.status, 200);
    const sessionId = initialize.headers.get('mcp-session-id');
    assert.ok(sessionId);
    assert.equal((await initialize.json()).result.serverInfo.version, '1.3.1');

    const tools = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
            ...headers,
            'mcp-protocol-version': '2025-11-25',
            'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {},
        }),
    });

    assert.equal(tools.status, 200);
    assert.equal((await tools.json()).result.tools.length, 153);
});

test(
    'optionally requires bearer authentication for MCP while keeping health public',
    { timeout: 10_000 },
    async (t) => {
        const port = await getFreePort();
        const child = spawn(process.execPath, ['dist/index.js'], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                REMNAWAVE_BASE_URL: 'https://panel.example.test',
                REMNAWAVE_API_TOKEN: 'test-token',
                REMNAWAVE_RELEASE: 'v2',
                MCP_HTTP_ENABLED: 'true',
                MCP_HTTP_HOST: '127.0.0.1',
                MCP_HTTP_PORT: String(port),
                MCP_HTTP_AUTH_TOKEN: 'http-secret',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        t.after(async () => {
            if (child.exitCode === null && child.signalCode === null) {
                child.kill();
                await once(child, 'exit');
            }
        });

        await waitForHttpServer(child);

        const health = await fetch(`http://127.0.0.1:${port}/healthz`);
        assert.equal(health.status, 200);

        const request = {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-11-25',
                capabilities: {},
                clientInfo: { name: 'http-auth-test', version: '1.0.0' },
            },
        };
        const requestHeaders = {
            accept: 'application/json, text/event-stream',
            'content-type': 'application/json',
        };

        const unauthorized = await fetch(`http://127.0.0.1:${port}/mcp`, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(request),
        });
        assert.equal(unauthorized.status, 401);
        assert.equal(unauthorized.headers.get('www-authenticate'), 'Bearer');

        const authorized = await fetch(`http://127.0.0.1:${port}/mcp`, {
            method: 'POST',
            headers: { ...requestHeaders, authorization: 'Bearer http-secret' },
            body: JSON.stringify(request),
        });
        assert.equal(authorized.status, 200);
        assert.ok(authorized.headers.get('mcp-session-id'));
    },
);

test('enforces declared MCP request-body and session limits', { timeout: 10_000 }, async (t) => {
    const port = await getFreePort();
    const child = spawn(process.execPath, ['dist/index.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            REMNAWAVE_BASE_URL: 'https://panel.example.test',
            REMNAWAVE_API_TOKEN: 'test-token',
            REMNAWAVE_RELEASE: 'v2',
            MCP_HTTP_ENABLED: 'true',
            MCP_HTTP_HOST: '127.0.0.1',
            MCP_HTTP_PORT: String(port),
            MCP_HTTP_MAX_BODY_BYTES: '512',
            MCP_HTTP_MAX_SESSIONS: '1',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill();
            await once(child, 'exit');
        }
    });

    await waitForHttpServer(child);

    const headers = {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
    };
    const initializeBody = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'http-limit-test', version: '1.0.0' },
        },
    });
    const firstSession = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers,
        body: initializeBody,
    });
    assert.equal(firstSession.status, 200);

    const secondSession = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers,
        body: initializeBody,
    });
    assert.equal(secondSession.status, 503);

    const tooLarge = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ payload: 'x'.repeat(1_024) }),
    });
    assert.equal(tooLarge.status, 413);
});

test(
    'exposes public readiness and authenticated Prometheus metrics',
    { timeout: 10_000 },
    async (t) => {
        let upstreamHealthy = true;
        let upstreamHeaders;
        const panel = createHttpServer((request, response) => {
            upstreamHeaders = request.headers;
            assert.equal(request.method, 'GET');
            assert.equal(request.url, '/api/system/health');
            response.writeHead(upstreamHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ secret: 'must-not-be-returned' }));
        });
        panel.listen(0, '127.0.0.1');
        await once(panel, 'listening');
        const panelAddress = panel.address();
        assert.ok(panelAddress && typeof panelAddress !== 'string');
        t.after(async () => {
            panel.close();
            await once(panel, 'close');
        });

        const port = await getFreePort();
        const child = spawn(process.execPath, ['dist/index.js'], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                REMNAWAVE_BASE_URL: `http://127.0.0.1:${panelAddress.port}`,
                REMNAWAVE_API_TOKEN: 'panel-token',
                REMNAWAVE_API_KEY: 'panel-key',
                CF_ACCESS_CLIENT_ID: 'cf-client',
                CF_ACCESS_CLIENT_SECRET: 'cf-secret',
                REMNAWAVE_RELEASE: 'v2',
                MCP_HTTP_ENABLED: 'true',
                MCP_HTTP_HOST: '127.0.0.1',
                MCP_HTTP_PORT: String(port),
                MCP_HTTP_AUTH_TOKEN: 'metrics-secret',
                MCP_HTTP_READINESS_TIMEOUT_MS: '1000',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        t.after(async () => {
            if (child.exitCode === null && child.signalCode === null) {
                child.kill();
                await once(child, 'exit');
            }
        });

        await waitForHttpServer(child);

        const ready = await fetch(`http://127.0.0.1:${port}/readyz`);
        assert.equal(ready.status, 200);
        assert.deepEqual(await ready.json(), { status: 'ok' });
        assert.equal(upstreamHeaders.authorization, 'Bearer panel-token');
        assert.equal(upstreamHeaders['content-type'], 'application/json');
        assert.equal(upstreamHeaders['x-api-key'], 'panel-key');
        assert.equal(upstreamHeaders['cf-access-client-id'], 'cf-client');
        assert.equal(upstreamHeaders['cf-access-client-secret'], 'cf-secret');

        const unauthenticatedMetrics = await fetch(`http://127.0.0.1:${port}/metrics`);
        assert.equal(unauthenticatedMetrics.status, 401);

        upstreamHealthy = false;
        const unavailable = await fetch(`http://127.0.0.1:${port}/readyz`);
        assert.equal(unavailable.status, 503);
        assert.deepEqual(await unavailable.json(), { status: 'unavailable' });

        const metrics = await fetch(`http://127.0.0.1:${port}/metrics`, {
            headers: { authorization: 'Bearer metrics-secret' },
        });
        assert.equal(metrics.status, 200);
        const metricsText = await metrics.text();
        assert.match(
            metricsText,
            /remnawave_mcp_http_requests_total\{route="\/readyz",status="200"\} 1/,
        );
        assert.match(metricsText, /remnawave_mcp_http_errors_total 1/);
    },
);
