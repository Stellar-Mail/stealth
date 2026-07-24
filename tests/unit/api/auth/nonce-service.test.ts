import { describe, expect, it } from "vitest";

import {
  getAuthNonceTtlMs,
  InMemoryNonceStore,
  NonceService,
} from "../../../../src/server/api/auth/nonce-service";
import { ApiError } from "../../../../src/server/api/errors";

const T0 = Date.parse("2026-01-01T00:00:00.000Z");
const clock = { now: T0 };
const fixedRandom = (byte: number) => (size: number) => new Uint8Array(size).fill(byte);

function service(store = new InMemoryNonceStore(), ttlMs = 60_000) {
  return new NonceService(store, {
    ttlMs,
    now: () => clock.now,
  });
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe("NonceService", () => {
  it("generates 32 cryptographically random bytes as a hex nonce", async () => {
    let requestedBytes = 0;
    const nonceService = new NonceService(new InMemoryNonceStore(), {
      now: () => T0,
      randomBytes: (size) => {
        requestedBytes = size;
        return fixedRandom(0xab)(size);
      },
    });

    const record = await nonceService.issue("actor-a", "sign-in");

    expect(requestedBytes).toBe(32);
    expect(record.nonce).toBe("ab".repeat(32));
    expect(record).toMatchObject({
      actor: "actor-a",
      purpose: "sign-in",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });
  });

  it("uses the secure default generator to issue unique 64-character hex values", async () => {
    clock.now = T0;
    const nonceService = service();

    const first = await nonceService.issue("actor-a", "sign-in");
    const second = await nonceService.issue("actor-a", "sign-in");

    expect(first.nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(second.nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(first.nonce).not.toBe(second.nonce);
  });

  it("successfully consumes an issued nonce exactly once", async () => {
    clock.now = T0;
    const nonceService = service();
    const issued = await nonceService.issue("actor-a", "sign-in");

    const consumed = await nonceService.consume(issued.nonce, "actor-a", "sign-in");

    expect(consumed.consumedAt).toBe("2026-01-01T00:00:00.000Z");
    await expectCode(nonceService.consume(issued.nonce, "actor-a", "sign-in"), "conflict");
  });

  it("rejects an expired nonce, including the exact expiration boundary", async () => {
    clock.now = T0;
    const nonceService = service(new InMemoryNonceStore(), 60_000);
    const issued = await nonceService.issue("actor-a", "sign-in");
    const justBeforeBoundary = await nonceService.issue("actor-a", "link-device");

    clock.now = T0 + 59_999;
    await expect(
      nonceService.consume(justBeforeBoundary.nonce, "actor-a", "link-device"),
    ).resolves.toMatchObject({ nonce: justBeforeBoundary.nonce });

    clock.now = T0 + 60_000;
    await expectCode(nonceService.consume(issued.nonce, "actor-a", "sign-in"), "expired_challenge");
  });

  it("shares one-time consumption across service instances using the same store", async () => {
    clock.now = T0;
    const sharedStore = new InMemoryNonceStore();
    const issuer = service(sharedStore);
    const verifier = service(sharedStore);
    const issued = await issuer.issue("actor-a", "sign-in");

    await expect(verifier.consume(issued.nonce, "actor-a", "sign-in")).resolves.toMatchObject({
      nonce: issued.nonce,
    });
    await expectCode(issuer.consume(issued.nonce, "actor-a", "sign-in"), "conflict");
  });

  it("rejects an actor mismatch without consuming the nonce", async () => {
    clock.now = T0;
    const nonceService = service();
    const issued = await nonceService.issue("actor-a", "sign-in");

    await expectCode(nonceService.consume(issued.nonce, "actor-b", "sign-in"), "unauthorized");
    await expect(nonceService.consume(issued.nonce, "actor-a", "sign-in")).resolves.toMatchObject({
      actor: "actor-a",
    });
  });

  it("rejects a purpose mismatch without consuming the nonce", async () => {
    clock.now = T0;
    const nonceService = service();
    const issued = await nonceService.issue("actor-a", "sign-in");

    await expectCode(nonceService.consume(issued.nonce, "actor-a", "link-device"), "unauthorized");
    await expect(nonceService.consume(issued.nonce, "actor-a", "sign-in")).resolves.toMatchObject({
      purpose: "sign-in",
    });
  });

  it("allows only one concurrent consumer to succeed", async () => {
    clock.now = T0;
    const nonceService = service();
    const issued = await nonceService.issue("actor-a", "sign-in");

    const results = await Promise.allSettled(
      Array.from({ length: 25 }, () => nonceService.consume(issued.nonce, "actor-a", "sign-in")),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(failures).toHaveLength(24);
    expect(failures.every((result) => result.reason instanceof ApiError)).toBe(true);
    expect(failures.every((result) => result.reason.code === "conflict")).toBe(true);
  });

  it("loads configurable expiration and rejects invalid values", () => {
    expect(getAuthNonceTtlMs({ STEALTH_AUTH_NONCE_TTL_MS: "90000" })).toBe(90_000);
    expect(() => getAuthNonceTtlMs({ STEALTH_AUTH_NONCE_TTL_MS: "0" })).toThrow(
      /STEALTH_AUTH_NONCE_TTL_MS/,
    );
    expect(() => getAuthNonceTtlMs({ STEALTH_AUTH_NONCE_TTL_MS: "invalid" })).toThrow(
      /STEALTH_AUTH_NONCE_TTL_MS/,
    );
  });
});
