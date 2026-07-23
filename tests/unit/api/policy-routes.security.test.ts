import { beforeEach, describe, expect, it } from "vitest";

import { Route as PolicyRoute } from "../../../src/routes/api/v1/policies/$owner";
import { Route as SenderRuleRoute } from "../../../src/routes/api/v1/policies/$owner/senders/$sender";
import { ACTOR_HEADER, DELEGATION_HEADER } from "../../../src/server/api/actor";
import type { MailboxDelegation } from "../../../src/server/api/auth/delegation";
import { getApiContext } from "../../../src/server/api/context";
import type { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { getMailboxPolicy } from "../../../src/server/api/policy-service";

const owner = `G${"A".repeat(55)}`;
const targetSender = `G${"B".repeat(55)}`;
const nonOwner = `G${"C".repeat(55)}`;
const delegate = `G${"D".repeat(55)}`;

const updatePolicyHandler = (PolicyRoute.options as any).server?.handlers?.PUT;
const updateSenderRuleHandler = (SenderRuleRoute.options as any).server?.handlers?.PUT;
const deleteSenderRuleHandler = (SenderRuleRoute.options as any).server?.handlers?.DELETE;

function buildDelegation(overrides: Partial<MailboxDelegation> = {}): MailboxDelegation {
  return {
    grantor: owner,
    delegate,
    allowedActions: ["policy:update"],
    resourceScope: [`mailbox:${owner}:policy`],
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2029-01-01T00:00:00.000Z",
    revoked: false,
    ...overrides,
  };
}

function updatePolicyRequest(actor?: string, delegationHeader?: unknown) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (actor !== undefined) {
    headers[ACTOR_HEADER] = actor;
  }
  if (delegationHeader !== undefined) {
    headers[DELEGATION_HEADER] =
      typeof delegationHeader === "string" ? delegationHeader : JSON.stringify(delegationHeader);
  }

  return new Request(`https://stealth.test/api/v1/policies/${owner}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      allowUnknown: true,
      minimumPostage: "500",
      requireVerified: false,
    }),
  });
}

function updateSenderRuleRequest(actor?: string, delegationHeader?: unknown) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (actor !== undefined) {
    headers[ACTOR_HEADER] = actor;
  }
  if (delegationHeader !== undefined) {
    headers[DELEGATION_HEADER] =
      typeof delegationHeader === "string" ? delegationHeader : JSON.stringify(delegationHeader);
  }

  return new Request(`https://stealth.test/api/v1/policies/${owner}/senders/${targetSender}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ rule: "block" }),
  });
}

function deleteSenderRuleRequest(actor?: string, delegationHeader?: unknown) {
  const headers: Record<string, string> = {};
  if (actor !== undefined) {
    headers[ACTOR_HEADER] = actor;
  }
  if (delegationHeader !== undefined) {
    headers[DELEGATION_HEADER] =
      typeof delegationHeader === "string" ? delegationHeader : JSON.stringify(delegationHeader);
  }

  return new Request(`https://stealth.test/api/v1/policies/${owner}/senders/${targetSender}`, {
    method: "DELETE",
    headers,
  });
}

describe("policy mutation route actor authorization", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  describe("PUT /api/v1/policies/$owner", () => {
    it("allows the owner to update mailbox policy", async () => {
      const response = await updatePolicyHandler({
        request: updatePolicyRequest(owner),
        params: { owner },
      });

      expect(response.status).toBe(200);
      await expect(getMailboxPolicy(repo, owner)).resolves.toMatchObject({
        policy: {
          allowUnknown: true,
          minimumPostage: "500",
          requireVerified: false,
        },
        source: "configured",
      });
    });

    it("rejects non-owner mutation with forbidden error and leaves policy unmodified", async () => {
      const response = await updatePolicyHandler({
        request: updatePolicyRequest(nonOwner),
        params: { owner },
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
      await expect(getMailboxPolicy(repo, owner)).resolves.toMatchObject({
        policy: {
          allowUnknown: false,
          minimumPostage: "0",
          requireVerified: true,
        },
        source: "default",
      });
    });

    it.each([
      ["missing actor header", undefined],
      ["invalid stellar address", "invalid-address"],
    ])(
      "rejects anonymous/invalid principal (%s) with unauthorized error without mutating state",
      async (_label, actor) => {
        const response = await updatePolicyHandler({
          request: updatePolicyRequest(actor),
          params: { owner },
        });

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
        await expect(getMailboxPolicy(repo, owner)).resolves.toMatchObject({ source: "default" });
      },
    );

    it("allows a valid delegated principal to update mailbox policy", async () => {
      const validDelegation = buildDelegation({
        allowedActions: ["policy:update"],
        resourceScope: [`mailbox:${owner}:policy`],
      });

      const response = await updatePolicyHandler({
        request: updatePolicyRequest(delegate, validDelegation),
        params: { owner },
      });

      expect(response.status).toBe(200);
      await expect(getMailboxPolicy(repo, owner)).resolves.toMatchObject({
        policy: {
          allowUnknown: true,
          minimumPostage: "500",
          requireVerified: false,
        },
        source: "configured",
      });
    });

    it.each([
      [
        "wrong action scope",
        buildDelegation({
          allowedActions: ["policy:senders:update"],
          resourceScope: [`mailbox:${owner}:policy`],
        }),
      ],
      [
        "wrong resource scope",
        buildDelegation({
          allowedActions: ["policy:update"],
          resourceScope: [`mailbox:${nonOwner}:policy`],
        }),
      ],
      ["expired delegation", buildDelegation({ expiresAt: "2020-01-01T00:00:00.000Z" })],
      ["revoked delegation", buildDelegation({ revoked: true })],
    ])(
      "rejects invalid/unscoped delegation (%s) with forbidden error without mutating state",
      async (_label, delegationConfig) => {
        const response = await updatePolicyHandler({
          request: updatePolicyRequest(delegate, delegationConfig),
          params: { owner },
        });

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
        await expect(getMailboxPolicy(repo, owner)).resolves.toMatchObject({ source: "default" });
      },
    );
  });

  describe("PUT /api/v1/policies/$owner/senders/$sender", () => {
    it("allows the owner to set sender rules", async () => {
      const response = await updateSenderRuleHandler({
        request: updateSenderRuleRequest(owner),
        params: { owner, sender: targetSender },
      });

      expect(response.status).toBe(200);
      await expect(repo.getSenderRule(owner, targetSender)).resolves.toBe("block");
    });

    it("rejects non-owner sender rule mutation with forbidden error without mutating state", async () => {
      const response = await updateSenderRuleHandler({
        request: updateSenderRuleRequest(nonOwner),
        params: { owner, sender: targetSender },
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
      await expect(repo.getSenderRule(owner, targetSender)).resolves.toBe("default");
    });

    it("rejects anonymous principal with unauthorized error without mutating state", async () => {
      const response = await updateSenderRuleHandler({
        request: updateSenderRuleRequest(undefined),
        params: { owner, sender: targetSender },
      });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
      await expect(repo.getSenderRule(owner, targetSender)).resolves.toBe("default");
    });

    it("allows a valid delegated principal to set sender rules", async () => {
      const validDelegation = buildDelegation({
        allowedActions: ["policy:senders:update"],
        resourceScope: [`mailbox:${owner}:senders:${targetSender}`],
      });

      const response = await updateSenderRuleHandler({
        request: updateSenderRuleRequest(delegate, validDelegation),
        params: { owner, sender: targetSender },
      });

      expect(response.status).toBe(200);
      await expect(repo.getSenderRule(owner, targetSender)).resolves.toBe("block");
    });

    it.each([
      [
        "wrong action scope",
        buildDelegation({
          allowedActions: ["policy:update"],
          resourceScope: [`mailbox:${owner}:senders:${targetSender}`],
        }),
      ],
      [
        "wrong resource scope",
        buildDelegation({
          allowedActions: ["policy:senders:update"],
          resourceScope: [`mailbox:${owner}:senders:${nonOwner}`],
        }),
      ],
      [
        "expired delegation",
        buildDelegation({
          allowedActions: ["policy:senders:update"],
          resourceScope: [`mailbox:${owner}:senders:${targetSender}`],
          expiresAt: "2020-01-01T00:00:00.000Z",
        }),
      ],
      [
        "revoked delegation",
        buildDelegation({
          allowedActions: ["policy:senders:update"],
          resourceScope: [`mailbox:${owner}:senders:${targetSender}`],
          revoked: true,
        }),
      ],
    ])(
      "rejects invalid/unscoped delegation (%s) with forbidden error without mutating state",
      async (_label, delegationConfig) => {
        const response = await updateSenderRuleHandler({
          request: updateSenderRuleRequest(delegate, delegationConfig),
          params: { owner, sender: targetSender },
        });

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
        await expect(repo.getSenderRule(owner, targetSender)).resolves.toBe("default");
      },
    );
  });

  describe("DELETE /api/v1/policies/$owner/senders/$sender", () => {
    beforeEach(async () => {
      // Set rule to "block" initially so we can test clearing it back to "default"
      await repo.setSenderRule(owner, targetSender, "block");
    });

    it("allows the owner to reset a sender rule to default", async () => {
      const response = await deleteSenderRuleHandler({
        request: deleteSenderRuleRequest(owner),
        params: { owner, sender: targetSender },
      });

      expect(response.status).toBe(200);
      await expect(repo.getSenderRule(owner, targetSender)).resolves.toBe("default");
    });

    it("rejects non-owner reset with forbidden error without mutating existing rule", async () => {
      const response = await deleteSenderRuleHandler({
        request: deleteSenderRuleRequest(nonOwner),
        params: { owner, sender: targetSender },
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
      await expect(repo.getSenderRule(owner, targetSender)).resolves.toBe("block");
    });

    it("rejects anonymous principal with unauthorized error without mutating existing rule", async () => {
      const response = await deleteSenderRuleHandler({
        request: deleteSenderRuleRequest(undefined),
        params: { owner, sender: targetSender },
      });

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "unauthorized" } });
      await expect(repo.getSenderRule(owner, targetSender)).resolves.toBe("block");
    });

    it("allows a valid delegated principal to reset a sender rule", async () => {
      const validDelegation = buildDelegation({
        allowedActions: ["policy:senders:delete"],
        resourceScope: [`mailbox:${owner}:senders:${targetSender}`],
      });

      const response = await deleteSenderRuleHandler({
        request: deleteSenderRuleRequest(delegate, validDelegation),
        params: { owner, sender: targetSender },
      });

      expect(response.status).toBe(200);
      await expect(repo.getSenderRule(owner, targetSender)).resolves.toBe("default");
    });

    it.each([
      [
        "wrong action scope",
        buildDelegation({
          allowedActions: ["policy:senders:update"],
          resourceScope: [`mailbox:${owner}:senders:${targetSender}`],
        }),
      ],
      [
        "wrong resource scope",
        buildDelegation({
          allowedActions: ["policy:senders:delete"],
          resourceScope: [`mailbox:${owner}:senders:${nonOwner}`],
        }),
      ],
      [
        "expired delegation",
        buildDelegation({
          allowedActions: ["policy:senders:delete"],
          resourceScope: [`mailbox:${owner}:senders:${targetSender}`],
          expiresAt: "2020-01-01T00:00:00.000Z",
        }),
      ],
      [
        "revoked delegation",
        buildDelegation({
          allowedActions: ["policy:senders:delete"],
          resourceScope: [`mailbox:${owner}:senders:${targetSender}`],
          revoked: true,
        }),
      ],
    ])(
      "rejects invalid/unscoped delegation (%s) with forbidden error without mutating state",
      async (_label, delegationConfig) => {
        const response = await deleteSenderRuleHandler({
          request: deleteSenderRuleRequest(delegate, delegationConfig),
          params: { owner, sender: targetSender },
        });

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
        await expect(repo.getSenderRule(owner, targetSender)).resolves.toBe("block");
      },
    );
  });
});
