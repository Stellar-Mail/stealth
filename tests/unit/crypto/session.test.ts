import { describe, expect, it } from "vitest";

import {
  advanceSession,
  deriveMessageKey,
  deserializeSession,
  IdentityKeyPair,
  SESSION_STATE_VERSION,
  serializeSession,
  SessionError,
  sessionFingerprint,
  type SessionState,
} from "../../../src/services/crypto/session";

function makeIdentity(seed: string): IdentityKeyPair {
  return {
    publicId: "G" + seed.padEnd(54, "A").slice(0, 54) + "C",
    secretSeed: new TextEncoder().encode(seed),
  };
}

function makeSession(): SessionState {
  return {
    version: SESSION_STATE_VERSION,
    sessionId: "sess-001",
    messageIndex: 0,
    epoch: "e1",
  };
}

describe("session key hierarchy (#1716)", () => {
  it("separates identity keys from content keys", async () => {
    const id = makeIdentity("identity-seed");
    const session = makeSession();
    const contentKey = await deriveMessageKey(id, session, 0);
    expect(contentKey.length).toBe(32);
    expect(contentKey).not.toEqual(id.secretSeed);
  });

  it("derivation is deterministic for the same inputs", async () => {
    const id = makeIdentity("det");
    const session = makeSession();
    const a = await deriveMessageKey(id, session, 3);
    const b = await deriveMessageKey(id, session, 3);
    expect(a).toEqual(b);
  });

  it("distinct message indices yield distinct content keys", async () => {
    const id = makeIdentity("idx");
    const session = makeSession();
    const k0 = await deriveMessageKey(id, session, 0);
    const k1 = await deriveMessageKey(id, session, 1);
    expect(k0).not.toEqual(k1);
  });

  it("distinct session ids yield distinct content keys", async () => {
    const id = makeIdentity("sid");
    const a = await deriveMessageKey(id, { ...makeSession(), sessionId: "A" }, 0);
    const b = await deriveMessageKey(id, { ...makeSession(), sessionId: "B" }, 0);
    expect(a).not.toEqual(b);
  });

  it("rejects negative message indices (boundary)", async () => {
    await expect(deriveMessageKey(makeIdentity("x"), makeSession(), -1)).rejects.toBeInstanceOf(
      SessionError,
    );
  });

  it("rejects unsupported session versions", async () => {
    await expect(
      deriveMessageKey(makeIdentity("x"), { ...makeSession(), version: 99 }, 0),
    ).rejects.toBeInstanceOf(SessionError);
  });

  it("session state is versioned and serializable without plaintext", () => {
    const session = makeSession();
    const json = serializeSession(session);
    expect(json).not.toContain("secret");
    const restored = deserializeSession(json);
    expect(restored).toEqual(session);
  });

  it("advanceSession returns a new immutable, incremented state", () => {
    const session = makeSession();
    const next = advanceSession(session);
    expect(next.messageIndex).toBe(1);
    expect(session.messageIndex).toBe(0);
  });

  it("deserializeSession rejects malformed or wrong-version JSON", () => {
    expect(() => deserializeSession("not json")).toThrowError(SessionError);
    expect(() => deserializeSession(JSON.stringify({ version: 99 }))).toThrowError(SessionError);
  });

  it("sessionFingerprint is a stable non-secret hash", async () => {
    const f1 = await sessionFingerprint(makeSession());
    const f2 = await sessionFingerprint(makeSession());
    expect(f1).toBe(f2);
    expect(f1.length).toBe(64);
  });
});
