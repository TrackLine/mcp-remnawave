import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';

async function freePort() {
    const server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    server.close();
    await once(server, 'close');
    return address.port;
}

async function startReadonlyV2(t) {
    const port = await freePort();
    const child = spawn(process.execPath, ['dist/index.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            REMNAWAVE_BASE_URL: 'https://panel.example.test',
            REMNAWAVE_API_TOKEN: 'test-token',
            REMNAWAVE_RELEASE: 'v2',
            REMNAWAVE_READONLY: 'true',
            MCP_HTTP_ENABLED: 'true',
            MCP_HTTP_HOST: '127.0.0.1',
            MCP_HTTP_PORT: String(port),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
    });
    while (!stderr.includes('/mcp')) await new Promise((resolve) => setTimeout(resolve, 10));
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill();
            await once(child, 'exit');
        }
    });
    return port;
}

test('v2 readonly omits POST-only tools', { timeout: 10_000 }, async (t) => {
    const port = await startReadonlyV2(t);
    const headers = {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
    };
    const initialized = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-11-25',
                capabilities: {},
                clientInfo: { name: 'readonly-test', version: '1.0.0' },
            },
        }),
    });
    assert.equal(initialized.status, 200);
    const sessionId = initialized.headers.get('mcp-session-id');
    assert.ok(sessionId);
    const listed = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: { ...headers, 'mcp-protocol-version': '2025-11-25', 'mcp-session-id': sessionId },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    assert.equal(listed.status, 200);
    const names = (await listed.json()).result.tools.map(({ name }) => name);
    assert.equal(names.length, 65);
    assert.ok(!names.includes('system_srr_matcher'));
    assert.ok(!names.includes('users_resolve'));
    assert.ok(!names.includes('ip_control_fetch_ips'));
    assert.ok(!names.includes('ip_control_fetch_users_ips'));
});
