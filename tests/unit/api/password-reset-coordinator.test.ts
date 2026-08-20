import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  return {
    DurableObject: class DurableObject {
      ctx: any;
      env: any;
      constructor(ctx: any, env: any) {
        this.ctx = ctx;
        this.env = env;
      }
    },
  };
});

import type { VerificationToken } from "../../../src/server/api/domain";
import { StealthCoordinator } from "../../../src/server/api/stealth-coordinator";
import { hashVerificationToken } from "../../../src/server/api/verification-service";

class MockDurableObjectState {
  public id = { toString: () => "mock-do-id" };
  public storage = {
    store: new Map<string, any>(),
    async get(key: string) {
      return this.store.get(key);
    },
    async put(key: string, value: any) {
      this.store.set(key, value);
    },
    async delete(key: string) {
      return this.store.delete(key);
    },
  };
}

const FIXED_NOW = new Date("2026-02-01T00:00:00.000Z");
const PURPOSE = "password_reset";
const USER_ID = "usr_pwd_coord_1";
const TOKEN_LIFETIME_MS = 60 * 60 * 1000;

function token(plaintext: string): VerificationToken {
  return {
    tokenHash: plaintext, // hashes are opaque identifiers at the KV boundary
    userId: USER_ID,
    purpose: PURPOSE,
    createdAt: FIXED_NOW.toISOString(),
    expiresAt: new Date(FIXED_NOW.getTime() + TOKEN_LIFETIME_MS).toISOString(),
    consumedAt: null,
    replacedAt: null,
    replacedByTokenHash: null,
    attemptCount: 0,
    maxAttempts: 5,
  };
}

describe("BETA-009: password reset token lifecycle across the KV persistence boundary (StealthCoordinator)", () => {
  let state: MockDurableObjectState;
  let coordinator: StealthCoordinator;

  beforeEach(() => {
    state = new MockDurableObjectState();
    coordinator = new StealthCoordinator(state as any, {});
  });

  it("issues a token bound to exactly one account and purpose", async () => {
    const candidate = token("a".repeat(64));

    const result = await coordinator.issueVerificationToken(candidate, FIXED_NOW);

    expect(result.outcome).toBe("issued");
    const issued = result as Extract<typeof result, { outcome: "issued" }>;
    expect(issued.replacedToken).toBeNull();
    expect(await coordinator.getVerificationToken(candidate.tokenHash)).toEqual(candidate);
    expect(await coordinator.getActiveVerificationToken(USER_ID, PURPOSE)).toEqual(candidate);
  });

  it("replaces the previous outstanding token on re-issue (single redeemable token per account)", async () => {
    const first = token("b".repeat(64));
    await coordinator.issueVerificationToken(first, FIXED_NOW);

    const second = token("c".repeat(64));
    const replaced = await coordinator.issueVerificationToken(
      second,
      new Date(FIXED_NOW.getTime() + 60_000),
    );

    expect(replaced.outcome).toBe("issued");
    const issued = replaced as Extract<typeof replaced, { outcome: "issued" }>;
    expect(issued.replacedToken).not.toBeNull();
    expect(issued.replacedToken!.tokenHash).toBe(first.tokenHash);
    expect(issued.replacedToken!.replacedAt).not.toBeNull();
    expect(await coordinator.getActiveVerificationToken(USER_ID, PURPOSE)).toEqual(second);
  });

  it("consumes a valid token exactly once and rejects replays at the data layer", async () => {
    const issued = token("d".repeat(64));
    await coordinator.issueVerificationToken(issued, FIXED_NOW);

    const first = await coordinator.consumeVerificationToken(issued.tokenHash, FIXED_NOW);
    expect(first.outcome).toBe("consumed");

    const replay = await coordinator.consumeVerificationToken(
      issued.tokenHash,
      new Date(FIXED_NOW.getTime() + 1),
    );
    expect(replay.outcome).toBe("already-consumed");
  });

  it("rejects an expired token", async () => {
    const issued = token("e".repeat(64));
    await coordinator.issueVerificationToken(issued, FIXED_NOW);

    const afterExpiry = new Date(FIXED_NOW.getTime() + TOKEN_LIFETIME_MS + 1);
    const result = await coordinator.consumeVerificationToken(issued.tokenHash, afterExpiry);
    expect(result.outcome).toBe("expired");
  });

  it("marks any other outstanding token consumed-invalid after invalidation", async () => {
    const first = token("f".repeat(64));
    await coordinator.issueVerificationToken(first, FIXED_NOW);
    const second = token("g".repeat(64));
    await coordinator.issueVerificationToken(second, new Date(FIXED_NOW.getTime() + 60_000));

    await coordinator.invalidateActiveVerificationToken(
      USER_ID,
      PURPOSE,
      new Date(FIXED_NOW.getTime() + 120_000),
    );

    expect(await coordinator.getActiveVerificationToken(USER_ID, PURPOSE)).toBeNull();
    const remaining = await coordinator.consumeVerificationToken(
      first.tokenHash,
      new Date(FIXED_NOW.getTime() + 121_000),
    );
    expect(remaining.outcome).toBe("replaced");
  });

  it("locks the token once the brute-force attempt cap is reached", async () => {
    const issued = token("h".repeat(64));
    await coordinator.issueVerificationToken(issued, FIXED_NOW);

    const afterExpiry = new Date(FIXED_NOW.getTime() + TOKEN_LIFETIME_MS + 1);
    for (let i = 0; i < issued.maxAttempts; i += 1) {
      const result = await coordinator.consumeVerificationToken(issued.tokenHash, afterExpiry);
      expect(result.outcome).toBe("expired");
      await coordinator.recordVerificationAttempt(issued.tokenHash, afterExpiry);
    }

    const blocked = await coordinator.consumeVerificationToken(issued.tokenHash, afterExpiry);
    expect(blocked.outcome).toBe("brute-force-blocked");
  });

  it("only ever persists the token hash, never the plaintext token", async () => {
    const plaintext = "plaintext-token-value";
    const issued: VerificationToken = {
      ...token("i".repeat(64)),
      tokenHash: await hashVerificationToken(plaintext),
    };
    await coordinator.issueVerificationToken(issued, FIXED_NOW);

    const persisted = [...state.storage.store.values()].map((v) =>
      typeof v === "string" ? v : JSON.stringify(v),
    );
    expect(persisted.join("|")).not.toContain(plaintext);
  });
});
