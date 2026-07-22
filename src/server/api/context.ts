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
}

export interface AuthenticatedApiContext {
  repository: ApiRepository;
  principal: ApiPrincipal;
  isAuthenticated: true;
  requestId?: string;
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
): ApiContext {
  if (principal) {
    return {
      repository,
      principal,
      isAuthenticated: true,
      requestId,
    };
  }
  return {
    repository,
    principal: null,
    isAuthenticated: false,
    requestId,
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
  return createApiContext(repo, principal, requestId);
}
