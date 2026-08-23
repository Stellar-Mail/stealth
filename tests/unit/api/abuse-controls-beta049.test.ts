import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  normalizeCanonicalEntity,
  isOperatorOverride,
  consumeStorageByteQuota,
  consumeChainWriteQuota,
  consumeSessionQuota,
  consumeRecipientQuota,
} from "../../../src/server/api/rate-limit";
import { createRouteHandler } from "../../../src/server/api/handler";
import { z } from "zod";

describe("BETA-049 Abuse Controls & Quotas", () => {
  describe("canonical entity normalization", () => {
    it("normalizes case and leading/trailing whitespace", () => {
      expect(normalizeCanonicalEntity("  ALICE@STEALTH.MAIL  ")).toBe("alice@stealth.mail");
      expect(normalizeCanonicalEntity("  G12345ABC6789  ")).toBe("G12345ABC6789");
    });

    it("collapses inner whitespace and strips email subaddresses", () => {
      expect(normalizeCanonicalEntity("user + test @ domain.com")).toBe("user@domain.com");
      expect(normalizeCanonicalEntity("alice+spam123@stealth.mail")).toBe("alice@stealth.mail");
    });

    it("prevents evasion through alternate address spelling in recipient quota", async () => {
      const repo = new MemoryApiRepository();
      const sender = "  ALICE+alias1@STEALTH.MAIL  ";
      const recipient = "  BOB+alias2@STEALTH.MAIL  ";

      // Consume recipient quota up to limit 2
      const res1 = await consumeRecipientQuota(repo, sender, recipient, 2, 3600);
      expect(res1.allowed).toBe(true);

      const res2 = await consumeRecipientQuota(repo, "alice+alias99@stealth.mail", "bob+alias99@stealth.mail", 2, 3600);
      expect(res2.allowed).toBe(true);

      // Third attempt with clean spelling should be blocked as quota is 2
      const res3 = await consumeRecipientQuota(repo, "alice@stealth.mail", "bob@stealth.mail", 2, 3600);
      expect(res3.allowed).toBe(false);
      expect(res3.retryAfterSeconds).toBe(3600);
    });
  });

  describe("storage byte quota enforcement", () => {
    it("allows uploads within byte budget", async () => {
      const repo = new MemoryApiRepository();
      const res = await consumeStorageByteQuota(repo, "usr_alice", 500, 1000);
      expect(res.allowed).toBe(true);
    });

    it("throttles when cumulative byte budget is exceeded", async () => {
      const repo = new MemoryApiRepository();
      await consumeStorageByteQuota(repo, "usr_alice", 600, 1000);
      const res = await consumeStorageByteQuota(repo, "usr_alice", 500, 1000);
      expect(res.allowed).toBe(false);
      expect(res.retryAfterSeconds).toBe(3600);
    });
  });

  describe("chain write quota enforcement", () => {
    it("throttles excessive chain writes", async () => {
      const repo = new MemoryApiRepository();
      for (let i = 0; i < 3; i++) {
        const res = await consumeChainWriteQuota(repo, "usr_soroban", 3);
        expect(res.allowed).toBe(true);
      }
      const res4 = await consumeChainWriteQuota(repo, "usr_soroban", 3);
      expect(res4.allowed).toBe(false);
      expect(res4.retryAfterSeconds).toBe(3600);
    });
  });

  describe("session quota enforcement", () => {
    it("throttles excessive session requests", async () => {
      const repo = new MemoryApiRepository();
      for (let i = 0; i < 2; i++) {
        const res = await consumeSessionQuota(repo, "sess_12345", 2);
        expect(res.allowed).toBe(true);
      }
      const res3 = await consumeSessionQuota(repo, "sess_12345", 2);
      expect(res3.allowed).toBe(false);
      expect(res3.retryAfterSeconds).toBe(3600);
    });
  });

  describe("operator override mechanism", () => {
    it("detects valid operator override header", () => {
      process.env.STEALTH_OPERATOR_OVERRIDE_SECRET = "secret_key_123";
      const req = new Request("https://api.stealth.mail/test", {
        headers: { "x-stealth-operator-override": "secret_key_123" },
      });
      expect(isOperatorOverride(req)).toBe(true);
    });

    it("rejects invalid operator override header", () => {
      process.env.STEALTH_OPERATOR_OVERRIDE_SECRET = "secret_key_123";
      const req = new Request("https://api.stealth.mail/test", {
        headers: { "x-stealth-operator-override": "invalid_secret" },
      });
      expect(isOperatorOverride(req)).toBe(false);
    });
  });

  describe("central route handler integration", () => {
    it("returns HTTP 429 with Retry-After header when abuse budget is exceeded", async () => {
      const handler = createRouteHandler({
        authMode: "public",
        abuseBudget: {
          session: true,
        },
        handler: () => new Response("ok", { status: 200 }),
      });

      // Session quota is 200 by default, let's exhaust session quota
      const headers = new Headers({
        "x-session-id": "test_session_exhaust",
        "cf-connecting-ip": "192.0.2.99",
      });

      for (let i = 0; i < 200; i++) {
        const req = new Request("https://api.stealth.mail/test-route", { headers });
        const res = await handler(req);
        expect(res.status).toBe(200);
      }

      // 201st request should be throttled with 429 and Retry-After
      const reqThrottled = new Request("https://api.stealth.mail/test-route", { headers });
      const resThrottled = await handler(reqThrottled);
      expect(resThrottled.status).toBe(429);
      expect(resThrottled.headers.get("retry-after")).toBe("3600");

      const body = await resThrottled.json();
      expect(body.error.code).toBe("too_many_requests");
    });

    it("bypasses abuse controls when operator override header is supplied", async () => {
      process.env.STEALTH_OPERATOR_OVERRIDE_SECRET = "override_secret_xyz";
      const handler = createRouteHandler({
        authMode: "public",
        abuseBudget: {
          chainWrite: true,
        },
        handler: () => new Response("ok", { status: 200 }),
      });

      const normalHeaders = new Headers({
        "cf-connecting-ip": "192.0.2.105",
      });

      // Exhaust chain write budget (5 max)
      for (let i = 0; i < 5; i++) {
        await handler(new Request("https://api.stealth.mail/chain-test", { headers: normalHeaders }));
      }

      // Next normal request is 429
      const resNormal = await handler(new Request("https://api.stealth.mail/chain-test", { headers: normalHeaders }));
      expect(resNormal.status).toBe(429);

      // Request with valid operator override succeeds with 200
      const overrideHeaders = new Headers({
        "cf-connecting-ip": "192.0.2.105",
        "x-stealth-operator-override": "override_secret_xyz",
      });
      const resOverride = await handler(new Request("https://api.stealth.mail/chain-test", { headers: overrideHeaders }));
      expect(resOverride.status).toBe(200);
    });
  });
});
