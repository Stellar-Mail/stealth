import { AsyncLocalStorage } from "node:async_hooks";
import { MemoryApiRepository } from "./memory-repository";
import { ValidatedApiRepository, registerRecordSchema } from "./repository";
import type { ApiRepository } from "./repository";
import {
  mailboxPolicySchema,
  senderRuleSchema,
  senderRuleRecordSchema,
  senderRuleWriteIntentSchema,
  postageSchema,
  receiptSchema,
  idempotencyRecordSchema,
  stellarAddressSchema,
  userSchema,
  profileSchema,
  credentialSchema,
  sessionSchema,
  retiredSessionSchema,
  storedEnvelopeSchema,
  provisioningRecordSchema,
  usernameReservationSchema,
  verificationTokenSchema,
  walletSchema,
  policyWriteIntentSchema,
  publishedKeySchema,
  keyDirectoryRecordSchema,
  contactSchema,
  managedWalletRecordSchema,
  fundingOperationSchema,
  recoveryCodeSetSchema,
  onboardingDraftSchema,
  accountDeletionRequestSchema,
  draftRecordSchema,
  inviteSchema,
  messageDeliveryStatusRecordSchema,
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
registerRecordSchema("mailboxPolicy", 1, mailboxPolicySchema);
registerRecordSchema("senderRule", 1, senderRuleSchema);
// BETA-037 (Issue #1944): versioned sender rule records with chain reconciliation
registerRecordSchema("senderRuleRecord", 1, senderRuleRecordSchema);
registerRecordSchema("senderRuleWriteIntent", 1, senderRuleWriteIntentSchema);
registerRecordSchema("postage", 1, postageSchema);
registerRecordSchema("receipt", 1, receiptSchema);
registerRecordSchema("user", 1, userSchema);
// Issue #1976 (BETA-069): profile v2 adds locale, timezone, and addressDisplay.
// Legacy v1 records are migrated by stamping defaults for the new fields.
registerRecordSchema("profile", 2, profileSchema, {
  1: (data: any) => ({ ...data, locale: "en", timezone: "UTC", addressDisplay: "truncated" }),
});
registerRecordSchema("credential", 1, credentialSchema);
registerRecordSchema("verificationToken", 1, verificationTokenSchema);
registerRecordSchema("session", 1, sessionSchema);
registerRecordSchema("retiredSession", 1, retiredSessionSchema);
// v1 -> v2 (Issue #1498): records now carry a requestDigest binding the
// lease/response to the exact request payload that created it. Legacy
// records predate this and never bore a client-supplied payload we can
// recompute, so they are stamped with a sentinel that can never equal a
// real digest — any replay attempt against one fails closed as a conflict
// rather than silently matching or replaying the wrong response.
registerRecordSchema("idempotencyRecord", 2, idempotencyRecordSchema, {
  1: (data: any) => ({ ...data, requestDigest: "legacy:unrecoverable" }),
});
// Issue #1936 (BETA-029): register StoredEnvelope schema so that
// ValidatedApiRepository can detect tampered or structurally invalid
// envelope records at the adapter boundary before they reach any caller.
registerRecordSchema("storedEnvelope", 1, storedEnvelopeSchema);
// Issue #1921 (BETA-014): provisioning state machine, username claims and
// wallet records are versioned and validated at the adapter boundary like
// every other durable record.
registerRecordSchema("provisioning", 1, provisioningRecordSchema);
registerRecordSchema("usernameReservation", 1, usernameReservationSchema);
registerRecordSchema("wallet", 1, walletSchema);
// Issue #1930 (BETA-023): durable scheduled-write intent for the Policies
// contract, so tampered or structurally invalid intents fail closed at the
// adapter boundary instead of silently drifting the reconciliation state.
registerRecordSchema("policyWriteIntent", 1, policyWriteIntentSchema);
// Issue #1934 (BETA-027): Versioned Public Encryption-Key Directory & Rotation
registerRecordSchema("publishedKey", 1, publishedKeySchema);
registerRecordSchema("keyDirectoryRecord", 1, keyDirectoryRecordSchema);
// Issue #1973 (BETA-066): durable user-owned contacts are versioned and
// validated at the adapter boundary like every other durable record.
registerRecordSchema("contact", 1, contactSchema);
registerRecordSchema("managedWalletRecord", 1, managedWalletRecordSchema);
registerRecordSchema("fundingOperation", 1, fundingOperationSchema);
// Issue #1917 (BETA-010): register the recovery code set schema so that
// ValidatedApiRepository can detect tampered or structurally invalid
// recovery records at the adapter boundary.
registerRecordSchema("recoveryCodeSet", 1, recoveryCodeSetSchema);
// Issue #1920 (BETA-013): durable server-backed onboarding drafts are versioned
// and validated at the adapter boundary like every other durable record.
registerRecordSchema("onboardingDraft", 1, onboardingDraftSchema);
registerRecordSchema("accountDeletionRequest", 1, accountDeletionRequestSchema);
// Issue #1965 (BETA-058): durable user-scoped encrypted-at-rest draft records.
registerRecordSchema("draftRecord", 1, draftRecordSchema);
registerRecordSchema("invite", 1, inviteSchema);
// Issue #1942 (BETA-035): off-chain message delivery state records are versioned
// and validated at the adapter boundary like every other durable record.
registerRecordSchema("messageDeliveryStatusRecord", 1, messageDeliveryStatusRecordSchema);

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
  escrow?: import("../../services/stellar/postage-escrow").PostageEscrowAdapter;
  _pendingMessageId?: string;
}

export interface AuthenticatedApiContext {
  repository: ApiRepository;
  principal: ApiPrincipal;
  isAuthenticated: true;
  requestId?: string;
  traceContext: TraceContext;
  escrow?: import("../../services/stellar/postage-escrow").PostageEscrowAdapter;
  _pendingMessageId?: string;
}

export type ApiContext = AnonymousApiContext | AuthenticatedApiContext;

const globalApi = globalThis as typeof globalThis & {
  __stealthApiRepository?: ApiRepository;
  __stealthObjectStore?: unknown;
  __stealthRuntimeConfig?: import("../../config/schema").BetaRuntimeConfig;
  __stealthEscrow?: import("../../services/stellar/postage-escrow").PostageEscrowAdapter | null;
};

/**
 * Returns the R2-backed object store bound to the Workers runtime. In dev and
 * test environments (no binding), it returns `null` so callers fall back to the
 * in-memory/other path; in production it lazily constructs the adapter from the
 * STEALTH_OBJECT_STORE binding.
 */
export async function getObjectStore(): Promise<
  import("@/services/storage/object-store").ObjectStoreAdapter | null
> {
  if (!import.meta.env.PROD) {
    return globalApi.__stealthObjectStore as ReturnType<typeof getObjectStore> | null;
  }
  if (globalApi.__stealthObjectStore) {
    return globalApi.__stealthObjectStore as ReturnType<typeof getObjectStore>;
  }
  const { env } = await import("cloudflare:workers");
  if (!env.STEALTH_OBJECT_STORE) {
    return null;
  }
  const { R2ObjectStoreAdapter } = await import("@/services/storage/r2-adapter");
  const adapter = new R2ObjectStoreAdapter(env.STEALTH_OBJECT_STORE);
  globalApi.__stealthObjectStore = adapter;
  return adapter;
}

/**
 * Development / legacy identity from `x-stealth-address` alone.
 * Not proof of key possession — only used when {@link isHeaderOnlyAuthAllowed}
 * or for safe (non-mutating) methods without signed-request material.
 */
export function extractHeaderOnlyPrincipal(request: Request): ApiPrincipal | null {
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
 * Resolve the request principal.
 *
 * Mutating methods require STEALTH-AUTH-V1 unless the explicit non-production
 * header-only escape hatch is enabled. Signed material always forces full
 * verification. Safe methods may still use the development header transport.
 */
export async function extractPrincipal(request: Request): Promise<ApiPrincipal | null> {
  const {
    authenticateSignedRequest,
    hasSignedRequestMaterial,
    isHeaderOnlyAuthAllowed,
    isMutatingMethod,
  } = await import("./auth/signed-request-verify");

  const hasAddress = Boolean(request.headers.get("x-stealth-address")?.trim());
  if (!hasAddress && !hasSignedRequestMaterial(request)) {
    return null;
  }

  const mutating = isMutatingMethod(request.method);
  const signedMaterial = hasSignedRequestMaterial(request);
  const headerOnly = isHeaderOnlyAuthAllowed();

  if (signedMaterial || (mutating && !headerOnly)) {
    if (!hasAddress && !signedMaterial) {
      throw new ApiError(401, "unauthorized", "Missing x-stealth-address header");
    }
    return authenticateSignedRequest(request);
  }

  return extractHeaderOnlyPrincipal(request);
}

/** @deprecated Prefer {@link extractPrincipal}; sync header-only helper for tests. */
export function extractPrincipalSync(request: Request): ApiPrincipal | null {
  return extractHeaderOnlyPrincipal(request);
}

/**
 * Explicitly create an ApiContext with or without an authenticated principal.
 */
export function createApiContext(
  repository: ApiRepository,
  principal?: ApiPrincipal | null,
  requestId?: string,
  traceContext?: TraceContext,
  escrow?: import("../../services/stellar/postage-escrow").PostageEscrowAdapter,
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
      escrow,
    };
  }
  return {
    repository: tracedRepo,
    principal: null,
    isAuthenticated: false,
    requestId,
    traceContext: finalTraceContext,
    escrow,
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
import { loadRuntimeConfig } from "../../config";

/**
 * BETA-042: memoized on-chain postage escrow bridge.
 *
 * Only wired when running a real deployment (import.meta.env.PROD) AND the
 * loaded runtime config yields a live adapter (real RPC + managed wallet +
 * non-placeholder contract). Dev/test and misconfigured deployments stay fully
 * off-chain so local workflows and the unit suite remain deterministic.
 */
async function getEscrowAdapter(): Promise<
  import("../../services/stellar/postage-escrow").PostageEscrowAdapter | undefined
> {
  if (globalApi.__stealthEscrow !== undefined) {
    return globalApi.__stealthEscrow ?? undefined;
  }
  globalApi.__stealthEscrow = null;
  if (!import.meta.env.PROD) {
    return undefined;
  }
  try {
    const { ManagedWalletService } = await import("../../services/stellar/managed-wallet");
    const { PostageEscrowAdapter } = await import("../../services/stellar/postage-escrow");
    const config = globalApi.__stealthRuntimeConfig;
    if (config) {
      const adapter = new PostageEscrowAdapter({
        config,
        managedWallet: new ManagedWalletService(config),
      });
      if (adapter.isLive()) {
        globalApi.__stealthEscrow = adapter;
        return adapter;
      }
    }
  } catch {
    // Misconfigured / unavailable on-chain bridge — stay off-chain.
  }
  return undefined;
}

export interface ApiConfig {
  isProd: boolean;
  kvBinding?: unknown;
  coordinatorBinding?: unknown;
  objectStoreBinding?: unknown;
  cursorSecret?: string;
  smtpPassword?: string;
  relayApiKey?: string;
  storageSecret?: string;
  rpcApiKey?: string;
  operatorSecret?: string;
  supportedVersions: readonly string[];
}

export function validateApiConfig(config: ApiConfig): void {
  if (config.supportedVersions.length === 0) {
    throw new Error(
      "Configuration error: at least one supported protocol version must be configured.",
    );
  }

  if (config.isProd) {
    if (!config.kvBinding) {
      throw new Error("Configuration error: STEALTH_KV binding is not declared in wrangler.jsonc.");
    }
    if (!config.coordinatorBinding) {
      throw new Error(
        "Configuration error: STEALTH_COORDINATOR binding is not declared in wrangler.jsonc.",
      );
    }
    if (!config.objectStoreBinding) {
      throw new Error(
        "Configuration error: STEALTH_OBJECT_STORE binding is not declared in wrangler.jsonc.",
      );
    }
    if (!config.cursorSecret) {
      // Never echo the secret value — only that it is missing.
      throw new Error("Configuration error: STEALTH_CURSOR_SECRET is required in production.");
    }
  }

  // Execute full 6-domain beta runtime configuration validation
  globalApi.__stealthRuntimeConfig = loadRuntimeConfig({
    profile: config.isProd ? "production" : "development",
    env: {
      STEALTH_KV: config.kvBinding,
      STEALTH_COORDINATOR: config.coordinatorBinding,
      STEALTH_CURSOR_SECRET: config.cursorSecret,
      STEALTH_SMTP_PASSWORD: config.smtpPassword,
      STEALTH_RELAY_API_KEY: config.relayApiKey,
      STEALTH_STORAGE_SECRET: config.storageSecret,
      STEALTH_RPC_API_KEY: config.rpcApiKey,
      STEALTH_OPERATOR_SECRET: config.operatorSecret,
    },
  });
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
    const smtpPassword = (env as Record<string, string | undefined>).STEALTH_SMTP_PASSWORD;
    const relayApiKey = (env as Record<string, string | undefined>).STEALTH_RELAY_API_KEY;
    const storageSecret = (env as Record<string, string | undefined>).STEALTH_STORAGE_SECRET;
    const rpcApiKey = (env as Record<string, string | undefined>).STEALTH_RPC_API_KEY;
    const operatorSecret = (env as Record<string, string | undefined>).STEALTH_OPERATOR_SECRET;

    validateApiConfig({
      isProd: true,
      kvBinding: env.STEALTH_KV,
      coordinatorBinding: env.STEALTH_COORDINATOR,
      objectStoreBinding: env.STEALTH_OBJECT_STORE,
      cursorSecret,
      smtpPassword,
      relayApiKey,
      storageSecret,
      rpcApiKey,
      operatorSecret,
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

  const principal = request ? await extractPrincipal(request) : null;
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

  const escrow = await getEscrowAdapter();

  return createApiContext(repo, principal, requestId, traceContext, escrow);
}
