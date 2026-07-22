import { beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "../../../src/server/api/errors";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import type { Postage } from "../../../src/server/api/domain";

// Issue #1502: repository-level uniqueness for message identifiers, mapped to a
// stable, deterministic conflict error.
const messageId = "a".repeat(64);
const paymentHash = "b".repeat(64);
const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

function postage(overrides: Partial<Postage> = {}): Postage {
  return {
    amount: "100",
    createdAt: "2026-01-01T00:00:00.000Z",
    messageId,
    paymentHash,
    recipient: owner,
    sender,
    status: "pending",
    ...overrides,
  };
}

describe("message identifier uniqueness", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("inserts a new postage record", async () => {
    await expect(repo.insertPostage(postage())).resolves.toMatchObject({ messageId });
  });

  it("rejects a duplicate messageId with a deterministic conflict", async () => {
    await repo.insertPostage(postage());
    await expect(repo.insertPostage(postage({ amount: "200" }))).rejects.toBeInstanceOf(ApiError);
    await expect(repo.insertPostage(postage({ amount: "200" }))).rejects.toMatchObject({
      status: 409,
      code: "conflict",
    });
  });

  it("does not create a second record on conflict", async () => {
    await repo.insertPostage(postage({ amount: "100" }));
    await expect(repo.insertPostage(postage({ amount: "999" }))).rejects.toBeInstanceOf(ApiError);
    // The original record is unchanged — no ambiguous state.
    await expect(repo.getPostage(messageId)).resolves.toMatchObject({ amount: "100" });
  });

  it("yields exactly one winner under concurrent inserts", async () => {
    const attempts = Array.from({ length: 10 }, (_, index) =>
      repo.insertPostage(postage({ amount: String(100 + index) })).then(
        () => "ok" as const,
        () => "conflict" as const,
      ),
    );
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.filter((r) => r === "conflict")).toHaveLength(9);
  });
});
