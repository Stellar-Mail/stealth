import { AsyncLocalStorage } from "node:async_hooks";
import { MemoryApiRepository } from "./memory-repository";
import { ValidatedApiRepository, registerRecordSchema } from "./repository";
import type { ApiRepository } from "./repository";
import {
  mailboxPolicySchema,
  senderRuleSchema,
  postageSchema,
  receiptSchema,
  idempotencyRecordSchema,
  stellarAddressSchema,
} from "./domain";
import { ApiError } from "./errors";

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: string;
  tracestate?: string;
  baggage?: Record<string, string>;
}

export const traceContextStorage = new AsyncLocalStorage<TraceContext>();

function generateHexId(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseTraceParent(
  header: string | null | undefined,
): { traceId: string; spanId: string; traceFlags: string } | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed.length !== 55) return null;

  const parts = trimmed.split("-");
  if (parts.length !== 4) return null;

  const [version, traceId, parentId, traceFlags] = parts;
  if (version !== "00") return null;
  if (!/^[a-f0-9]{32}$/i.test(traceId) || traceId === "00000000000000000000000000000000")
    return null;
  if (!/^[a-f0-9]{16}$/i.test(parentId) || parentId === "0000000000000000") return null;
  if (!/^[a-f0-9]{2}$/i.test(traceFlags)) return null;

  return {
    traceId: traceId.toLowerCase(),
    spanId: parentId.toLowerCase(),
    traceFlags: traceFlags.toLowerCase(),
  };
}

const SENSITIVE_KEYWORDS = [
  "auth",
  "key",
  "secret",
  "token",
  "password",
  "cookie",
  "session",
  "jwt",
  "private",
  "credential",
  "pwd",
  "sig",
  "cert",
];

function isSensitiveBaggageKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function parseBaggage(
  header: string | null | undefined,
): Record<string, string> | undefined {
  if (!header) return undefined;
  const baggage: Record<string, string> = {};
  const pairs = header.split(",");
  for (const pair of pairs) {
    const trimmedPair = pair.trim();
    if (!trimmedPair) continue;
    const [kvPart] = trimmedPair.split(";");
    const eqIdx = kvPart.indexOf("=");
    if (eqIdx === -1) continue;
    const key = kvPart.substring(0, eqIdx).trim();
    const value = kvPart.substring(eqIdx + 1).trim();
    if (!key) continue;

    if (isSensitiveBaggageKey(key)) {
      continue;
    }
    baggage[key] = value;
  }
  return Object.keys(baggage).length > 0 ? baggage : undefined;
}

export function serializeBaggage(baggage: Record<string, string>): string {
  return Object.entries(baggage)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

export function serializeTraceParent(context: TraceContext): string {
  return `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;
}

export function getCurrentTraceContext(): TraceContext {
  const context = traceContextStorage.getStore();
  if (context) return context;
  return {
    traceId: generateHexId(16),
    spanId: generateHexId(8),
    traceFlags: "01",
  };
}

export function createChildTraceContext(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: generateHexId(8),
    traceFlags: parent.traceFlags,
    tracestate: parent.tracestate,
    baggage: parent.baggage ? { ...parent.baggage } : undefined,
  };
}

export function traceRepository(repo: ApiRepository, parentContext: TraceContext): ApiRepository {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return function (this: any, ...args: any[]) {
          const childContext = createChildTraceContext(parentContext);
          return traceContextStorage.run(childContext, () => {
            return value.apply(target, args);
          });
        };
      }
      return value;
    },
  });
}

const originalFetch = globalThis.fetch;
export const fetchRef = {
  fetch: originalFetch,
};

globalThis.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const context = traceContextStorage.getStore();
  if (context) {
    let headers: Headers;
    if (input instanceof Request) {
      headers = new Headers(input.headers);
    } else {
      headers = new Headers(init?.headers);
    }

    if (!headers.has("traceparent")) {
      headers.set("traceparent", serializeTraceParent(context));
    }
    if (context.tracestate && !headers.has("tracestate")) {
      headers.set("tracestate", context.tracestate);
    }
    if (context.baggage && Object.keys(context.baggage).length > 0 && !headers.has("baggage")) {
      headers.set("baggage", serializeBaggage(context.baggage));
    }

    if (input instanceof Request) {
      const newRequest = new Request(input, { headers });
      return fetchRef.fetch.call(this, newRequest, init);
    } else {
      const newInit: RequestInit = {
        ...init,
        headers,
      };
      return fetchRef.fetch.call(this, input, newInit);
    }
  }
  return fetchRef.fetch.call(this, input, init);
};

// Register schemas once at module init for Issue #1508 record validation
registerRecordSchema("mailboxPolicy", mailboxPolicySchema);
registerRecordSchema("senderRule", senderRuleSchema);
registerRecordSchema("postage", postageSchema);
registerRecordSchema("receipt", receiptSchema);
registerRecordSchema("idempotencyRecord", idempotencyRecordSchema);

/**
 * Issue #1461: Verified API Principal model representing authenticated request identity.
 */
export interface ApiPrincipal {
  address: string;
  authMethod: string;
  authenticatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface AnonymousApiContext {
  repository: ApiRepository;
  principal: null;
  isAuthenticated: false;
  requestId?: string;
  traceContext: TraceContext;
}

export interface AuthenticatedApiContext {
  repository: ApiRepository;
  principal: ApiPrincipal;
  isAuthenticated: true;
  requestId?: string;
  traceContext: TraceContext;
}

export type ApiContext = AnonymousApiContext | AuthenticatedApiContext;

const globalApi = globalThis as typeof globalThis & {
  __stealthApiRepository?: ApiRepository;
};

/**
 * Extract verified principal from incoming request headers.
 */
export function extractPrincipal(request: Request): ApiPrincipal | null {
  const value = request.headers.get("x-stealth-address");
  if (!value) return null;

  const result = stellarAddressSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError(401, "unauthorized", "x-stealth-address must be a valid Stellar G-address");
  }

  const delegationHeader = request.headers.get("x-stealth-delegation");
  const authMethod = delegationHeader ? "delegation" : "header";
  const metadata: Record<string, unknown> = {};
  if (delegationHeader) {
    metadata.delegation = delegationHeader;
  }

  return {
    address: result.data,
    authMethod,
    authenticatedAt: new Date(),
    metadata,
  };
}

/**
 * Explicitly create an ApiContext with or without an authenticated principal.
 */
export function createApiContext(
  repository: ApiRepository,
  principal?: ApiPrincipal | null,
  requestId?: string,
  traceContext?: TraceContext,
): ApiContext {
  const finalTraceContext = traceContext ?? getCurrentTraceContext();
  const tracedRepo = traceRepository(repository, finalTraceContext);
  if (principal) {
    return {
      repository: tracedRepo,
      principal,
      isAuthenticated: true,
      requestId,
      traceContext: finalTraceContext,
    };
  }
  return {
    repository: tracedRepo,
    principal: null,
    isAuthenticated: false,
    requestId,
    traceContext: finalTraceContext,
  };
}

/**
 * Issue #1516: startup configuration validation gate.
 *
 * Validates required environment bindings, secrets, supported versions, and
 * storage adapters at startup / first initialization. Misconfigured deployments
 * fail clearly before serving partial or unsafe API behavior. Dev vs prod
 * requirements are distinguished, and secret values are never logged.
 */
export interface ApiConfig {
  isProd: boolean;
  kvBinding?: unknown;
  coordinatorBinding?: unknown;
  cursorSecret?: string;
  supportedVersions: readonly string[];
}

export function validateApiConfig(config: ApiConfig): void {
  if (config.isProd) {
    if (!config.kvBinding) {
      throw new Error("Configuration error: STEALTH_KV binding is not declared in wrangler.jsonc.");
    }
    if (!config.coordinatorBinding) {
      throw new Error(
        "Configuration error: STEALTH_COORDINATOR binding is not declared in wrangler.jsonc.",
      );
    }
    if (!config.cursorSecret) {
      // Never echo the secret value — only that it is missing.
      throw new Error("Configuration error: STEALTH_CURSOR_SECRET is required in production.");
    }
  }

  if (config.supportedVersions.length === 0) {
    throw new Error(
      "Configuration error: at least one supported protocol version must be configured.",
    );
  }
}

export async function getApiContext(request?: Request): Promise<ApiContext> {
  let repo: ApiRepository;

  if (!import.meta.env.PROD) {
    globalApi.__stealthApiRepository ??= new MemoryApiRepository();
    repo = globalApi.__stealthApiRepository;
  } else if (globalApi.__stealthApiRepository) {
    repo = globalApi.__stealthApiRepository;
  } else {
    const { env } = await import("cloudflare:workers");

    // The Cloudflare env type only declares the KV and coordinator bindings;
    // the cursor secret is read defensively so an undeclared secret fails the
    // validation gate rather than a type error.
    const cursorSecret = (env as Record<string, string | undefined>).STEALTH_CURSOR_SECRET;

    validateApiConfig({
      isProd: true,
      kvBinding: env.STEALTH_KV,
      coordinatorBinding: env.STEALTH_COORDINATOR,
      cursorSecret,
      supportedVersions: ["v1"],
    });

    if (!env.STEALTH_KV || !env.STEALTH_COORDINATOR) {
      throw new Error(
        "Configuration error: STEALTH_KV or STEALTH_COORDINATOR binding is not declared in wrangler.jsonc.",
      );
    }

    const { HybridApiRepository } = await import("./kv-repository");
    repo = new HybridApiRepository(env.STEALTH_KV, env.STEALTH_COORDINATOR);
    globalApi.__stealthApiRepository = repo;
  }

  const principal = request ? extractPrincipal(request) : null;
  const requestId = request ? request.headers.get("x-request-id")?.trim() || undefined : undefined;

  let traceContext: TraceContext;
  if (request) {
    const traceparent = request.headers.get("traceparent");
    const parsed = parseTraceParent(traceparent);
    if (parsed) {
      traceContext = {
        traceId: parsed.traceId,
        spanId: generateHexId(8),
        traceFlags: parsed.traceFlags,
        tracestate: request.headers.get("tracestate")?.trim() || undefined,
        baggage: parseBaggage(request.headers.get("baggage")),
      };
    } else {
      traceContext = {
        traceId: generateHexId(16),
        spanId: generateHexId(8),
        traceFlags: "01",
      };
    }
  } else {
    traceContext = getCurrentTraceContext();
  }

  traceContextStorage.enterWith(traceContext);

  return createApiContext(repo, principal, requestId, traceContext);
}
