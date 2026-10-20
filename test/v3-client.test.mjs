import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import test from 'node:test';

async function freePort() {
    const server = createNetServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    server.close();
    await once(server, 'close');
    return address.port;
}

async function waitForServer(child) {
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

async function startPanel(t) {
    const requests = [];
    const server = createHttpServer(async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        requests.push({
            method: request.method,
            url: request.url,
            authorization: request.headers.authorization,
            apiKey: request.headers['x-api-key'],
            body: Buffer.concat(chunks).toString(),
        });
        if (request.url.startsWith('/api/nodes/')) {
            response.writeHead(204).end();
        } else {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ ok: true }));
        }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    t.after(async () => {
        server.close();
        await once(server, 'close');
    });
    return { baseUrl: `http://127.0.0.1:${address.port}`, requests };
}

async function startMcp(t, baseUrl) {
    const port = await freePort();
    const child = spawn(process.execPath, ['dist/index.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            REMNAWAVE_BASE_URL: baseUrl,
            REMNAWAVE_API_TOKEN: 'test-token',
            REMNAWAVE_API_KEY: 'caddy-key',
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
    await waitForServer(child);
    return port;
}

async function createSession(port) {
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
            accept: 'application/json, text/event-stream',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-11-25',
                capabilities: {},
                clientInfo: { name: 'test', version: '1.0.0' },
            },
        }),
    });
    const sessionId = response.headers.get('mcp-session-id');
    assert.equal(response.status, 200);
    assert.ok(sessionId);
    return sessionId;
}

async function callTool(port, sessionId, id, name, args) {
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
            accept: 'application/json, text/event-stream',
            'content-type': 'application/json',
            'mcp-protocol-version': '2025-11-25',
            'mcp-session-id': sessionId,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            method: 'tools/call',
            params: { name, arguments: args },
        }),
    });
    assert.equal(response.status, 200);
    return response.json();
}

test(
    'v3 tools dispatch documented JSON bodies, parameters, headers, and empty responses',
    { timeout: 10_000 },
    async (t) => {
        const panel = await startPanel(t);
        const port = await startMcp(t, panel.baseUrl);
        const sessionId = await createSession(port);

        const usage = await callTool(
            port,
            sessionId,
            2,
            'rw_v3_bandwidth_stats_nodes_controller_get_node_usage',
            {
                query: { start: '2026-01-01', end: '2026-01-31', minTotalBytes: 7 },
                body: { nodesUuids: ['00000000-0000-0000-0000-000000000000'] },
            },
        );
        const restart = await callTool(port, sessionId, 3, 'rw_v3_nodes_controller_restart_node', {
            path: { uuid: '00000000-0000-0000-0000-000000000000' },
            body: { forceRestart: true },
        });

        assert.equal(usage.result.isError, undefined);
        assert.equal(restart.result.content[0].text, 'Success (no content).');
        assert.deepEqual(panel.requests, [
            {
                method: 'POST',
                url: '/api/bandwidth-stats/nodes/usage?end=2026-01-31&minTotalBytes=7&start=2026-01-01',
                authorization: 'Bearer test-token',
                apiKey: 'caddy-key',
                body: '{"nodesUuids":["00000000-0000-0000-0000-000000000000"]}',
            },
            {
                method: 'POST',
                url: '/api/nodes/00000000-0000-0000-0000-000000000000/actions/restart',
                authorization: 'Bearer test-token',
                apiKey: 'caddy-key',
                body: '{"forceRestart":true}',
            },
        ]);
    },
);

test(
    'v3 schemas reject invalid body, UUID, and enum inputs before an HTTP request',
    { timeout: 10_000 },
    async (t) => {
        const panel = await startPanel(t);
        const port = await startMcp(t, panel.baseUrl);
        const sessionId = await createSession(port);

        const invalidBody = await callTool(
            port,
            sessionId,
            2,
            'rw_v3_bandwidth_stats_nodes_controller_get_node_usage',
            {
                query: { start: '2026-01-01', end: '2026-01-31' },
                body: { nodesUuids: [] },
            },
        );
        const invalidUuid = await callTool(
            port,
            sessionId,
            3,
            'rw_v3_nodes_controller_restart_node',
            {
                path: { uuid: 'not-a-uuid' },
                body: { forceRestart: true },
            },
        );
        const invalidEnum = await callTool(
            port,
            sessionId,
            4,
            'rw_v3_subscription_controller_get_subscription_by_client_type',
            {
                path: { shortUuid: 'public-id', clientType: 'unsupported' },
            },
        );

        for (const response of [invalidBody, invalidUuid, invalidEnum]) {
            assert.equal(response.result?.isError, true, JSON.stringify(response));
            assert.match(
                response.result.content[0].text,
                /MCP error -32602: Input validation error/,
            );
        }
        assert.deepEqual(panel.requests, []);
    },
);
