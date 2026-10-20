import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import test from 'node:test';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const snapshot = JSON.parse(
    await readFile(new URL('../openapi/remnawave-v3.4.3.openapi.json', import.meta.url)),
);
const manifest = JSON.parse(
    await readFile(new URL('../openapi/remnawave-v3.4.3.operations.json', import.meta.url)),
);

function sourceOperations(document) {
    return Object.entries(document.paths)
        .flatMap(([path, pathItem]) =>
            Object.entries(pathItem)
                .filter(([method, operation]) => HTTP_METHODS.has(method) && operation?.operationId)
                .map(([method, operation]) => ({
                    operationId: operation.operationId,
                    method: method.toUpperCase(),
                    path,
                    hasJsonBody: Object.keys(operation.requestBody?.content ?? {}).some(
                        (contentType) =>
                            contentType === 'application/json' || contentType.endsWith('+json'),
                    ),
                })),
        )
        .sort((left, right) => left.operationId.localeCompare(right.operationId));
}

function componentReferences(value, names = new Set()) {
    if (Array.isArray(value)) value.forEach((item) => componentReferences(item, names));
    else if (value && typeof value === 'object') {
        if (typeof value.$ref === 'string' && value.$ref.startsWith('#/components/schemas/')) {
            names.add(value.$ref.slice('#/components/schemas/'.length));
        }
        Object.values(value).forEach((item) => componentReferences(item, names));
    }
    return names;
}

function expectedRequestBodyComponents(document) {
    const names = new Set();
    for (const pathItem of Object.values(document.paths)) {
        for (const operation of Object.values(pathItem)) {
            for (const [contentType, media] of Object.entries(
                operation?.requestBody?.content ?? {},
            )) {
                if (contentType === 'application/json' || contentType.endsWith('+json')) {
                    componentReferences(media.schema, names);
                }
            }
        }
    }
    for (const name of names) componentReferences(document.components.schemas[name], names);
    return Object.fromEntries(
        [...names].sort().map((name) => [name, document.components.schemas[name]]),
    );
}

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

test('the generated v3 manifest covers every operation in the pinned OpenAPI snapshot', () => {
    const expected = sourceOperations(snapshot);
    const actual = manifest.operations
        .map(({ operationId, method, path }) => ({ operationId, method, path }))
        .sort((left, right) => left.operationId.localeCompare(right.operationId));

    assert.equal(snapshot.info.version, '3.4.3');
    assert.equal(expected.length, 217);
    assert.deepEqual(
        actual,
        expected.map(({ hasJsonBody: _hasJsonBody, ...operation }) => operation),
    );
    assert.equal(
        new Set(manifest.operations.map(({ toolName }) => toolName)).size,
        expected.length,
    );
    assert.equal(
        manifest.operations.filter(({ requestBodies }) => requestBodies.length > 0).length,
        expected.filter(({ hasJsonBody }) => hasJsonBody).length,
        'every JSON request body must be available to its MCP tool',
    );
});

test('the generated manifest has stable OpenAPI provenance and canonical tool names', () => {
    assert.equal(manifest.apiVersion, snapshot.info.version);
    assert.equal(
        manifest.sourceSha256,
        'ed9ca9ea55da2b9da266db8f9e1e546e9caf2831a760655a18c1ddf35218c44b',
    );
    for (const operation of manifest.operations) {
        assert.match(operation.toolName, /^rw_v3_[a-z0-9_]+$/);
        assert.ok(
            operation.responses.length > 0,
            `${operation.operationId} has no success response`,
        );
        assert.ok(
            operation.responseMetadata.some(({ isSuccess }) => isSuccess),
            `${operation.operationId} has no successful response metadata`,
        );
    }
});

test('the generated v3 manifest includes every request-body schema and its transitive component dependencies', () => {
    const expected = expectedRequestBodyComponents(snapshot);
    assert.deepEqual(manifest.componentSchemas, expected);

    let requiredFields = 0;
    for (const operation of manifest.operations) {
        for (const body of operation.requestBodies) {
            const references = componentReferences(body.schema);
            assert.ok(
                references.size > 0,
                `${operation.operationId} body must retain its OpenAPI schema`,
            );
            for (const reference of references) {
                assert.ok(
                    manifest.componentSchemas[reference],
                    `${operation.operationId} references missing ${reference}`,
                );
            }
        }
    }
    for (const schema of Object.values(manifest.componentSchemas)) {
        if (schema?.type !== 'object' || !Array.isArray(schema.required)) continue;
        for (const field of schema.required) {
            requiredFields += 1;
            assert.ok(schema.properties?.[field], `required field ${field} must have a schema`);
        }
    }
    assert.ok(
        requiredFields > 100,
        'expected broad required-field coverage from the v3 request DTOs',
    );
});

test(
    'v3 is the default and registers every generated operation as an MCP tool',
    { timeout: 10_000 },
    async (t) => {
        const port = await freePort();
        const child = spawn(process.execPath, ['dist/index.js'], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                REMNAWAVE_BASE_URL: 'https://panel.example.test',
                REMNAWAVE_API_TOKEN: 'test-token',
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
                    clientInfo: { name: 'test', version: '1.0.0' },
                },
            }),
        });
        const sessionId = initialized.headers.get('mcp-session-id');
        assert.equal(initialized.status, 200);
        assert.ok(sessionId);

        const listed = await fetch(`http://127.0.0.1:${port}/mcp`, {
            method: 'POST',
            headers: {
                ...headers,
                'mcp-protocol-version': '2025-11-25',
                'mcp-session-id': sessionId,
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
        });
        const toolNames = (await listed.json()).result.tools.map(({ name }) => name).sort();
        assert.equal(listed.status, 200);
        assert.deepEqual(toolNames, manifest.operations.map(({ toolName }) => toolName).sort());
    },
);

test('v3 readonly mode exposes only documented GET operations', { timeout: 10_000 }, async (t) => {
    const port = await freePort();
    const child = spawn(process.execPath, ['dist/index.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            REMNAWAVE_BASE_URL: 'https://panel.example.test',
            REMNAWAVE_API_TOKEN: 'test-token',
            REMNAWAVE_READONLY: 'true',
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
                clientInfo: { name: 'test', version: '1.0.0' },
            },
        }),
    });
    const sessionId = initialized.headers.get('mcp-session-id');
    assert.equal(initialized.status, 200);
    assert.ok(sessionId);

    const listed = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: { ...headers, 'mcp-protocol-version': '2025-11-25', 'mcp-session-id': sessionId },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    const toolNames = (await listed.json()).result.tools.map(({ name }) => name).sort();
    assert.equal(listed.status, 200);
    assert.deepEqual(
        toolNames,
        manifest.operations
            .filter(({ method }) => method === 'GET')
            .map(({ toolName }) => toolName)
            .sort(),
    );
});
