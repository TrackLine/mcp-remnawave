import { Config } from '../config.js';

/**
 * A deliberately small representation of the pieces of OpenAPI used at
 * runtime.  The generated operation manifest is the source of truth; this
 * client does not need the entire OpenAPI document in memory.
 */
export interface V3ParameterDescriptor {
    name: string;
    in: 'path' | 'query';
    required?: boolean;
    description?: string;
    schema?: unknown;
    style?: string;
    explode?: boolean;
}

export interface V3RequestBodyDescriptor {
    required?: boolean;
    description?: string;
    schema?: unknown;
    contentType?: string;
}

export interface V3OperationDescriptor {
    operationId?: string;
    toolName?: string;
    method: string;
    pathTemplate?: string;
    path?: string;
    summary?: string;
    description?: string;
    pathParameters?: readonly V3ParameterDescriptor[];
    queryParameters?: readonly V3ParameterDescriptor[];
    /** Supported too, so generated manifests may retain OpenAPI's flat form. */
    parameters?: readonly V3ParameterDescriptor[];
    requestBody?: V3RequestBodyDescriptor;
    requestBodies?: readonly V3RequestBodyDescriptor[];
    responses?: readonly unknown[];
}

export interface V3OperationInput {
    path?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
}

function errorMessage(body: unknown, status: number, statusText: string): string {
    if (typeof body === 'object' && body !== null) {
        const candidate = body as { message?: unknown; error?: unknown; errorCode?: unknown };
        const message =
            typeof candidate.message === 'string'
                ? candidate.message
                : typeof candidate.error === 'string'
                  ? candidate.error
                  : undefined;
        const code = typeof candidate.errorCode === 'string' ? ` (${candidate.errorCode})` : '';
        if (message) return `${message}${code}`;
    }
    return `HTTP ${status}${statusText ? ` ${statusText}` : ''}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valueToString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    return JSON.stringify(value);
}

/** A generic HTTP client for every operation described by the v3 OpenAPI manifest. */
export class RemnawaveV3Client {
    private readonly baseUrl: string;
    private readonly headers: Record<string, string>;
    private readonly requestTimeoutMs: number;
    private readonly secrets: string[];

    constructor(config: Config) {
        this.baseUrl = config.baseUrl;
        this.requestTimeoutMs = config.requestTimeoutMs;
        this.headers = {
            Authorization: `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json',
        };
        if (config.apiKey) this.headers['X-Api-Key'] = config.apiKey;
        if (config.cfAccessClientId) this.headers['CF-Access-Client-Id'] = config.cfAccessClientId;
        if (config.cfAccessClientSecret)
            this.headers['CF-Access-Client-Secret'] = config.cfAccessClientSecret;
        this.secrets = [
            config.apiToken,
            config.apiKey,
            config.cfAccessClientId,
            config.cfAccessClientSecret,
        ].filter((value): value is string => Boolean(value));
    }

    async invoke(operation: V3OperationDescriptor, input: V3OperationInput = {}): Promise<unknown> {
        const path = this.interpolatePath(operation, input.path ?? {});
        const url = new URL(`${this.baseUrl}${path}`);
        this.appendQuery(url.searchParams, this.queryParameters(operation), input.query ?? {});

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
        try {
            const response = await fetch(url, {
                method: operation.method.toUpperCase(),
                headers: this.headers,
                body: input.body === undefined ? undefined : JSON.stringify(input.body),
                signal: controller.signal,
            });

            if (!response.ok) {
                let body: unknown;
                try {
                    body = await response.json();
                } catch {
                    // Do not include an arbitrary proxy error page in MCP output.
                    body = undefined;
                }
                throw new Error(
                    this.redact(errorMessage(body, response.status, response.statusText)),
                );
            }

            if (response.status === 204 || response.headers.get('content-length') === '0') {
                return undefined;
            }
            const text = await response.text();
            if (!text.trim()) return undefined;
            try {
                return JSON.parse(text);
            } catch {
                return text;
            }
        } catch (error) {
            if (controller.signal.aborted) {
                throw new Error(`Remnawave API request timed out after ${this.requestTimeoutMs}ms`);
            }
            if (error instanceof Error) throw new Error(this.redact(error.message));
            throw new Error('Remnawave API request failed');
        } finally {
            clearTimeout(timeout);
        }
    }

    private interpolatePath(
        operation: V3OperationDescriptor,
        input: Record<string, unknown>,
    ): string {
        const template = operation.pathTemplate ?? operation.path;
        if (!template)
            throw new Error(
                `Operation ${operation.operationId ?? operation.toolName ?? 'unknown'} has no path template`,
            );
        const parameters = this.pathParameters(operation);
        return template.replace(/\{([^}]+)\}/g, (_match, name: string) => {
            const value = input[name];
            if (value === undefined || value === null) {
                const parameter = parameters.find((item) => item.name === name);
                if (parameter?.required !== false)
                    throw new Error(`Missing required path parameter: ${name}`);
                return '';
            }
            return encodeURIComponent(valueToString(value));
        });
    }

    private appendQuery(
        search: URLSearchParams,
        parameters: readonly V3ParameterDescriptor[],
        input: Record<string, unknown>,
    ) {
        for (const parameter of parameters) {
            const value = input[parameter.name];
            if (value === undefined || value === null) {
                if (parameter.required !== false) {
                    throw new Error(`Missing required query parameter: ${parameter.name}`);
                }
                continue;
            }
            if (parameter.style === 'deepObject') {
                if (!isRecord(value))
                    throw new Error(
                        `Query parameter ${parameter.name} must be an object for deepObject serialization`,
                    );
                for (const [key, nestedValue] of Object.entries(value)) {
                    if (nestedValue === undefined || nestedValue === null) continue;
                    if (Array.isArray(nestedValue)) {
                        for (const item of nestedValue)
                            search.append(`${parameter.name}[${key}]`, valueToString(item));
                    } else {
                        search.append(`${parameter.name}[${key}]`, valueToString(nestedValue));
                    }
                }
                continue;
            }
            if (Array.isArray(value)) {
                const explode = parameter.explode ?? true;
                if (explode)
                    value.forEach((item) => search.append(parameter.name, valueToString(item)));
                else search.append(parameter.name, value.map(valueToString).join(','));
                continue;
            }
            search.append(parameter.name, valueToString(value));
        }
    }

    private pathParameters(operation: V3OperationDescriptor): readonly V3ParameterDescriptor[] {
        return (
            operation.pathParameters ??
            operation.parameters?.filter((parameter) => parameter.in === 'path') ??
            []
        );
    }

    private queryParameters(operation: V3OperationDescriptor): readonly V3ParameterDescriptor[] {
        return (
            operation.queryParameters ??
            operation.parameters?.filter((parameter) => parameter.in === 'query') ??
            []
        );
    }

    private redact(message: string): string {
        let result = message;
        for (const secret of this.secrets) result = result.split(secret).join('[REDACTED]');
        return result.replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]');
    }
}
