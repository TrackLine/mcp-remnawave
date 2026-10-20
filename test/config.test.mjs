import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
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

async function listTools(port) {
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
                clientInfo: { name: 'config-test', version: '1.0.0' },
            },
        }),
    });
    assert.equal(initialize.status, 200);
    const sessionId = initialize.headers.get('mcp-session-id');
    assert.ok(sessionId);

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
            ...headers,
            'mcp-protocol-version': '2025-11-25',
            'mcp-session-id': sessionId,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).result.tools;
}

test(
    'defaults to the v3 MCP surface when REMNAWAVE_RELEASE is absent',
    { timeout: 10_000 },
    async (t) => {
        const port = await getFreePort();
        const env = {
            ...process.env,
            REMNAWAVE_BASE_URL: 'https://panel.example.test',
            REMNAWAVE_API_TOKEN: 'test-token',
            MCP_HTTP_ENABLED: 'true',
            MCP_HTTP_HOST: '127.0.0.1',
            MCP_HTTP_PORT: String(port),
        };
        delete env.REMNAWAVE_RELEASE;
        const child = spawn(process.execPath, ['dist/index.js'], {
            cwd: process.cwd(),
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        t.after(async () => {
            if (child.exitCode === null && child.signalCode === null) {
                child.kill();
                await once(child, 'exit');
            }
        });
        await waitForHttpServer(child);

        const tools = await listTools(port);
        assert.equal(tools.length, 217);
        assert.ok(tools.every((tool) => tool.name.startsWith('rw_v3_')));
    },
);

test('rejects a release other than exactly v2 or v3', { timeout: 10_000 }, async () => {
    const child = spawn(process.execPath, ['dist/index.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            REMNAWAVE_BASE_URL: 'https://panel.example.test',
            REMNAWAVE_API_TOKEN: 'test-token',
            REMNAWAVE_RELEASE: 'V3',
        },
        stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
    });
    const [code] = await once(child, 'exit');
    assert.notEqual(code, 0);
    assert.match(stderr, /REMNAWAVE_RELEASE must be exactly "v2" or "v3"/);
});

test('rejects ambiguous boolean configuration values', { timeout: 10_000 }, async () => {
    const child = spawn(process.execPath, ['dist/index.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            REMNAWAVE_BASE_URL: 'https://panel.example.test',
            REMNAWAVE_API_TOKEN: 'test-token',
            REMNAWAVE_READONLY: '1',
        },
        stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
    });
    const [code] = await once(child, 'exit');
    assert.notEqual(code, 0);
    assert.match(stderr, /REMNAWAVE_READONLY must be exactly "true" or "false"/);
});
