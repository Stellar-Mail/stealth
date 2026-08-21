import { describe, expect, it } from "vitest";

import {
  cancelAccountDeletion,
  exportAccountData,
  processAccountDeletion,
  requestAccountDeletion,
} from "../../../src/server/api/account-data-service";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import type { User } from "../../../src/server/api/domain";
import { ApiError } from "../../../src/server/api/errors";

const aliceAddress = `G${"A".repeat(55)}`;
const bobAddress = `G${"B".repeat(55)}`;
const now = new Date("2026-08-20T00:00:00.000Z");

function user(userId: string, address: string, username: string): User {
  return {
    userId,
    address,
    email: `${username}@example.com`,
    username,
    status: "active",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    version: 1,
  };
}

describe("BETA-080 account data controls", () => {
  it("exports only the authenticated owner data and explicit chain limits", async () => {
    const repository = new MemoryApiRepository();
    await repository.createUser(user("alice", aliceAddress, "alice"));
    await repository.createUser(user("bob", bobAddress, "bob"));

    const exported = await exportAccountData(repository, aliceAddress, now);
    expect(exported.account.userId).toBe("alice");
    expect(exported.account.userId).not.toBe("bob");
    expect(exported.onChainLimitations.join(" ")).toContain("immutable");
    expect(exported).not.toHaveProperty("credential");
  });

  it("denies a deletion request for another address", async () => {
    const repository = new MemoryApiRepository();
    await repository.createUser(user("alice", aliceAddress, "alice"));
    await expect(requestAccountDeletion(repository, bobAddress, { now })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("supports cancellation during cooling off and blocks premature processing", async () => {
    const repository = new MemoryApiRepository();
    await repository.createUser(user("alice", aliceAddress, "alice"));
    const request = await requestAccountDeletion(repository, aliceAddress, {
      now,
      coolingOffMs: 60_000,
    });
    expect(request.status).toBe("cooling_off");
    await expect(processAccountDeletion(repository, "alice", { now })).rejects.toMatchObject({
      status: 409,
    });
    const cancelled = await cancelAccountDeletion(repository, aliceAddress, now);
    expect(cancelled.status).toBe("cancelled");
    await expect(cancelAccountDeletion(repository, aliceAddress, now)).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("retries a request after the cooling-off clock and leaves a deactivated tombstone", async () => {
    const repository = new MemoryApiRepository();
    await repository.createUser(user("alice", aliceAddress, "alice"));
    await requestAccountDeletion(repository, aliceAddress, { now, coolingOffMs: 1 });
    const completed = await processAccountDeletion(repository, "alice", {
      now: new Date(now.getTime() + 2),
    });
    expect(completed.status).toBe("completed");
    expect((await repository.getUserById("alice"))?.status).toBe("deactivated");
    expect(await repository.getAccountDeletionRequest("alice")).toMatchObject({
      status: "completed",
      attempt: 1,
    });
  });
});
