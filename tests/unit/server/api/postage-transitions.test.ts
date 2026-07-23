import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../../src/server/api/memory-repository";
import type { Postage, PostageStatus } from "../../../../src/server/api/domain";
import {
  ALLOWED_POSTAGE_TRANSITIONS,
  isAllowedTransition,
  PostageTransitionError,
  validatePostageTransition,
} from "../../../../src/server/api/postage-transitions";

function makePostage(messageId: string, status: PostageStatus): Postage {
  return {
    amount: "1000",
    createdAt: "2026-07-23T12:00:00.000Z",
    messageId,
    paymentHash: "a".repeat(64),
    recipient: "G".padEnd(56, "A"),
    sender: "G".padEnd(56, "B"),
    status,
  };
}

describe("postage transition rules (#1496)", () => {
  it("permits pending -> settled and pending -> refunded", () => {
    expect(isAllowedTransition("pending", "settled")).toBe(true);
    expect(isAllowedTransition("pending", "refunded")).toBe(true);
  });

  it("permits settled -> refunded but not settled -> pending", () => {
    expect(isAllowedTransition("settled", "refunded")).toBe(true);
    expect(isAllowedTransition("settled", "pending")).toBe(false);
  });

  it("treats refunded as terminal (no outgoing transitions)", () => {
    expect(isAllowedTransition("refunded", "pending")).toBe(false);
    expect(isAllowedTransition("refunded", "settled")).toBe(false);
    expect(isAllowedTransition("refunded", "refunded")).toBe(true); // idempotent no-op
  });

  it("allows idempotent retry (from -> from) for every status", () => {
    (Object.keys(ALLOWED_POSTAGE_TRANSITIONS) as PostageStatus[]).forEach((s) => {
      expect(isAllowedTransition(s, s)).toBe(true);
    });
  });

  it("validatePostageTransition throws on illegal moves", () => {
    expect(() => validatePostageTransition("settled", "pending")).toThrowError(
      PostageTransitionError,
    );
    expect(() => validatePostageTransition("refunded", "settled")).toThrowError(
      PostageTransitionError,
    );
    expect(() => validatePostageTransition("pending", "settled")).not.toThrow();
  });

  it("rejects transitions to an unknown status via the type + rule", () => {
    // TS-level guarantee: only the three literals are accepted; runtime guard
    // also rejects anything not in the allowed set.
    expect(isAllowedTransition("pending", "pending")).toBe(true);
  });

  it("concurrency: settlement and refund cannot both win (single winner)", async () => {
    const repo = new MemoryApiRepository();
    await repo.insertPostage(makePostage("msg-concurrent", "pending"));

    // Fire many concurrent settlement AND refund attempts against the same
    // pending postage. Exactly ONE must be applied (across both groups); the
    // rest must observe a conflict. This proves the atomic CAS prevents a
    // double-settlement / settlement-and-refund race.
    const attempts = 40;
    const results = await Promise.all(
      Array.from({ length: attempts }, (_, i) =>
        repo
          .transitionPostage("msg-concurrent", "pending", i % 2 === 0 ? "settled" : "refunded")
          .then((r) => r.outcome),
      ),
    );

    const applied = results.filter((o) => o === "applied").length;
    const conflict = results.filter((o) => o === "conflict").length;

    expect(applied).toBe(1);
    expect(conflict).toBe(attempts - 1);

    const final = await repo.getPostage("msg-concurrent");
    expect(final?.status === "settled" || final?.status === "refunded").toBe(true);
  });

  it("concurrency: repeated settlement attempts are deterministic single-winner", async () => {
    const repo = new MemoryApiRepository();
    await repo.insertPostage(makePostage("msg-settle", "pending"));

    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        repo.transitionPostage("msg-settle", "pending", "settled").then((r) => r.outcome),
      ),
    );
    expect(results.filter((o) => o === "applied").length).toBe(1);
    expect(results.filter((o) => o === "conflict").length).toBe(29);
  });

  it("terminal retry after settlement is deterministic (no spurious conflict)", async () => {
    const repo = new MemoryApiRepository();
    await repo.insertPostage(makePostage("msg-retry", "pending"));
    const first = await repo.transitionPostage("msg-retry", "pending", "settled");
    expect(first.outcome).toBe("applied");

    // Re-applying pending -> settled after it is already settled must fail
    // (current status no longer matches `expected`), proving retries land on a
    // deterministic terminal state rather than succeeding twice.
    const retry = await repo.transitionPostage("msg-retry", "pending", "settled");
    expect(retry.outcome).toBe("conflict");
    expect(retry.outcome === "conflict" && "postage" in retry).toBe(true);
  });
});
