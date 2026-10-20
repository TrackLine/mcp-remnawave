import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodTypeAny } from 'zod';
import {
    RemnawaveV3Client,
    type V3OperationDescriptor,
    type V3ParameterDescriptor,
} from './client.js';

type Manifest = readonly V3OperationDescriptor[];
type ComponentSchemas = Readonly<Record<string, unknown>>;

const COMPONENT_REF_PREFIX = '#/components/schemas/';

/** HTTP methods whose semantics are defined as safe by RFC 9110. */
export const READONLY_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function schemaReference(value: unknown): string | undefined {
    return isRecord(value) &&
        typeof value.$ref === 'string' &&
        value.$ref.startsWith(COMPONENT_REF_PREFIX)
        ? value.$ref.slice(COMPONENT_REF_PREFIX.length)
        : undefined;
}

/**
 * Converts the validation subset used by the pinned OpenAPI document to Zod.
 * Unknown keywords deliberately remain permissive, but every representable
 * type, required field, enum, and common string format is validated before a
 * tool handler can invoke the HTTP client.
 */
function openApiSchema(
    source: unknown,
    components: ComponentSchemas,
    resolving = new Set<string>(),
): ZodTypeAny {
    const reference = schemaReference(source);
    if (reference) {
        if (resolving.has(reference)) return z.unknown();
        const target = components[reference];
        if (!target) return z.never();
        const nested = new Set(resolving);
        nested.add(reference);
        return openApiSchema(target, components, nested);
    }
    if (!isRecord(source)) return z.unknown();

    const variants = source.oneOf ?? source.anyOf;
    let schema: ZodTypeAny;
    if (Array.isArray(variants) && variants.length > 0) {
        const options = variants.map((variant) => openApiSchema(variant, components, resolving));
        schema =
            options.length === 1
                ? options[0]
                : z.union(options as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
    } else if (Array.isArray(source.allOf) && source.allOf.length > 0) {
        schema = openApiSchema(source.allOf[0], components, resolving);
        for (const variant of source.allOf.slice(1)) {
            schema = z.intersection(schema, openApiSchema(variant, components, resolving));
        }
    } else {
        const declaredType = Array.isArray(source.type)
            ? source.type.find(
                  (type): type is string => typeof type === 'string' && type !== 'null',
              )
            : source.type;
        if (declaredType === 'integer' || declaredType === 'number') {
            let numeric = z.number();
            if (declaredType === 'integer') numeric = numeric.int();
            const minimum = numberValue(source.minimum);
            const maximum = numberValue(source.maximum);
            if (minimum !== undefined) {
                numeric =
                    source.exclusiveMinimum === true ? numeric.gt(minimum) : numeric.min(minimum);
            }
            if (maximum !== undefined) {
                numeric =
                    source.exclusiveMaximum === true ? numeric.lt(maximum) : numeric.max(maximum);
            }
            if (typeof source.exclusiveMinimum === 'number')
                numeric = numeric.gt(source.exclusiveMinimum);
            if (typeof source.exclusiveMaximum === 'number')
                numeric = numeric.lt(source.exclusiveMaximum);
            schema = numeric;
        } else if (declaredType === 'boolean') {
            schema = z.boolean();
        } else if (declaredType === 'array') {
            let array = z.array(openApiSchema(source.items, components, resolving));
            const minItems = numberValue(source.minItems);
            const maxItems = numberValue(source.maxItems);
            if (minItems !== undefined) array = array.min(minItems);
            if (maxItems !== undefined) array = array.max(maxItems);
            schema = array;
        } else if (declaredType === 'object') {
            const properties = isRecord(source.properties) ? source.properties : {};
            const required = new Set(
                Array.isArray(source.required)
                    ? source.required.filter((field): field is string => typeof field === 'string')
                    : [],
            );
            const fields: Record<string, ZodTypeAny> = {};
            for (const [name, property] of Object.entries(properties)) {
                const propertySchema = openApiSchema(property, components, resolving);
                fields[name] = required.has(name) ? propertySchema : propertySchema.optional();
            }
            const additionalProperties = source.additionalProperties;
            if (additionalProperties === false) schema = z.object(fields).strict();
            else if (isRecord(additionalProperties))
                schema = z
                    .object(fields)
                    .catchall(openApiSchema(additionalProperties, components, resolving));
            else schema = z.object(fields).passthrough();
        } else {
            let string = z.string();
            if (source.format === 'uuid') string = string.uuid();
            else if (source.format === 'email') string = string.email();
            else if (source.format === 'date') string = string.date();
            else if (source.format === 'date-time') string = string.datetime({ offset: true });
            else if (source.format === 'uri') string = string.url();
            const minLength = numberValue(source.minLength);
            const maxLength = numberValue(source.maxLength);
            if (minLength !== undefined) string = string.min(minLength);
            if (maxLength !== undefined) string = string.max(maxLength);
            if (typeof source.pattern === 'string') {
                try {
                    string = string.regex(new RegExp(source.pattern));
                } catch {
                    // A malformed OpenAPI pattern must not make server startup fail.
                }
            }
            schema = string;
        }
    }

    if (Array.isArray(source.enum) && source.enum.length > 0) {
        const values = source.enum;
        schema = schema.refine((value) => values.some((candidate) => Object.is(candidate, value)), {
            message: `Expected one of: ${values.map(String).join(', ')}`,
        });
    }
    if ('const' in source) {
        schema = schema.refine((value) => Object.is(value, source.const), {
            message: `Expected constant value: ${String(source.const)}`,
        });
    }
    if (source.nullable === true || (Array.isArray(source.type) && source.type.includes('null')))
        schema = schema.nullable();
    return typeof source.description === 'string' ? schema.describe(source.description) : schema;
}

function parameters(
    operation: V3OperationDescriptor,
    location: 'path' | 'query',
): readonly V3ParameterDescriptor[] {
    const named = location === 'path' ? operation.pathParameters : operation.queryParameters;
    return named ?? operation.parameters?.filter((parameter) => parameter.in === location) ?? [];
}

function parameterSchema(
    parameter: V3ParameterDescriptor,
    components: ComponentSchemas,
): ZodTypeAny {
    let schema = openApiSchema(parameter.schema, components);
    if (parameter.description) schema = schema.describe(parameter.description);
    return parameter.required === false ? schema.optional() : schema;
}

function parameterObject(
    parametersList: readonly V3ParameterDescriptor[],
    label: string,
    components: ComponentSchemas,
): ZodTypeAny {
    const fields: Record<string, ZodTypeAny> = {};
    for (const parameter of parametersList)
        fields[parameter.name] = parameterSchema(parameter, components);
    const schema = z.object(fields);
    return parametersList.some((parameter) => parameter.required !== false)
        ? schema.describe(label)
        : schema.optional().describe(label);
}

function bodySchema(
    operation: V3OperationDescriptor,
    components: ComponentSchemas,
): ZodTypeAny | undefined {
    const requestBody =
        operation.requestBody ??
        operation.requestBodies?.find(
            (candidate) =>
                !('contentType' in candidate) || candidate.contentType === 'application/json',
        );
    if (!requestBody) return undefined;
    let schema = openApiSchema(requestBody.schema, components);
    if (requestBody.description) schema = schema.describe(requestBody.description);
    return requestBody.required === false ? schema.optional() : schema;
}

function toolName(operation: V3OperationDescriptor): string {
    const source = operation.toolName ?? operation.operationId;
    if (!source)
        throw new Error(
            `v3 operation missing operationId for ${operation.method} ${operation.pathTemplate ?? operation.path ?? ''}`,
        );
    return source;
}

function toolDescription(operation: V3OperationDescriptor): string {
    const summary = operation.summary ?? operation.description ?? 'Remnawave API operation';
    return `${summary} (${operation.method.toUpperCase()} ${operation.pathTemplate ?? operation.path ?? ''})`;
}

function successResult(value: unknown) {
    return {
        content: [
            {
                type: 'text' as const,
                text:
                    value === undefined ? 'Success (no content).' : JSON.stringify(value, null, 2),
            },
        ],
    };
}

function errorResult(error: unknown) {
    return {
        content: [
            {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : 'Remnawave API request failed'}`,
            },
        ],
        isError: true,
    };
}

/** Register exactly one MCP tool for each v3 OpenAPI operation. */
export function registerV3Tools(
    server: McpServer,
    client: RemnawaveV3Client,
    readonly: boolean,
    manifest: Manifest,
    componentSchemas: ComponentSchemas = {},
) {
    for (const operation of manifest) {
        if (readonly && !READONLY_HTTP_METHODS.has(operation.method.toUpperCase())) continue;
        const schema: Record<string, ZodTypeAny> = {};
        const path = parameters(operation, 'path');
        const query = parameters(operation, 'query');
        if (path.length) schema.path = parameterObject(path, 'Path parameters', componentSchemas);
        if (query.length)
            schema.query = parameterObject(query, 'Query parameters', componentSchemas);
        const body = bodySchema(operation, componentSchemas);
        if (body) schema.body = body;

        server.tool(toolName(operation), toolDescription(operation), schema, async (input) => {
            try {
                return successResult(await client.invoke(operation, input));
            } catch (error) {
                return errorResult(error);
            }
        });
    }
}
