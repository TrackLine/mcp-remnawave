import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import test from 'node:test';

async function getFreePort() {
    const server = createNetServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    server.close();
    await once(server, 'close');
    return address.port;
}

async function startPanel(handler) {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return { server, url: `http://127.0.0.1:${address.port}` };
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

async function startMcp(t, baseUrl, requestTimeoutMs) {
    const port = await getFreePort();
    const child = spawn(process.execPath, ['dist/index.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            REMNAWAVE_BASE_URL: baseUrl,
            REMNAWAVE_API_TOKEN: 'test-token',
            REMNAWAVE_RELEASE: 'v2',
            REMNAWAVE_REQUEST_TIMEOUT_MS: String(requestTimeoutMs),
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
                clientInfo: { name: 'client-test', version: '1.0.0' },
            },
        }),
    });
    assert.equal(response.status, 200);
    const sessionId = response.headers.get('mcp-session-id');
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

function callHealthTool(port, sessionId) {
    return callTool(port, sessionId, 2, 'system_health', {});
}

test(
    'Remnawave client completes requests before the configured timeout',
    { timeout: 10_000 },
    async (t) => {
        const panel = await startPanel((_request, response) => {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ status: 'ok' }));
        });
        t.after(async () => {
            panel.server.close();
            await once(panel.server, 'close');
        });

        const port = await startMcp(t, panel.url, 100);
        const sessionId = await createSession(port);
        const result = await callHealthTool(port, sessionId);

        assert.equal(result.result.isError, undefined);
        assert.deepEqual(JSON.parse(result.result.content[0].text), { status: 'ok' });
    },
);

test(
    'Remnawave client aborts slow requests with a clear timeout error',
    { timeout: 10_000 },
    async (t) => {
        const panel = await startPanel((_request, _response) => {
            // Keep the response open until the client's AbortSignal cancels the request.
        });
        t.after(async () => {
            panel.server.close();
            await once(panel.server, 'close');
        });

        const port = await startMcp(t, panel.url, 20);
        const sessionId = await createSession(port);
        const result = await callHealthTool(port, sessionId);

        assert.equal(result.result.isError, true);
        assert.match(result.result.content[0].text, /Remnawave API request timed out after 20ms/);
    },
);

test(
    'v2 config-profile update validates the contract and forwards config content',
    { timeout: 10_000 },
    async (t) => {
        const requests = [];
        const panel = await startPanel(async (request, response) => {
            const chunks = [];
            for await (const chunk of request) chunks.push(chunk);
            requests.push({
                method: request.method,
                url: request.url,
                body: Buffer.concat(chunks).toString(),
            });
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ updated: true }));
        });
        t.after(async () => {
            panel.server.close();
            await once(panel.server, 'close');
        });

        const port = await startMcp(t, panel.url, 100);
        const sessionId = await createSession(port);
        const invalid = await callTool(port, sessionId, 3, 'config_profiles_update', {
            uuid: 'not-a-uuid',
            name: 'invalid!',
        });
        const valid = await callTool(port, sessionId, 4, 'config_profiles_update', {
            uuid: '00000000-0000-0000-0000-000000000000',
            name: 'profile-1',
            config: { logLevel: 'debug', nested: { enabled: true } },
        });

        assert.ok(
            invalid.error || invalid.result?.isError,
            `invalid config-profile input was accepted: ${JSON.stringify(invalid)}`,
        );
        assert.deepEqual(requests, [
            {
                method: 'PATCH',
                url: '/api/config-profiles/',
                body: JSON.stringify({
                    uuid: '00000000-0000-0000-0000-000000000000',
                    name: 'profile-1',
                    config: { logLevel: 'debug', nested: { enabled: true } },
                }),
            },
        ]);
        assert.equal(valid.result.isError, undefined);
    },
);
