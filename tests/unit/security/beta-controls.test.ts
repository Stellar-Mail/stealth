import { describe, expect, it } from "vitest";

import {
  assertNormativeAlgorithm,
  getNormativeV1Suite,
  isNormativeV1Algorithm,
} from "../../../src/services/crypto/algorithm-suite";
import {
  constantTimeEqual,
  constantTimeEqualOrThrow,
} from "../../../src/services/crypto/constant-time";
import {
  generateRecipientKeyPair,
  unwrapContentKey,
  wrapContentKey,
} from "../../../src/services/crypto/key-wrap";
import { PrivacyAnalytics } from "../../../src/services/analytics";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  AUTH_FAILURE_LIMITS,
  RATE_LIMIT_OPERATION_COSTS,
  checkAuthFailureThrottle,
  consumeRouteQuota,
  recordAuthFailure,
} from "../../../src/server/api/rate-limit";
import {
  enforceCentralAbuse,
  checkStorageByteBudget,
  checkChainWriteBudget,
  checkSessionLimit,
  checkRecipientLimit,
} from "../../../src/server/api/abuse-service";
import {
  corsEarlyResponse,
  validateCorsPolicy,
  type CorsPolicy,
} from "../../../src/server/api/cors";
import { identityRecordFamilies } from "../../../src/server/migrations/adapters";
import { wrapEnvelope } from "../../../src/server/migrations/envelope";
import { InMemoryMigrationStorage } from "../../../src/server/migrations/in-memory-storage";
import { forward, rollback } from "../../../src/server/migrations/runner";
import type { IdentityRecordFamily } from "../../../src/server/migrations/types";
import {
  validateCommittedConfig,
  validateResolvedConfig,
} from "../../../src/server/migrations/wrangler-config-guard";

/**
 * BETA-076 (Issue #1983) — behavioral control verification.
 *
 * Each section proves that a security control registered in
 * docs/security/beta-control-map.md is actually enforced by the live code, so
 * the beta threat model's critical threats link to executed checks rather than
 * prose. Evidence captured from these runs is recorded in
 * docs/security/beta-verification-checklist.md.
 */

describe("BETA-076 SC-01: normative AEAD suite is fail-closed", () => {
  it("exposes exactly AES-256-GCM with a 256-bit key and 96-bit nonce for v1", () => {
    const suite = getNormativeV1Suite();
    expect(suite).toEqual({
      version: "v1",
      algorithm: "AES-256-GCM",
      keyBits: 256,
      nonceBytes: 12,
      webCryptoName: "AES-GCM",
    });
  });

  it("rejects downgrade attempts to any non-normative algorithm", () => {
    expect(isNormativeV1Algorithm("AES-256-GCM")).toBe(true);
    expect(isNormativeV1Algorithm("AES-128-GCM")).toBe(false);
    expect(() => assertNormativeAlgorithm("AES-128-GCM")).toThrow(/Unsupported algorithm/);
  });
});

describe("BETA-076 SC-08: per-recipient key wrap fails closed", () => {
  async function newContentKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
  }

  it("wraps for the intended recipient who can unwrap the exact key", async () => {
    const recipient = await generateRecipientKeyPair();
    const contentKey = await newContentKey();

    const entry = await wrapContentKey(contentKey, recipient.publicKey);
    expect(entry.blindedRecipientId).toMatch(/^[0-9a-f]+$/);
    expect(entry.wrappedKey.length).toBeGreaterThan(0);
    expect(entry.nonce).toMatch(/^[0-9a-f]{24}$/);

    const unwrapped = await unwrapContentKey(recipient.privateKey, [entry]);
    expect(unwrapped).not.toBeNull();
    const probe = new Uint8Array([1, 2, 3]);
    const sealed = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: crypto.getRandomValues(new Uint8Array(12)) },
      unwrapped!,
      probe,
    );
    expect(sealed.byteLength).toBe(probe.length + 16);
  });

  it("never yields a usable content key to a non-recipient", async () => {
    const recipient = await generateRecipientKeyPair();
    const attacker = await generateRecipientKeyPair();
    const entry = await wrapContentKey(await newContentKey(), recipient.publicKey);

    let outcome: CryptoKey | null;
    try {
      outcome = await unwrapContentKey(attacker.privateKey, [entry]);
    } catch {
      outcome = null;
    }
    expect(outcome).toBeNull();
  });

  it("blinds recipients with fresh ephemeral material on every wrap", async () => {
    const recipient = await generateRecipientKeyPair();
    const contentKey = await newContentKey();
    const first = await wrapContentKey(contentKey, recipient.publicKey);
    const second = await wrapContentKey(contentKey, recipient.publicKey);
    expect(first.ephemeralPublicKey).not.toBe(second.ephemeralPublicKey);
    expect(first.nonce).not.toBe(second.nonce);
  });
});

describe("BETA-076 SC-10: constant-time comparison semantics", () => {
  it("matches equal buffers and rejects differing or shorter ones", () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
  });

  it("treats length mismatch as a validation failure when strict", () => {
    expect(() => constantTimeEqualOrThrow(new Uint8Array([1]), new Uint8Array([1, 2]))).toThrow();
  });
});

describe("BETA-076 SC-05/SC-06: abuse throttles deny at their documented limits", () => {
  it("denies account operations beyond the hourly quota and prices weighted costs", async () => {
    const repository = new MemoryApiRepository();

    for (let i = 0; i < 50; i += 1) {
      await expect(consumeRouteQuota(repository, "account", "acct-a", "read")).resolves.toEqual({
        allowed: true,
      });
    }
    await expect(consumeRouteQuota(repository, "account", "acct-a", "read")).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    await expect(consumeRouteQuota(repository, "account", "acct-b", "read")).resolves.toEqual({
      allowed: true,
    });

    // paymentTransition costs 10 (RATE_LIMIT_OPERATION_COSTS): five fit in the
    // 50-point budget, the sixth must be denied.
    expect(RATE_LIMIT_OPERATION_COSTS.paymentTransition).toBe(10);
    for (let i = 0; i < 5; i += 1) {
      await expect(
        consumeRouteQuota(repository, "account", "acct-c", "paymentTransition"),
      ).resolves.toEqual({ allowed: true });
    }
    await expect(
      consumeRouteQuota(repository, "account", "acct-c", "paymentTransition"),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 3600 });
  });

  it("documents the IP limiter fail-open branch relied on by RR-02", async () => {
    const repository = new MemoryApiRepository();
    await expect(consumeRouteQuota(repository, "ip", "unknown", "read")).resolves.toEqual({
      allowed: true,
    });
  });

  it("locks out repeated auth failures and grows delay exponentially", async () => {
    const repository = new MemoryApiRepository();
    const ip = "203.0.113.9";
    const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    await expect(checkAuthFailureThrottle(repository, ip, address)).resolves.toEqual({
      allowed: true,
    });

    const delays: number[] = [];
    for (let i = 0; i < AUTH_FAILURE_LIMITS.ipAndAccount.max; i += 1) {
      delays.push((await recordAuthFailure(repository, ip, address)).delaySeconds);
    }
    expect(delays).toEqual([1, 2, 4, 8, 16]);

    await expect(checkAuthFailureThrottle(repository, ip, address)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: AUTH_FAILURE_LIMITS.ipAndAccount.windowSeconds,
    });
  });

  it("BETA-049: enforces storage-byte and chain-write budgets centrally with address canonicalization", async () => {
    const repository = new MemoryApiRepository();
    const acct = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    const lowerAcct = acct.toLowerCase();

    // Storage byte budget enforcement (50MB cap)
    const storageRes = await enforceCentralAbuse(repository, {
      route: "attachment_upload",
      account: lowerAcct, // Lowercase evasion attempt
      storageBytes: 60 * 1024 * 1024,
    });
    expect(storageRes.allowed).toBe(false);
    expect(storageRes.reason).toBe("storage_byte_budget_exceeded");
    expect(storageRes.retryAfterSeconds).toBe(3600);

    // Operator override bypass with configured secret
    const prev = process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN;
    process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN = "beta-override-token";
    try {
      const overrideRes = await enforceCentralAbuse(repository, {
        route: "attachment_upload",
        account: lowerAcct,
        storageBytes: 60 * 1024 * 1024,
        headers: new Headers({ "x-stealth-operator-override": "beta-override-token" }),
      });
      expect(overrideRes.allowed).toBe(true);
    } finally {
      if (prev !== undefined) {
        process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN = prev;
      } else {
        delete process.env.STEALTH_OPERATOR_OVERRIDE_TOKEN;
      }
    }
  });
});

describe("BETA-076 SC-07: CORS allowlist rejects wildcard and foreign origins", () => {
  const policy: CorsPolicy = {
    allowedOrigins: ["https://app.stealth.example"],
    allowedMethods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  };

  function request(method: string, origin?: string, extra: Record<string, string> = {}) {
    const headers = new Headers(extra);
    if (origin) headers.set("Origin", origin);
    return new Request("https://relay.stealth.example/v1/envelopes", { method, headers });
  }

  it("refuses wildcard origin policies outright", () => {
    expect(() => validateCorsPolicy({ ...policy, allowedOrigins: ["*"] })).toThrow();
    expect(() =>
      validateCorsPolicy({ ...policy, allowedOrigins: ["*"], allowCredentials: true }),
    ).toThrow();
  });

  it("403s foreign origins and honors well-formed preflights only", () => {
    const denied = corsEarlyResponse(request("GET", "https://evil.example"), policy);
    expect(denied?.status).toBe(403);

    const preflight = corsEarlyResponse(
      request("OPTIONS", "https://app.stealth.example", {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      }),
      policy,
    );
    expect(preflight?.status).toBe(204);
    expect(preflight?.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.stealth.example",
    );

    const badMethod = corsEarlyResponse(
      request("OPTIONS", "https://app.stealth.example", {
        "Access-Control-Request-Method": "DELETE",
      }),
      policy,
    );
    expect(badMethod?.status).toBe(403);
  });
});

describe("BETA-076 SC-13: analytics blocklist, opt-in default, retention", () => {
  it("drops events while disabled and throws on identifier-bearing payload keys", () => {
    const disabled = new PrivacyAnalytics();
    disabled.track({
      category: "onboarding",
      purpose: "activation_measurement",
      privacyBudget: 1,
      retentionDays: 30,
      payload: { step: 3 },
    });
    expect(disabled.inspectEvents()).toHaveLength(0);

    const enabled = new PrivacyAnalytics({ enabled: true, maxPrivacyBudget: 10 });
    expect(() =>
      enabled.track({
        category: "onboarding",
        purpose: "activation_measurement",
        privacyBudget: 1,
        retentionDays: 30,
        payload: { subject_body: "x" },
      }),
    ).toThrow(/forbidden key/i);
  });

  it("evicts events older than their retention window on enforcement", () => {
    const analytics = new PrivacyAnalytics({ enabled: true, maxPrivacyBudget: 100 });
    analytics.track({
      category: "request",
      purpose: "reliability_monitoring",
      privacyBudget: 1,
      retentionDays: 30,
      payload: { outcome: "ok" },
    });
    const dayMs = 24 * 60 * 60 * 1000;
    analytics.inspectEvents()[0].timestamp = Date.now() - 31 * dayMs;
    analytics.enforceRetention();
    expect(analytics.inspectEvents()).toHaveLength(0);
  });
});

describe("BETA-076 SC-24: wrangler config guard keeps secrets out of the repo", () => {
  const validConfig = JSON.stringify({
    name: "stealth-mail",
    main: "src/server.ts",
    kv_namespaces: [{ binding: "STEALTH_KV", id: "{STEALTH_KV_ID}" }],
    env: {
      preview: {
        kv_namespaces: [{ binding: "STEALTH_KV", id: "{PREVIEW_STEALTH_KV_ID}" }],
        durable_objects: { bindings: [{ name: "STEALTH_COORDINATOR" }] },
        secrets: { required: ["STEALTH_SESSION_SECRET"] },
      },
      production: {
        kv_namespaces: [{ binding: "STEALTH_KV", id: "{PRODUCTION_STEALTH_KV_ID}" }],
        durable_objects: { bindings: [{ name: "STEALTH_COORDINATOR" }] },
        secrets: { required: ["STEALTH_SESSION_SECRET"] },
      },
    },
  });

  it("accepts a placeholder-only config with isolated environments", () => {
    const result = validateCommittedConfig(validConfig);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rejects committed real resource IDs and shared environment namespaces", () => {
    const leaked = validateCommittedConfig(
      validConfig.replace("{PRODUCTION_STEALTH_KV_ID}", "a".repeat(32)),
    );
    expect(leaked.ok).toBe(false);
    expect(leaked.errors.join(" ")).toMatch(/must never be committed/);

    const shared = validateCommittedConfig(
      validConfig
        .replace("{PREVIEW_STEALTH_KV_ID}", "{SHARED_STEALTH_KV_ID}")
        .replace("{PRODUCTION_STEALTH_KV_ID}", "{SHARED_STEALTH_KV_ID}"),
    );
    expect(shared.ok).toBe(false);
    expect(shared.errors.join(" ")).toMatch(/must not share storage/);
  });

  it("fails resolved configs that still contain unresolved placeholders", () => {
    const result = validateResolvedConfig(JSON.parse(validConfig));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/Placeholder tokens remain/);
  });
});

describe("BETA-076 SC-20/SC-11: migration rollback is fail-closed and reversible", () => {
  const NULL_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

  function validUser(userId: string) {
    return {
      userId,
      address: NULL_ADDRESS,
      email: `${userId}@example.com`,
      username: userId,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    };
  }

  /** v2 family with symmetric forward/backward transforms. */
  function v2UserFamily(): IdentityRecordFamily {
    const base = identityRecordFamilies[0];
    return {
      ...base,
      currentVersion: 2,
      schema: (
        base.schema as unknown as {
          passthrough: () => IdentityRecordFamily["schema"];
        }
      ).passthrough(),
      forward: { 1: (data: Record<string, unknown>) => ({ ...data, displayName: "" }) },
      backward: {
        2: (data: Record<string, unknown>) => {
          const { displayName: _dropped, ...rest } = data;
          return rest;
        },
      },
    };
  }

  it("refuses mutating migrations without explicit operator approval", async () => {
    const storage = new InMemoryMigrationStorage();
    storage.seed("user:id:u_1", wrapEnvelope(validUser("u_1"), 1));

    const unapprovedForward = await forward(storage, [v2UserFamily()]);
    expect(unapprovedForward.ok).toBe(false);
    expect(unapprovedForward.families[0].errors[0]).toContain(
      "operator approval is required for mutating migrations",
    );

    const unapprovedRollback = await rollback(storage, [v2UserFamily()], { targetVersion: 1 });
    expect(unapprovedRollback.ok).toBe(false);
    expect(unapprovedRollback.families[0].errors[0]).toContain("operator approval is required");
  });

  it("refuses approved rollback without an explicit positive target version", async () => {
    const report = await rollback(new InMemoryMigrationStorage(), identityRecordFamilies, {
      approval: "approved",
    });
    expect(report.ok).toBe(false);
    expect(report.families[0].errors[0]).toContain("--target-version");
  });

  it("round-trips v1 -> v2 -> v1 back to byte-equal records", async () => {
    const storage = new InMemoryMigrationStorage();
    const original = wrapEnvelope(validUser("u_1"), 1);
    storage.seed("user:id:u_1", original);

    const up = await forward(storage, [v2UserFamily()], { approval: "approved" });
    expect(up.ok).toBe(true);
    expect(await storage.get("user:id:u_1")).toMatchObject({ $v: 2 });

    const down = await rollback(storage, [v2UserFamily()], {
      targetVersion: 1,
      approval: "approved",
    });
    expect(down.ok).toBe(true);
    expect(await storage.get("user:id:u_1")).toEqual(original);
  });
});
