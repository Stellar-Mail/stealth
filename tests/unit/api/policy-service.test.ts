import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  evaluateMailboxPolicy,
  getMailboxPolicy,
  getSenderRule,
  setMailboxPolicy,
  setSenderRule,
} from "../../../src/server/api/policy-service";

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

describe("mailbox policy service", () => {
  it("returns contract defaults before configuration", async () => {
    const repository = new MemoryApiRepository();

    await expect(getMailboxPolicy(repository, owner)).resolves.toMatchObject({
      policy: {
        allowUnknown: false,
        minimumPostage: "0",
        requireVerified: true,
      },
      source: "default",
    });
  });

  it("persists owner policy", async () => {
    const repository = new MemoryApiRepository();
    const policy = {
      allowUnknown: true,
      minimumPostage: "250",
      requireVerified: false,
    };

    await setMailboxPolicy(repository, owner, policy);

    await expect(getMailboxPolicy(repository, owner)).resolves.toMatchObject({
      policy,
      source: "configured",
    });
  });

  it("sets and clears sender overrides", async () => {
    const repository = new MemoryApiRepository();

    await setSenderRule(repository, owner, sender, "block");
    await expect(getSenderRule(repository, owner, sender)).resolves.toMatchObject({
      rule: "block",
    });

    await setSenderRule(repository, owner, sender, "default");
    await expect(getSenderRule(repository, owner, sender)).resolves.toMatchObject({
      rule: "default",
    });
  });

  it("evaluates explicit rules before mailbox defaults", async () => {
    const repository = new MemoryApiRepository();
    await setSenderRule(repository, owner, sender, "allow");

    await expect(
      evaluateMailboxPolicy(repository, {
        owner,
        postage: "0",
        sender,
        verified: false,
      }),
    ).resolves.toMatchObject({ allowed: true, reason: "sender_allowed" });
  });

  it("enforces verification and minimum postage for unknown senders", async () => {
    const repository = new MemoryApiRepository();
    await setMailboxPolicy(repository, owner, {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: true,
    });

    await expect(
      evaluateMailboxPolicy(repository, {
        owner,
        postage: "99",
        sender,
        verified: true,
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: "insufficient_postage",
    });
  });
});
