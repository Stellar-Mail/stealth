import { beforeEach, describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  checkUsernameAvailability,
  reserveUsername,
} from "../../../src/server/api/identity-service";
import { ApiError } from "../../../src/server/api/errors";

const owner = `G${"A".repeat(55)}`;
const otherOwner = `G${"B".repeat(55)}`;

describe("checkUsernameAvailability", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    repository = new MemoryApiRepository();
  });

  it("reports an unreserved, well-formed username as available", async () => {
    await expect(checkUsernameAvailability(repository, "Alice")).resolves.toEqual({
      username: "alice",
      available: true,
    });
  });

  it("reports a reserved username as unavailable once claimed", async () => {
    await reserveUsername(repository, { rawUsername: "alice", ownerAddress: owner });
    await expect(checkUsernameAvailability(repository, "alice")).resolves.toEqual({
      username: "alice",
      available: false,
    });
  });

  it("treats case and confusable variants as the same username for availability", async () => {
    await reserveUsername(repository, { rawUsername: "alice", ownerAddress: owner });
    await expect(checkUsernameAvailability(repository, "ALICE")).resolves.toEqual({
      username: "alice",
      available: false,
    });
    await expect(checkUsernameAvailability(repository, "  Alice  ")).resolves.toEqual({
      username: "alice",
      available: false,
    });
  });

  it("throws a validation error for a reserved word, without ever consulting the repository", async () => {
    await expect(checkUsernameAvailability(repository, "admin")).rejects.toThrow();
    // Confirm no reservation-shaped side effect occurred.
    await expect(repository.getUsernameRecord("admin")).resolves.toBeNull();
  });

  it("throws a validation error for a boundary-violating length", async () => {
    await expect(checkUsernameAvailability(repository, "ab")).rejects.toThrow();
    await expect(checkUsernameAvailability(repository, "a".repeat(31))).rejects.toThrow();
  });

  it("throws a validation error for a disallowed character", async () => {
    await expect(checkUsernameAvailability(repository, "alice smith")).rejects.toThrow();
  });
});

describe("reserveUsername", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    repository = new MemoryApiRepository();
  });

  it("reserves a well-formed username and returns the full record", async () => {
    const record = await reserveUsername(repository, {
      rawUsername: "Alice",
      ownerAddress: owner,
    });

    expect(record).toMatchObject({
      username: "alice",
      ownerAddress: owner,
      stealthAddress: "alice@stealth.me",
      federationAddress: "alice*stealth.me",
    });
    expect(typeof record.createdAt).toBe("string");
    expect(() => new Date(record.createdAt).toISOString()).not.toThrow();
  });

  it("persists the reservation so a later lookup reflects it", async () => {
    await reserveUsername(repository, { rawUsername: "alice", ownerAddress: owner });
    await expect(repository.getUsernameRecord("alice")).resolves.toMatchObject({
      username: "alice",
      ownerAddress: owner,
    });
  });

  it("rejects a second reservation of the same username with username_taken (409)", async () => {
    await reserveUsername(repository, { rawUsername: "alice", ownerAddress: owner });

    await expect(
      reserveUsername(repository, { rawUsername: "alice", ownerAddress: otherOwner }),
    ).rejects.toMatchObject({ code: "username_taken", status: 409 });

    // The original owner is untouched by the losing attempt.
    await expect(repository.getUsernameRecord("alice")).resolves.toMatchObject({
      ownerAddress: owner,
    });
  });

  it("rejects a case/confusable variant of an already-reserved username", async () => {
    await reserveUsername(repository, { rawUsername: "alice", ownerAddress: owner });

    await expect(
      reserveUsername(repository, { rawUsername: "ALICE", ownerAddress: otherOwner }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      reserveUsername(repository, { rawUsername: "  alice  ", ownerAddress: otherOwner }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects reserved-word and malformed input before persisting anything", async () => {
    await expect(
      reserveUsername(repository, { rawUsername: "admin", ownerAddress: owner }),
    ).rejects.toThrow();
    await expect(repository.getUsernameRecord("admin")).resolves.toBeNull();

    await expect(
      reserveUsername(repository, { rawUsername: "ab", ownerAddress: owner }),
    ).rejects.toThrow();
  });

  it("allows exactly one winner out of many concurrent reservation attempts for the same username", async () => {
    const attempts = Array.from({ length: 8 }, (_, index) =>
      reserveUsername(repository, {
        rawUsername: "alice",
        ownerAddress: `G${String(index).repeat(55)}`.slice(0, 56),
      }).then(
        (record) => ({ status: "fulfilled" as const, record }),
        (error) => ({ status: "rejected" as const, error }),
      ),
    );

    const results = await Promise.all(attempts);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(7);
    for (const result of rejected) {
      expect((result as { error: unknown }).error).toMatchObject({ code: "username_taken" });
    }

    const finalRecord = await repository.getUsernameRecord("alice");
    expect(finalRecord?.ownerAddress).toBe(
      (fulfilled[0] as { record: { ownerAddress: string } }).record.ownerAddress,
    );
  });

  it("does not let reserving distinct usernames interfere with each other", async () => {
    const [alice, bob] = await Promise.all([
      reserveUsername(repository, { rawUsername: "alice", ownerAddress: owner }),
      reserveUsername(repository, { rawUsername: "bob", ownerAddress: otherOwner }),
    ]);

    expect(alice.username).toBe("alice");
    expect(bob.username).toBe("bob");
    await expect(repository.getUsernameRecord("alice")).resolves.toMatchObject({
      ownerAddress: owner,
    });
    await expect(repository.getUsernameRecord("bob")).resolves.toMatchObject({
      ownerAddress: otherOwner,
    });
  });
});
