import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiContext } from "../../../../src/server/api/context";
import type { RecoveryCodeSet, Session, User } from "../../../../src/server/api/domain";
import { MemoryApiRepository } from "../../../../src/server/api/memory-repository";
import { hashPassword } from "../../../../src/server/api/auth/password";
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  getRecoveryStatus,
  normalizeRecoveryCode,
  redeemRecoveryCode,
  regenerateRecoveryCodes,
} from "../../../../src/server/api/auth/recovery";

describe("BETA-010: One-time recovery codes (/api/v1/auth/recovery)", () => {
  let repo: MemoryApiRepository;
  const now = new Date("2026-07-01T12:00:00.000Z");

  const testUser: User = {
    userId: "usr_recovery_test",
    address: `G${"A".repeat(55)}`,
    email: "recovery_user@stealth.mail",
    username: "recovery_user",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };

  function makeSession(partial: Partial<Session> = {}): Session {
    return {
      sessionId: "sess_recovery_presenting",
      userId: testUser.userId,
      createdAt: "2026-07-01T11:00:00.000Z",
      expiresAt: "2026-07-08T12:00:00.000Z",
      lastActiveAt: "2026-07-01T11:00:00.000Z",
      absoluteExpiresAt: "2026-08-01T12:00:00.000Z",
      ipAddress: null,
      userAgent: null,
      deviceFingerprint: null,
      recentLoginAt: "2026-07-01T11:55:00.000Z",
      ...partial,
    };
  }

  async function seedCodes(): Promise<{ first: string; second: string }> {
    const { codes } = await generateRecoveryCodes(createApiContext(repo), testUser.userId, {
      now: () => now,
    });
    return { first: codes[0], second: codes[1] };
  }

  beforeEach(async () => {
    repo = new MemoryApiRepository();
    const { hash, salt } = await hashPassword("Password123!");
    await repo.createUser(
      testUser,
      {
        credentialId: "cred_recovery_test",
        userId: testUser.userId,
        authMethod: "password_hash",
        secretHash: `${hash}:${salt}`,
        walletKeyRef: "vault_ref",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        userId: testUser.userId,
        username: testUser.username,
        displayName: "Recovery User",
        avatarUrl: null,
        bio: null,
        locale: "en",
        timezone: "UTC",
        addressDisplay: "truncated" as const,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    );
  });

  describe("normalizeRecoveryCode", () => {
    it("canonicalizes case and separators", () => {
      expect(normalizeRecoveryCode("abcd-efgh-jklm-nopq")).toBe("ABCDEFGHJKLMNOPQ");
      expect(normalizeRecoveryCode("abcd efgh jklm nopq")).toBe("ABCDEFGHJKLMNOPQ");
      expect(normalizeRecoveryCode("aBcDeFgHiJkLmNoP")).toBe("ABCDEFGHIJKLMNOP");
    });

    it("rejects input that cannot be a base32 16-character code", () => {
      expect(normalizeRecoveryCode("123456")).toBeNull();
      expect(normalizeRecoveryCode("OOO")) // 0/O ambiguity — only A-Z2-7 survive
        .toBeNull();
      expect(normalizeRecoveryCode("")).toBeNull();
    });
  });

  describe("generateRecoveryCodes", () => {
    it("returns plaintext codes and stores only hashes", async () => {
      const { codes, set } = await generateRecoveryCodes(createApiContext(repo), testUser.userId, {
        now: () => now,
      });

      expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
      for (const code of codes) {
        expect(code).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
      }
      expect(set.codes).toHaveLength(RECOVERY_CODE_COUNT);
      expect(set.status).toBe("active");
      expect(set.version).toBe(1);

      // No plaintext code material may be stored.
      const stored = await repo.getRecoveryCodeSet(testUser.userId);
      for (const code of codes) {
        const normalized = code.replace(/-/g, "");
        expect(JSON.stringify(stored)).not.toContain(code);
        expect(JSON.stringify(stored)).not.toContain(normalized);
      }
    });

    it("is create-only: a second generation conflicts with 409", async () => {
      await generateRecoveryCodes(createApiContext(repo), testUser.userId, { now: () => now });

      await expect(
        generateRecoveryCodes(createApiContext(repo), testUser.userId, { now: () => now }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("exposes a status view without any secret material", async () => {
      await generateRecoveryCodes(createApiContext(repo), testUser.userId, { now: () => now });

      const status = await getRecoveryStatus(createApiContext(repo), testUser.userId);
      expect(status).toEqual({
        status: "active",
        totalCodes: RECOVERY_CODE_COUNT,
        remainingCodes: RECOVERY_CODE_COUNT,
        generatedAt: now.toISOString(),
      });
    });

    it("reports 'none' when no set exists", async () => {
      const status = await getRecoveryStatus(createApiContext(repo), testUser.userId);
      expect(status).toEqual({
        status: "none",
        totalCodes: 0,
        remainingCodes: 0,
        generatedAt: null,
      });
    });
  });

  describe("redeemRecoveryCode", () => {
    it("consumes one code, revokes all sessions, and issues a fresh session", async () => {
      const { first } = await seedCodes();
      await repo.createSession(makeSession({ sessionId: "sess_old_device" }));
      await repo.createSession(makeSession({ sessionId: "sess_other_device" }));

      const result = await redeemRecoveryCode(createApiContext(repo), {
        identifier: "recovery_user@stealth.mail",
        code: first,
      });

      expect(result.user.userId).toBe(testUser.userId);
      expect(result.session.sessionId).toBeDefined();
      expect(result.session.sessionId).not.toBe("sess_old_device");
      expect(result.session.recentLoginAt).toBeDefined();
      expect(result.cookieHeader).toContain("stealth_session=");

      // All prior sessions revoked; only the freshly minted one survives.
      await expect(repo.getSession("sess_old_device")).resolves.toBeNull();
      await expect(repo.getSession("sess_other_device")).resolves.toBeNull();
      await expect(repo.getSession(result.session.sessionId)).resolves.not.toBeNull();
    });

    it("is single-use: reusing a consumed code fails with the uniform 401", async () => {
      const { first } = await seedCodes();
      await redeemRecoveryCode(createApiContext(repo), {
        identifier: "recovery_user",
        code: first,
      });

      await expect(
        redeemRecoveryCode(createApiContext(repo), {
          identifier: "recovery_user",
          code: first,
        }),
      ).rejects.toMatchObject({ status: 401 });

      const status = await getRecoveryStatus(createApiContext(repo), testUser.userId);
      expect(status.remainingCodes).toBe(RECOVERY_CODE_COUNT - 1);
    });

    it("accepts username or email identifiers, case-insensitively, with formatted input", async () => {
      const { first } = await seedCodes();
      const lowerWithSpaces = `${first.toLowerCase()} `;

      const result = await redeemRecoveryCode(createApiContext(repo), {
        identifier: "RECOVERY_USER@STEALTH.MAIL",
        code: lowerWithSpaces,
      });
      expect(result.user.userId).toBe(testUser.userId);
    });

    it("fails uniformly for unknown accounts, bad codes, and exhausted sets", async () => {
      const { first } = await seedCodes();
      const attempts = [
        { identifier: "nobody@stealth.mail", code: first },
        { identifier: "recovery_user", code: "AAAA-BBBB-CCCC-DDDD" },
        { identifier: "recovery_user", code: "not-a-code" },
      ];
      for (const attempt of attempts) {
        await expect(redeemRecoveryCode(createApiContext(repo), attempt)).rejects.toMatchObject({
          status: 401,
        });
      }
    });

    it("throttles brute-force attempts with 429 after 5 failures", async () => {
      const { second } = await seedCodes();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(
          redeemRecoveryCode(createApiContext(repo), {
            identifier: "recovery_user",
            code: "AAAA-BBBB-CCCC-DDDD",
          }),
        ).rejects.toMatchObject({ status: 401 });
      }

      await expect(
        redeemRecoveryCode(createApiContext(repo), {
          identifier: "recovery_user",
          code: second,
        }),
      ).rejects.toMatchObject({ status: 429 });
    });

    it("exhausts the set when every code has been consumed", { timeout: 60_000 }, async () => {
      const { codes } = await generateRecoveryCodes(createApiContext(repo), testUser.userId, {
        now: () => now,
      });
      for (const code of codes) {
        const result = await redeemRecoveryCode(createApiContext(repo), {
          identifier: "recovery_user",
          code,
        });
        expect(result.session.sessionId).toBeDefined();
      }

      const stored = await repo.getRecoveryCodeSet(testUser.userId);
      expect(stored?.status).toBe("exhausted");
      expect((await getRecoveryStatus(createApiContext(repo), testUser.userId)).status).toBe(
        "exhausted",
      );
    });

    it("conflicts atomically: two simultaneous redemptions of the same code succeed exactly once", async () => {
      const { first } = await seedCodes();

      const results = await Promise.allSettled([
        redeemRecoveryCode(createApiContext(repo), {
          identifier: "recovery_user",
          code: first,
        }),
        redeemRecoveryCode(createApiContext(repo), {
          identifier: "recovery_user",
          code: first,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (rejected[0].status === "rejected") {
        expect(rejected[0].reason).toMatchObject({ status: 401 });
      }

      const status = await getRecoveryStatus(createApiContext(repo), testUser.userId);
      expect(status.remainingCodes).toBe(RECOVERY_CODE_COUNT - 1);
    });

    it("repository CAS admits exactly one writer for a stale expected version", async () => {
      const { first } = await seedCodes();
      const current = await repo.getRecoveryCodeSet(testUser.userId);
      expect(current).not.toBeNull();

      const stale: RecoveryCodeSet = {
        ...current!,
        codes: current!.codes.map((entry) =>
          entry.salt === current!.codes[0].salt && entry.hash === current!.codes[0].hash
            ? { ...entry, usedAt: now.toISOString() }
            : entry,
        ),
        updatedAt: now.toISOString(),
      };

      const writers = await Promise.all([
        repo.setRecoveryCodeSet(structuredClone(stale), current!.version),
        repo.setRecoveryCodeSet(structuredClone(stale), current!.version),
      ]);

      expect(writers.filter((w) => w.updated)).toHaveLength(1);
      const stored = await repo.getRecoveryCodeSet(testUser.userId);
      expect(stored?.version).toBe(current!.version + 1);
      expect(stored?.codes.filter((e) => e.usedAt !== null)).toHaveLength(1);
    });
  });

  describe("regenerateRecoveryCodes", () => {
    it("denies when the session predates the recent-login window", async () => {
      const session = makeSession({ recentLoginAt: "2026-07-01T11:00:00.000Z" });

      await expect(
        regenerateRecoveryCodes(createApiContext(repo), session, { now: () => now }),
      ).rejects.toMatchObject({
        status: 403,
        code: "forbidden",
      });
    });

    it("denies sessions with no login marker at all", async () => {
      const session = makeSession({ recentLoginAt: undefined });

      await expect(
        regenerateRecoveryCodes(createApiContext(repo), session, { now: () => now }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("replaces the set, returns fresh codes, and keeps the presenter signed in", async () => {
      const { first } = await seedCodes();
      await repo.createSession(makeSession({ sessionId: "sess_other_device" }));
      const presenting = makeSession();

      const result = await regenerateRecoveryCodes(createApiContext(repo), presenting, {
        now: () => now,
      });

      expect(result.codes).toHaveLength(RECOVERY_CODE_COUNT);
      expect(result.status).toBe("active");
      expect(result.remainingCodes).toBe(RECOVERY_CODE_COUNT);

      // Old codes are dead; the presenting session survived; others revoked.
      await expect(
        redeemRecoveryCode(createApiContext(repo), {
          identifier: "recovery_user",
          code: first,
        }),
      ).rejects.toMatchObject({ status: 401 });
      await expect(repo.getSession("sess_other_device")).resolves.toBeNull();
      await expect(repo.getSession(presenting.sessionId)).resolves.toMatchObject({
        sessionId: presenting.sessionId,
      });

      const stored = await repo.getRecoveryCodeSet(testUser.userId);
      expect(stored?.version).toBe(2);
    });
  });

  describe("audit logging", () => {
    let infoSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      infoSpy?.mockRestore();
    });

    function auditActions(): Array<Record<string, unknown>> {
      const events: Array<Record<string, unknown>> = [];
      for (const call of vi.mocked(console.info).mock.calls) {
        const line = call[0] as string;
        if (!line.includes("_audit")) continue;
        events.push(JSON.parse(line));
      }
      return events;
    }

    it("emits structured events for generation, redemption, rejection, and regeneration", async () => {
      infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { first } = await seedCodes();

      await expect(
        redeemRecoveryCode(createApiContext(repo), {
          identifier: "recovery_user",
          code: "AAAA-BBBB-CCCC-DDDD",
        }),
      ).rejects.toMatchObject({ status: 401 });

      await redeemRecoveryCode(createApiContext(repo), {
        identifier: "recovery_user",
        code: first,
      });

      await expect(
        regenerateRecoveryCodes(
          createApiContext(repo),
          makeSession({ recentLoginAt: "2026-07-01T10:00:00.000Z" }),
          { now: () => now },
        ),
      ).rejects.toMatchObject({ status: 403 });

      await regenerateRecoveryCodes(createApiContext(repo), makeSession(), { now: () => now });

      const events = auditActions();
      const actions = events.map((e) => e.action);

      expect(actions).toEqual(
        expect.arrayContaining([
          "auth.recovery_codes_generated",
          "auth.recovery_code_redeem_denied",
          "auth.recovery_code_redeemed",
          "auth.recovery_regenerate_recent_login_denied",
          "auth.recovery_codes_regenerated",
          "auth.user_other_sessions_revoked",
        ]),
      );

      const generation = events.find((e) => e.action === "auth.recovery_codes_generated");
      expect(generation).toMatchObject({ result: "success", actor: testUser.userId });

      const redeem = events.find((e) => e.action === "auth.recovery_code_redeemed");
      expect(redeem).toMatchObject({ result: "success", actor: testUser.userId });

      const denied = events.find((e) => e.action === "auth.recovery_code_redeem_denied");
      expect(denied).toMatchObject({ result: "denied" });
    });

    it("never writes plaintext code material into audit events or logs", async () => {
      infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { codes } = await generateRecoveryCodes(createApiContext(repo), testUser.userId, {
        now: () => now,
      });
      await redeemRecoveryCode(createApiContext(repo), {
        identifier: "recovery_user",
        code: codes[0],
      });

      const logged = vi
        .mocked(console.info)
        .mock.calls.map((call) => call[0] as string)
        .join("\n");

      for (const code of codes) {
        const normalized = code.replace(/-/g, "");
        expect(logged).not.toContain(code);
        expect(logged).not.toContain(normalized);
      }
    });
  });
});
