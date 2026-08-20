import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiContext } from "../../../../src/server/api/context";
import { createApiContext } from "../../../../src/server/api/context";
import type { Credential, User, VerificationPurpose } from "../../../../src/server/api/domain";
import { ApiError } from "../../../../src/server/api/errors";
import { MemoryApiRepository } from "../../../../src/server/api/memory-repository";
import {
  buildPasswordResetUrl,
  completePasswordReset,
  DEFAULT_PASSWORD_RESET_POLICY,
  issuePasswordResetToken,
  PASSWORD_RESET_PURPOSE,
  requestPasswordReset,
  type PasswordResetPolicy,
} from "../../../../src/server/api/auth/password-reset-service";
import { hashPassword } from "../../../../src/server/api/auth/password";
import {
  authenticateWithPassword,
  validateSession,
} from "../../../../src/server/api/auth/session-service";
import { hashVerificationToken } from "../../../../src/server/api/verification-service";
import type { VerificationEmailMessage } from "../../../../src/services/notifications/adapter";

const policy: PasswordResetPolicy = {
  tokenLifetimeMs: 60_000,
  resendCooldownMs: 30_000,
  maxAttempts: 5,
  ipRateLimitWindowSeconds: 3600,
  maxRequestsPerIp: 10,
};

const FIXED_NOW = new Date("2026-02-01T00:00:00.000Z");

function activeUser(userId: string, email: string): User {
  return {
    userId,
    address: `G${userId
      .replace(/[^A-Z]/g, "F")
      .padEnd(55, "F")
      .slice(0, 55)}`,
    email,
    username: `pwd_${userId}`,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };
}

function credential(userId: string, secretHash: string): Credential {
  return {
    credentialId: `cred_${userId}`,
    userId,
    authMethod: "password_hash",
    secretHash,
    walletKeyRef: `wallet_${userId}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function deliveredMessages(): {
  messages: VerificationEmailMessage[];
  deliver: (message: VerificationEmailMessage) => Promise<{
    transport: "sink";
    accepted: boolean;
    safeTargetReference: string;
  }>;
} {
  const messages: VerificationEmailMessage[] = [];
  return {
    messages,
    deliver: async (message) => {
      messages.push(message);
      return {
        transport: "sink",
        accepted: true,
        safeTargetReference: "ref",
      };
    },
  };
}

async function runWithClock<T>(at: Date, fn: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();
  vi.setSystemTime(at);
  try {
    return await fn();
  } finally {
    vi.useRealTimers();
  }
}

describe("BETA-009: password reset service", () => {
  let repo: MemoryApiRepository;
  let context: ApiContext;

  beforeEach(() => {
    repo = new MemoryApiRepository();
    context = createApiContext(repo);
  });

  afterEach(() => {
    repo.reset();
  });

  describe("buildPasswordResetUrl", () => {
    it("builds a well-formed reset URL with email and token parameters", () => {
      expect(buildPasswordResetUrl("https://stealth.mail/", "alice@stealth.mail", "tok_123")).toBe(
        "https://stealth.mail/reset-password?email=alice%40stealth.mail&token=tok_123",
      );
    });
  });

  describe("issuePasswordResetToken", () => {
    it("persists only the hash, never the plaintext token", async () => {
      const issued = await issuePasswordResetToken(context, "usr_pwd_1", policy, FIXED_NOW);

      const stored = await repo.getVerificationToken(issued.tokenHash);
      expect(stored).not.toBeNull();
      expect(stored!.tokenHash).toBe(issued.tokenHash);
      expect(stored!.purpose).toBe(PASSWORD_RESET_PURPOSE);
      expect(JSON.stringify(stored)).not.toContain(issued.plaintextToken);
    });

    it("respects the configured token lifetime", async () => {
      const issued = await issuePasswordResetToken(context, "usr_pwd_1", policy, FIXED_NOW);
      expect(issued.expiresAt.getTime()).toBe(FIXED_NOW.getTime() + policy.tokenLifetimeMs);
    });
  });

  describe("requestPasswordReset", () => {
    it("sends a password-reset message carrying the plaintext reset URL", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const { messages, deliver } = deliveredMessages();

      const outcome = await requestPasswordReset(
        context,
        { email: "Alice@Stealth.Mail", ip: "203.0.113.1" },
        deliver,
        "https://stealth.mail",
        policy,
        FIXED_NOW,
      );

      expect(outcome).toEqual({ status: "sent", retryAfterSeconds: 30 });
      expect(messages).toHaveLength(1);
      const message = messages[0];
      expect(message.to).toBe("alice@stealth.mail");
      expect(message.purpose).toBe(PASSWORD_RESET_PURPOSE);
      expect(message.verificationUrl).toContain("email=alice%40stealth.mail");
      expect(message.verificationUrl).toContain("token=");
      expect(message.expiresAt.getTime()).toBe(FIXED_NOW.getTime() + policy.tokenLifetimeMs);

      const token = message.verificationUrl.split("token=")[1];
      const stored = await repo.getVerificationToken(await hashVerificationToken(token));
      expect(stored).not.toBeNull();
    });

    it("responds identically for unknown emails without delivering or leaking existence", async () => {
      const { messages, deliver } = deliveredMessages();

      const outcome = await requestPasswordReset(
        context,
        { email: "ghost@stealth.mail", ip: "203.0.113.2" },
        deliver,
        "https://stealth.mail",
        policy,
        FIXED_NOW,
      );

      expect(outcome).toEqual({ status: "sent", retryAfterSeconds: 30 });
      expect(messages).toHaveLength(0);
    });

    it("enforces the resend cooldown with a retry-after window", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const { messages, deliver } = deliveredMessages();

      await runWithClock(FIXED_NOW, async () => {
        await requestPasswordReset(
          context,
          { email: "alice@stealth.mail", ip: "203.0.113.3" },
          deliver,
          "https://stealth.mail",
          policy,
          FIXED_NOW,
        );
        messages.length = 0;

        vi.setSystemTime(new Date(FIXED_NOW.getTime() + 10_000));
        const error = await requestPasswordReset(
          context,
          { email: "alice@stealth.mail", ip: "203.0.113.3" },
          deliver,
          "https://stealth.mail",
          policy,
          new Date(FIXED_NOW.getTime() + 10_000),
        ).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(429);
        expect((error as ApiError).code).toBe("too_many_requests");
        expect((error as ApiError).retryAfterSeconds).toBe(30);
        expect(messages).toHaveLength(0);
      });
    });

    it("applies the cooldown identically to unknown accounts (enumeration-resistant)", async () => {
      const { messages, deliver } = deliveredMessages();

      await runWithClock(FIXED_NOW, async () => {
        const first = await requestPasswordReset(
          context,
          { email: "ghost@stealth.mail", ip: "203.0.113.31" },
          deliver,
          "https://stealth.mail",
          policy,
          FIXED_NOW,
        );
        expect(first.status).toBe("sent");

        vi.setSystemTime(new Date(FIXED_NOW.getTime() + 10_000));
        const second = await requestPasswordReset(
          context,
          { email: "ghost@stealth.mail", ip: "203.0.113.31" },
          deliver,
          "https://stealth.mail",
          policy,
          new Date(FIXED_NOW.getTime() + 10_000),
        ).catch((e: unknown) => e);

        expect(second).toBeInstanceOf(ApiError);
        expect((second as ApiError).status).toBe(429);
        expect((second as ApiError).code).toBe("too_many_requests");
        expect((second as ApiError).retryAfterSeconds).toBe(30);
        expect(messages).toHaveLength(0);
      });
    });

    it("allows a new request once the cooldown has elapsed and replaces the old token", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const { messages, deliver } = deliveredMessages();

      await runWithClock(FIXED_NOW, async () => {
        const first = await requestPasswordReset(
          context,
          { email: "alice@stealth.mail", ip: "203.0.113.4" },
          deliver,
          "https://stealth.mail",
          policy,
          FIXED_NOW,
        );
        expect(first.status).toBe("sent");
        const firstToken = messages[0].verificationUrl.split("token=")[1];

        messages.length = 0;
        vi.setSystemTime(new Date(FIXED_NOW.getTime() + policy.resendCooldownMs + 1));
        const second = await requestPasswordReset(
          context,
          { email: "alice@stealth.mail", ip: "203.0.113.4" },
          deliver,
          "https://stealth.mail",
          policy,
          new Date(FIXED_NOW.getTime() + policy.resendCooldownMs + 1),
        );

        expect(second.status).toBe("sent");
        expect(messages).toHaveLength(1);

        const firstHash = await hashVerificationToken(firstToken);
        const oldRecord = await repo.getVerificationToken(firstHash);
        expect(oldRecord!.replacedAt).not.toBeNull();
      });
    });

    it("rejects requests beyond the per-IP budget", async () => {
      const { deliver } = deliveredMessages();

      for (let i = 0; i < policy.maxRequestsPerIp; i += 1) {
        const outcome = await requestPasswordReset(
          context,
          { email: `ghost_${i}@stealth.mail`, ip: "198.51.100.9" },
          deliver,
          "https://stealth.mail",
          policy,
          FIXED_NOW,
        );
        expect(outcome.status).toBe("sent");
      }

      const error = await requestPasswordReset(
        context,
        { email: `ghost_10@stealth.mail`, ip: "198.51.100.9" },
        deliver,
        "https://stealth.mail",
        policy,
        FIXED_NOW,
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(429);
      expect((error as ApiError).code).toBe("too_many_requests");
    });

    it("throws 503 when the transport rejects the message", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const failingDeliver = async () => ({
        transport: "smtp" as const,
        accepted: false,
        safeTargetReference: "ref",
      });

      const error = await requestPasswordReset(
        context,
        { email: "alice@stealth.mail", ip: "203.0.113.5" },
        failingDeliver,
        "https://stealth.mail",
        policy,
        FIXED_NOW,
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(503);
      expect((error as ApiError).code).toBe("dependency_unavailable");
    });

    it("throws 503 when the transport throws", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const throwingDeliver = async () => {
        throw new Error("smtp down");
      };

      const error = await requestPasswordReset(
        context,
        { email: "alice@stealth.mail", ip: "203.0.113.5" },
        throwingDeliver,
        "https://stealth.mail",
        policy,
        FIXED_NOW,
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(503);
      expect((error as ApiError).code).toBe("dependency_unavailable");
    });
  });

  describe("completePasswordReset", () => {
    const newPassword = "NewSecurePassword!2026";

    async function issueResetToken(userId: string): Promise<string> {
      const issued = await issuePasswordResetToken(context, userId, policy, FIXED_NOW);
      return issued.plaintextToken;
    }

    it("resets the password, consumes the token, and revokes all sessions", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      await repo.createSession({
        sessionId: "sess_pwd_1",
        userId: "usr_pwd_1",
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-02-01T00:00:00.000Z",
        lastActiveAt: "2026-01-01T00:00:00.000Z",
      });
      const token = await issueResetToken("usr_pwd_1");

      const outcome = await completePasswordReset(
        context,
        { token, newPassword, host: "stealth.mail" },
        FIXED_NOW,
      );

      expect(outcome.success).toBe(true);
      expect(outcome.message).toContain("revoked");
      expect(outcome.cookieHeaders.length).toBeGreaterThan(0);

      const storedCredential = await repo.getCredential("usr_pwd_1");
      expect(storedCredential!.secretHash).not.toBe("old-secret");

      const consumed = await repo.getVerificationToken(await hashVerificationToken(token));
      expect(consumed!.consumedAt).not.toBeNull();

      const active = await repo.getActiveVerificationToken("usr_pwd_1", PASSWORD_RESET_PURPOSE);
      expect(active).toBeNull();

      expect(await repo.getSession("sess_pwd_1")).toBeNull();
    });

    it("rejects a token for the wrong purpose", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );

      const error = await completePasswordReset(
        context,
        { token: "not-a-real-token", newPassword },
        FIXED_NOW,
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).code).toBe("bad_request");
    });

    it("rejects an expired token", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const token = await issueResetToken("usr_pwd_1");

      const afterExpiry = new Date(FIXED_NOW.getTime() + policy.tokenLifetimeMs + 1);
      const error = await completePasswordReset(context, { token, newPassword }, afterExpiry).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).code).toBe("bad_request");
    });

    it("rejects a replayed (already consumed) token with 409", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const token = await issueResetToken("usr_pwd_1");

      const first = await completePasswordReset(context, { token, newPassword }, FIXED_NOW);
      expect(first.success).toBe(true);

      const replay = await completePasswordReset(
        context,
        { token, newPassword },
        new Date(FIXED_NOW.getTime() + 1),
      ).catch((e: unknown) => e);

      expect(replay).toBeInstanceOf(ApiError);
      expect((replay as ApiError).status).toBe(409);
      expect((replay as ApiError).code).toBe("conflict");
    });

    it("rejects a superseded token with 409", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const token = await issueResetToken("usr_pwd_1");
      await issuePasswordResetToken(
        context,
        "usr_pwd_1",
        policy,
        new Date(FIXED_NOW.getTime() + policy.resendCooldownMs + 1),
      );

      const error = await completePasswordReset(context, { token, newPassword }, FIXED_NOW).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(409);
      expect((error as ApiError).code).toBe("conflict");
    });

    it("locks the token after the maximum number of failed attempts", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const token = await issueResetToken("usr_pwd_1");
      const afterExpiry = new Date(FIXED_NOW.getTime() + policy.tokenLifetimeMs + 1);

      for (let attempt = 0; attempt < policy.maxAttempts; attempt += 1) {
        const error = await completePasswordReset(
          context,
          { token, newPassword },
          afterExpiry,
        ).catch((e: unknown) => e);
        expect((error as ApiError).status).toBe(400);
      }

      const blocked = await completePasswordReset(
        context,
        { token, newPassword },
        afterExpiry,
      ).catch((e: unknown) => e);

      expect(blocked).toBeInstanceOf(ApiError);
      expect((blocked as ApiError).status).toBe(429);
      expect((blocked as ApiError).code).toBe("too_many_requests");
    });

    it("rejects a token presented with a different email", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const token = await issueResetToken("usr_pwd_1");

      const error = await completePasswordReset(
        context,
        { token, newPassword, email: "mallory@stealth.mail" },
        FIXED_NOW,
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).code).toBe("bad_request");
    });

    it.each([
      ["too short", "Short1A"],
      ["no lowercase", "UPPERCASE123456"],
      ["no uppercase", "lowercase123456"],
      ["no digit", "LowerUpperOnly"],
      ["too long", "A".repeat(260) + "a1"],
    ])("rejects a password that %s with 422", async (_label, password) => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const token = await issueResetToken("usr_pwd_1");

      const error = await completePasswordReset(
        context,
        { token, newPassword: password },
        FIXED_NOW,
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(422);
      expect((error as ApiError).code).toBe("validation_error");
    });

    it("exactly one of two racing completions succeeds", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const token = await issueResetToken("usr_pwd_1");

      const outcomes = await Promise.all(
        [FIXED_NOW, new Date(FIXED_NOW.getTime() + 1)].map((now) =>
          completePasswordReset(context, { token, newPassword }, now)
            .then(() => "success" as const)
            .catch((e: unknown) => (e as ApiError).status),
        ),
      );

      expect(outcomes).toContain("success");
      expect(outcomes).toContain(409);

      const consumed = await repo.getVerificationToken(await hashVerificationToken(token));
      expect(consumed!.consumedAt).not.toBeNull();

      const storedCredential = await repo.getCredential("usr_pwd_1");
      expect(storedCredential!.secretHash).not.toBe("old-secret");
    });

    it("completing a reset invalidates every other outstanding reset token for the account", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const firstToken = await issueResetToken("usr_pwd_1");

      const secondNow = new Date(FIXED_NOW.getTime() + policy.resendCooldownMs + 1);
      const second = await issuePasswordResetToken(context, "usr_pwd_1", policy, secondNow);
      expect(second.replaced).toBe(true);

      const outcome = await completePasswordReset(
        context,
        { token: second.plaintextToken, newPassword },
        new Date(secondNow.getTime() + 1),
      );
      expect(outcome.success).toBe(true);

      const active = await repo.getActiveVerificationToken("usr_pwd_1", PASSWORD_RESET_PURPOSE);
      expect(active).toBeNull();

      const superseded = await completePasswordReset(
        context,
        { token: firstToken, newPassword },
        new Date(secondNow.getTime() + 2),
      ).catch((e: unknown) => e);
      expect(superseded).toBeInstanceOf(ApiError);
      expect((superseded as ApiError).status).toBe(409);
      expect((superseded as ApiError).code).toBe("conflict");
    });

    it("revokes every prior session on reset: the old session no longer authenticates and the old password stops working", async () => {
      const oldCredential = await hashPassword("SecureOldPass!2026");
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", `${oldCredential.hash}:${oldCredential.salt}`),
      );

      const authenticated = await authenticateWithPassword(
        context,
        { identifier: "alice@stealth.mail", password: "SecureOldPass!2026" },
        { now: () => FIXED_NOW },
      );
      const oldSessionId = authenticated.session.sessionId;
      expect(await repo.getSession(oldSessionId)).not.toBeNull();

      const token = await issueResetToken("usr_pwd_1");
      const outcome = await completePasswordReset(
        context,
        { token, newPassword, host: "stealth.mail" },
        FIXED_NOW,
      );
      expect(outcome.success).toBe(true);

      expect(await repo.getSession(oldSessionId)).toBeNull();
      expect(await validateSession(context, oldSessionId, { now: () => FIXED_NOW })).toBeNull();

      const oldPasswordAttempt = await authenticateWithPassword(
        context,
        { identifier: "alice@stealth.mail", password: "SecureOldPass!2026" },
        { now: () => FIXED_NOW },
      ).catch((e: unknown) => e);
      expect(oldPasswordAttempt).toBeInstanceOf(ApiError);
      expect((oldPasswordAttempt as ApiError).status).toBe(401);

      const newSession = await authenticateWithPassword(
        context,
        { identifier: "alice@stealth.mail", password: newPassword },
        { now: () => FIXED_NOW },
      );
      expect(newSession.session.sessionId).not.toBe(oldSessionId);
    });

    it("uses the default policy when none is supplied", async () => {
      expect(DEFAULT_PASSWORD_RESET_POLICY.tokenLifetimeMs).toBe(60 * 60 * 1000);
      expect(DEFAULT_PASSWORD_RESET_POLICY.maxRequestsPerIp).toBe(10);
      expect(DEFAULT_PASSWORD_RESET_POLICY.maxAttempts).toBe(5);
    });
  });

  describe("purpose isolation", () => {
    it("keeps password reset tokens isolated from email verification tokens", async () => {
      await repo.createUser(
        activeUser("usr_pwd_1", "alice@stealth.mail"),
        credential("usr_pwd_1", "old-secret"),
      );
      const issued = await issuePasswordResetToken(context, "usr_pwd_1", policy, FIXED_NOW);

      const stored = await repo.getVerificationToken(issued.tokenHash);
      expect(stored!.purpose).toBe("password_reset" satisfies VerificationPurpose);
      expect(stored!.purpose).not.toBe("email_verification");
    });
  });
});
