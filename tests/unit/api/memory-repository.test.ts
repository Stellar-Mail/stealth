import { beforeEach, describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

describe("MemoryApiRepository", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    repository = new MemoryApiRepository();
  });

  it("persists mailbox policy and sender rules", async () => {
    await repository.setPolicy(owner, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    });
    await repository.setSenderRule(owner, sender, "allow");

    await expect(repository.getPolicy(owner)).resolves.toMatchObject({
      minimumPostage: "100",
    });
    await expect(repository.getSenderRule(owner, sender)).resolves.toBe("allow");
  });

  it("removes explicit rules when reset to default", async () => {
    await repository.setSenderRule(owner, sender, "block");
    await repository.setSenderRule(owner, sender, "default");

    await expect(repository.getSenderRule(owner, sender)).resolves.toBe("default");
  });
});
