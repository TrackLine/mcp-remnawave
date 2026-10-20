#!/usr/bin/env node

/**
 * Generates the v3 MCP operation manifest from the committed Remnawave
 * OpenAPI document. The generator never fetches the network: updating the API
 * contract is an explicit reviewable change to openapi/.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const sourcePath = resolve(repositoryRoot, 'openapi/remnawave-v3.4.3.openapi.json');
const typescriptPath = resolve(repositoryRoot, 'src/v3/operations.generated.ts');
const jsonPath = resolve(repositoryRoot, 'openapi/remnawave-v3.4.3.operations.json');
const expectedSha256 = 'ed9ca9ea55da2b9da266db8f9e1e546e9caf2831a760655a18c1ddf35218c44b';
const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

const source = await readFile(sourcePath);
const checksum = createHash('sha256').update(source).digest('hex');
if (checksum !== expectedSha256) {
    throw new Error(
        `Unexpected OpenAPI SHA-256: ${checksum}. Update the source version and checksum together.`,
    );
}

const document = JSON.parse(source);
if (document.info?.version !== '3.4.3') {
    throw new Error(
        `Expected Remnawave API v3.4.3, received ${document.info?.version ?? 'unknown'}.`,
    );
}

function snakeCase(value) {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

function parameterDefaultStyle(location) {
    return location === 'path' ? 'simple' : 'form';
}

function parameterDefaultExplode(style) {
    return style === 'form';
}

function mergeParameters(pathParameters = [], operationParameters = []) {
    const parameters = new Map();
    for (const parameter of [...pathParameters, ...operationParameters]) {
        if (parameter.$ref) {
            throw new Error(`Unsupported referenced parameter: ${parameter.$ref}`);
        }
        if (parameter.in !== 'path' && parameter.in !== 'query') continue;
        const style = parameter.style ?? parameterDefaultStyle(parameter.in);
        parameters.set(`${parameter.in}:${parameter.name}`, {
            name: parameter.name,
            in: parameter.in,
            required: parameter.in === 'path' || parameter.required === true,
            style,
            explode: parameter.explode ?? parameterDefaultExplode(style),
            ...(parameter.description ? { description: parameter.description } : {}),
            ...(parameter.deprecated === true ? { deprecated: true } : {}),
            ...(parameter.allowReserved === true ? { allowReserved: true } : {}),
            ...(parameter.schema ? { schema: parameter.schema } : {}),
        });
    }
    return [...parameters.values()].sort((left, right) =>
        `${left.in}:${left.name}`.localeCompare(`${right.in}:${right.name}`),
    );
}

function jsonRequestBodies(requestBody) {
    if (!requestBody) return [];
    if (requestBody.$ref)
        throw new Error(`Unsupported referenced request body: ${requestBody.$ref}`);
    return Object.entries(requestBody.content ?? {})
        .filter(([contentType]) => /\/json(?:;|$)|\+json(?:;|$)/i.test(contentType))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([contentType, media]) => ({
            contentType,
            required: requestBody.required === true,
            ...(requestBody.description ? { description: requestBody.description } : {}),
            ...(media.schema ? { schema: media.schema } : {}),
        }));
}

function responses(responses = {}) {
    return Object.entries(responses)
        .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
        .map(([status, response]) => {
            if (response.$ref) throw new Error(`Unsupported referenced response: ${response.$ref}`);
            const contentTypes = Object.keys(response.content ?? {}).sort();
            return {
                status,
                isSuccess: /^2(?:XX|\d\d)$/.test(status),
                mayReturnEmpty: contentTypes.length === 0,
                ...(response.description ? { description: response.description } : {}),
                ...(contentTypes.length ? { contentTypes } : {}),
            };
        });
}

function componentName(reference) {
    const prefix = '#/components/schemas/';
    if (typeof reference !== 'string' || !reference.startsWith(prefix)) return undefined;
    return reference.slice(prefix.length);
}

function referencedComponentNames(value, names = new Set()) {
    if (Array.isArray(value)) {
        value.forEach((item) => referencedComponentNames(item, names));
    } else if (value && typeof value === 'object') {
        const name = componentName(value.$ref);
        if (name) names.add(name);
        Object.values(value).forEach((item) => referencedComponentNames(item, names));
    }
    return names;
}

/**
 * Bundle only the component schemas reachable from JSON request bodies. This
 * preserves a self-contained runtime manifest without copying response-only
 * schemas that MCP never needs to validate.
 */
function requestBodyComponentSchemas(operations) {
    const names = new Set();
    for (const operation of operations) {
        for (const requestBody of operation.requestBodies) {
            referencedComponentNames(requestBody.schema, names);
        }
    }

    // Component definitions may reference other components. Close the set so a
    // nested DTO is just as validatable as the body root.
    for (const name of names) {
        const schema = document.components?.schemas?.[name];
        if (!schema) throw new Error(`Unknown component schema: ${name}`);
        referencedComponentNames(schema, names);
    }

    return Object.fromEntries(
        [...names].sort().map((name) => [name, document.components.schemas[name]]),
    );
}

const operations = [];
for (const path of Object.keys(document.paths ?? {}).sort()) {
    const pathItem = document.paths[path];
    for (const method of httpMethods) {
        const operation = pathItem[method];
        if (!operation) continue;
        if (!operation.operationId)
            throw new Error(`${method.toUpperCase()} ${path} is missing operationId.`);
        const requestBodies = jsonRequestBodies(operation.requestBody);
        const responseMetadata = responses(operation.responses);
        const toolName = `rw_v3_${snakeCase(operation.operationId)}`;
        operations.push({
            operationId: operation.operationId,
            // `name` is the MCP tool name consumed by the runtime registry. Keep
            // `toolName` as an explicit alias for JSON consumers.
            name: toolName,
            toolName,
            method: method.toUpperCase(),
            path,
            ...(operation.summary ? { summary: operation.summary } : {}),
            ...(operation.description ? { description: operation.description } : {}),
            parameters: mergeParameters(pathItem.parameters, operation.parameters),
            ...(requestBodies.length ? { requestBody: requestBodies[0] } : {}),
            // The plural form preserves all JSON-compatible media types from the
            // OpenAPI document; the runtime uses the canonical first JSON body.
            requestBodies,
            // All current success statuses are concrete numeric HTTP statuses. Fail
            // fast rather than silently dropping an OpenAPI range such as "2XX".
            responses: responseMetadata
                .filter((response) => response.isSuccess)
                .map((response) => {
                    if (!/^\d{3}$/.test(response.status)) {
                        throw new Error(
                            `Non-numeric successful response status for ${operation.operationId}: ${response.status}`,
                        );
                    }
                    return Number(response.status);
                }),
            responseMetadata,
            tags: [...(operation.tags ?? [])].sort(),
        });
    }
}

const duplicateToolNames = operations
    .map(({ name }) => name)
    .filter((toolName, index, all) => all.indexOf(toolName) !== index);
if (duplicateToolNames.length) {
    throw new Error(`Tool-name collision(s): ${[...new Set(duplicateToolNames)].join(', ')}`);
}

const componentSchemas = requestBodyComponentSchemas(operations);

const manifest = {
    openapiVersion: document.openapi,
    apiVersion: document.info.version,
    source: 'openapi/remnawave-v3.4.3.openapi.json',
    sourceSha256: checksum,
    // Component schemas needed to resolve request-body $refs at runtime.
    componentSchemas,
    operations,
};
const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
const typescript = `// This file is generated by scripts/generate-v3-operations.mjs. Do not edit manually.\n\nexport type RemnawaveV3HttpMethod = ${httpMethods.map((method) => `"${method.toUpperCase()}"`).join(' | ')};\n\nexport interface RemnawaveV3Parameter {\n  readonly name: string;\n  readonly in: "path" | "query";\n  readonly required: boolean;\n  readonly style: string;\n  readonly explode: boolean;\n  readonly description?: string;\n  readonly deprecated?: boolean;\n  readonly allowReserved?: boolean;\n  readonly schema?: unknown;\n}\n\nexport interface RemnawaveV3JsonRequestBody {\n  readonly contentType: string;\n  readonly required: boolean;\n  readonly description?: string;\n  readonly schema?: unknown;\n}\n\nexport interface RemnawaveV3ResponseMetadata {\n  readonly status: string;\n  readonly isSuccess: boolean;\n  readonly mayReturnEmpty: boolean;\n  readonly description?: string;\n  readonly contentTypes?: readonly string[];\n}\n\nexport interface RemnawaveV3OperationDescriptor {\n  readonly operationId: string;\n  readonly name: string;\n  readonly toolName: string;\n  readonly method: RemnawaveV3HttpMethod;\n  readonly path: string;\n  readonly summary?: string;\n  readonly description?: string;\n  readonly parameters: readonly RemnawaveV3Parameter[];\n  readonly requestBody?: RemnawaveV3JsonRequestBody;\n  readonly requestBodies: readonly RemnawaveV3JsonRequestBody[];\n  /** Documented successful HTTP response status codes. */\n  readonly responses: readonly number[];\n  /** Full response metadata, including whether a documented response is empty. */\n  readonly responseMetadata: readonly RemnawaveV3ResponseMetadata[];\n  readonly tags: readonly string[];\n}\n\nexport const REMNAWAVE_V3_OPENAPI_VERSION = ${JSON.stringify(document.openapi)};\nexport const REMNAWAVE_V3_API_VERSION = ${JSON.stringify(document.info.version)};\nexport const REMNAWAVE_V3_OPENAPI_SHA256 = ${JSON.stringify(checksum)};\n/** OpenAPI schemas transitively referenced by JSON request bodies. */\nexport const V3_COMPONENT_SCHEMAS = ${JSON.stringify(componentSchemas, null, 2)} as const;\nexport const V3_OPERATIONS = ${JSON.stringify(operations, null, 2)} as const satisfies readonly RemnawaveV3OperationDescriptor[];\nexport const REMNAWAVE_V3_OPERATIONS = V3_OPERATIONS;\n`;

await Promise.all([writeFile(jsonPath, serializedManifest), writeFile(typescriptPath, typescript)]);
console.log(
    `Generated ${operations.length} operations from Remnawave API v${document.info.version}.`,
);
console.log(`OpenAPI SHA-256: ${checksum}`);
