import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getApiContext } from "../../../src/server/api/context";
import type { ApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  buildVerificationUrl,
  DEFAULT_VERIFICATION_POLICY,
  generateVerificationToken,
  hashVerificationToken,
  issueEmailVerificationToken,
  resendEmailVerificationToken,
  verifyEmailVerificationToken,
  type VerificationPolicy,
} from "../../../src/server/api/verification-service";
import { VERIFICATION_PURPOSE } from "../../../src/server/api/verification-service";
import type { VerificationEmailMessage } from "../../../src/services/notifications/adapter";

const pendingUser = {
  userId: "usr_verify_1",
  address: `G${"D".repeat(55)}`,
  email: "alice@stealth.mail",
  username: "alice_stealth",
  status: "pending_verification" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
};

const otherUser = {
  userId: "usr_verify_2",
  address: `G${"E".repeat(55)}`,
  email: "bob@stealth.mail",
  username: "bob_stealth",
  status: "pending_verification" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
};

const policy: VerificationPolicy = {
  tokenLifetimeMs: 60_000,
  resendCooldownMs: 30_000,
  maxAttempts: 5,
};

describe("BETA-005: verification-token service lifecycle", () => {
  let context: ApiContext;
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    context = await getApiContext();
    repo = context.repository as MemoryApiRepository;
    repo.reset();
    await repo.createUser(pendingUser);
    await repo.createUser(otherUser);
  });

  afterEach(() => {
    repo.reset();
  });

  describe("generateVerificationToken", () => {
    it("produces 43-character base64url tokens (256 bits of entropy)", () => {
      const token = generateVerificationToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it("produces distinct tokens per call", () => {
      const tokens = new Set(Array.from({ length: 32 }, () => generateVerificationToken()));
      expect(tokens.size).toBe(32);
    });
  });

  describe("hashVerificationToken", () => {
    it("is deterministic and 64 lowercase hex characters", async () => {
      const first = await hashVerificationToken("candidate-token");
      const second = await hashVerificationToken("candidate-token");
      expect(first).toBe(second);
      expect(first).toMatch(/^[a-f0-9]{64}$/);
    });

    it("differs for different inputs", async () => {
      const first = await hashVerificationToken("token-a");
      const second = await hashVerificationToken("token-b");
      expect(first).not.toBe(second);
    });
  });

  describe("issueEmailVerificationToken", () => {
    it("persists only the hash, never the plaintext token", async () => {
      const issued = await issueEmailVerificationToken(context, pendingUser.userId, policy);

      const stored = await repo.getVerificationToken(issued.tokenHash);
      expect(stored).not.toBeNull();
      expect(stored!.tokenHash).toBe(issued.tokenHash);
      expect(JSON.stringify(stored)).not.toContain(issued.plaintextToken);
    });

    it("respects the configured lifetime", async () => {
      const now = new Date("2026-02-01T00:00:00.000Z");
      const issued = await issueEmailVerificationToken(context, pendingUser.userId, policy, now);
      expect(issued.expiresAt.getTime()).toBe(now.getTime() + policy.tokenLifetimeMs);
    });

    it("atomically replaces a still-redeemable previous token", async () => {
      const first = await issueEmailVerificationToken(context, pendingUser.userId, policy);
      const second = await issueEmailVerificationToken(context, pendingUser.userId, policy);

      expect(second.replaced).toBe(true);
      const oldRecord = await repo.getVerificationToken(first.tokenHash);
      expect(oldRecord!.replacedAt).not.toBeNull();
      expect(oldRecord!.replacedByTokenHash).toBe(second.tokenHash);
    });

    it("does not replace a token that was already consumed", async () => {
      const first = await issueEmailVerificationToken(context, pendingUser.userId, policy);
      await repo.consumeVerificationToken(first.tokenHash, new Date("2026-02-01T00:00:00.000Z"));
      const second = await issueEmailVerificationToken(context, pendingUser.userId, policy);
      expect(second.replaced).toBe(false);
    });
  });

  describe("verifyEmailVerificationToken", () => {
    it("verifies a valid token and activates the pending account", async () => {
      const issued = await issueEmailVerificationToken(context, pendingUser.userId, policy);
      const outcome = await verifyEmailVerificationToken(
        context,
        pendingUser.email,
        issued.plaintextToken,
      );

      expect(outcome).toEqual({ outcome: "verified", userId: pendingUser.userId });
      const user = await repo.getUserById(pendingUser.userId);
      expect(user!.status).toBe("active");
      const record = await repo.getVerificationToken(issued.tokenHash);
      expect(record!.consumedAt).not.toBeNull();
    });

    it("rejects an unknown token without revealing account existence", async () => {
      const outcome = await verifyEmailVerificationToken(
        context,
        pendingUser.email,
        "some-random-token",
      );

      expect(outcome).toEqual({ outcome: "failed", reason: "invalid_token" });
      const user = await repo.getUserById(pendingUser.userId);
      expect(user!.status).toBe("pending_verification");
    });

    it("rejects an expired token and reports the reason", async () => {
      const issued = await issueEmailVerificationToken(context, pendingUser.userId, policy);
      const afterExpiry = new Date(issued.expiresAt.getTime() + 1);

      const outcome = await verifyEmailVerificationToken(
        context,
        pendingUser.email,
        issued.plaintextToken,
        afterExpiry,
      );

      expect(outcome).toEqual({
        outcome: "failed",
        reason: "expired",
        userId: pendingUser.userId,
      });
    });

    it("treats a replayed valid token against an active account as success", async () => {
      const issued = await issueEmailVerificationToken(context, pendingUser.userId, policy);
      await verifyEmailVerificationToken(context, pendingUser.email, issued.plaintextToken);

      const replay = await verifyEmailVerificationToken(
        context,
        pendingUser.email,
        issued.plaintextToken,
      );

      expect(replay).toEqual({ outcome: "verified", userId: pendingUser.userId });
    });

    it("reports reused when an already-consumed token is presented by a non-active account", async () => {
      const issued = await issueEmailVerificationToken(context, pendingUser.userId, policy);

      // Consume the token directly so the account stays pending (e.g. the
      // activation step never ran); the service must then report "reused".
      await repo.consumeVerificationToken(issued.tokenHash, new Date("2026-02-01T00:00:00.000Z"));

      const outcome = await verifyEmailVerificationToken(
        context,
        pendingUser.email,
        issued.plaintextToken,
      );

      expect(outcome).toEqual({
        outcome: "failed",
        reason: "reused",
        userId: pendingUser.userId,
      });
      const user = await repo.getUserById(pendingUser.userId);
      expect(user!.status).toBe("pending_verification");
    });

    it("does not leak the token owner when presented with a different email", async () => {
      const issued = await issueEmailVerificationToken(context, pendingUser.userId, policy);

      const outcome = await verifyEmailVerificationToken(
        context,
        otherUser.email,
        issued.plaintextToken,
      );

      expect(outcome).toEqual({
        outcome: "failed",
        reason: "invalid_token",
        userId: pendingUser.userId,
      });
      const bob = await repo.getUserById(otherUser.userId);
      expect(bob!.status).toBe("pending_verification");
    });

    it("rejects a replaced token", async () => {
      const first = await issueEmailVerificationToken(context, pendingUser.userId, policy);
      await issueEmailVerificationToken(context, pendingUser.userId, policy);

      const outcome = await verifyEmailVerificationToken(
        context,
        pendingUser.email,
        first.plaintextToken,
      );

      expect(outcome).toEqual({
        outcome: "failed",
        reason: "replaced",
        userId: pendingUser.userId,
      });
    });

    it("locks the token after the maximum number of failed attempts", async () => {
      const issued = await issueEmailVerificationToken(context, pendingUser.userId, policy);
      const afterExpiry = new Date(issued.expiresAt.getTime() + 1);

      for (let attempt = 0; attempt < policy.maxAttempts; attempt += 1) {
        const outcome = await verifyEmailVerificationToken(
          context,
          pendingUser.email,
          issued.plaintextToken,
          afterExpiry,
        );
        expect(outcome.outcome).toBe("failed");
      }

      const blocked = await verifyEmailVerificationToken(
        context,
        pendingUser.email,
        issued.plaintextToken,
        afterExpiry,
      );
      expect(blocked).toEqual({
        outcome: "failed",
        reason: "brute_force_blocked",
        userId: pendingUser.userId,
      });
    });
  });

  describe("resendEmailVerificationToken", () => {
    let delivered: VerificationEmailMessage[];
    const deliver = async (message: VerificationEmailMessage) => {
      delivered.push(message);
      return { transport: "sink" as const, accepted: true, safeTargetReference: "ref" };
    };
    const appUrl = "https://stealth.mail";

    beforeEach(() => {
      delivered = [];
    });

    it("returns a generic noop for an unknown email", async () => {
      const outcome = await resendEmailVerificationToken(
        context,
        "ghost@stealth.mail",
        policy,
        deliver,
        appUrl,
      );
      expect(outcome).toEqual({ outcome: "noop" });
      expect(delivered).toHaveLength(0);
    });

    it("returns a generic noop for a non-pending account", async () => {
      await repo.updateUser({ ...pendingUser, status: "active" }, pendingUser.version);
      const outcome = await resendEmailVerificationToken(
        context,
        pendingUser.email,
        policy,
        deliver,
        appUrl,
      );
      expect(outcome).toEqual({ outcome: "noop" });
      expect(delivered).toHaveLength(0);
    });

    it("sends a message carrying the plaintext verification URL", async () => {
      const outcome = await resendEmailVerificationToken(
        context,
        pendingUser.email,
        policy,
        deliver,
        appUrl,
      );

      expect(outcome.outcome).toBe("sent");
      expect(delivered).toHaveLength(1);
      const message = delivered[0];
      expect(message.to).toBe(pendingUser.email);
      expect(message.purpose).toBe(VERIFICATION_PURPOSE);
      expect(message.verificationUrl).toContain("email=alice%40stealth.mail");
      expect(message.verificationUrl).toContain("token=");

      const issuedToken = message.verificationUrl.split("token=")[1];
      const stored = await repo.getVerificationToken(await hashVerificationToken(issuedToken));
      expect(stored).not.toBeNull();
    });

    it("enforces the resend cooldown with a retry-after window", async () => {
      await resendEmailVerificationToken(context, pendingUser.email, policy, deliver, appUrl);
      delivered.length = 0;

      const second = await resendEmailVerificationToken(
        context,
        pendingUser.email,
        policy,
        deliver,
        appUrl,
      );

      expect(second.outcome).toBe("cooldown");
      if (second.outcome === "cooldown") {
        expect(second.retryAfterSeconds).toBeGreaterThan(0);
        expect(second.retryAfterSeconds).toBeLessThanOrEqual(
          Math.ceil(policy.resendCooldownMs / 1000),
        );
      }
      expect(delivered).toHaveLength(0);
    });

    it("allows a resend once the cooldown has elapsed and replaces the old token", async () => {
      const first = await resendEmailVerificationToken(
        context,
        pendingUser.email,
        policy,
        deliver,
        appUrl,
      );
      expect(first.outcome).toBe("sent");
      if (first.outcome !== "sent") throw new Error("unreachable");

      const now = new Date(Date.parse(first.expiresAt.toISOString()) - 1);
      delivered.length = 0;
      const second = await resendEmailVerificationToken(
        context,
        pendingUser.email,
        policy,
        deliver,
        appUrl,
        now,
      );
      expect(second.outcome).toBe("sent");
      expect(delivered).toHaveLength(1);
    });

    it("reports delivery_failed when the transport rejects the message", async () => {
      const failingDeliver = async () => ({
        transport: "smtp" as const,
        accepted: false,
        safeTargetReference: "ref",
      });
      const outcome = await resendEmailVerificationToken(
        context,
        pendingUser.email,
        policy,
        failingDeliver,
        appUrl,
      );
      expect(outcome.outcome).toBe("delivery_failed");
    });
  });

  describe("buildVerificationUrl", () => {
    it("builds a well-formed URL with email and token parameters", () => {
      const url = buildVerificationUrl("https://stealth.mail/", "alice@stealth.mail", "tok_123");
      expect(url).toBe("https://stealth.mail/verify?email=alice%40stealth.mail&token=tok_123");
    });
  });
});
