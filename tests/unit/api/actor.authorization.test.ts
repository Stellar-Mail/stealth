import { describe, expect, it } from "vitest";

import {
  AUTHORIZATION_FORBIDDEN_CODE,
  authorizeResourceOwner,
  evaluateResourceAuthorization,
} from "../../../src/server/api/actor";
import type { ApiPrincipal } from "../../../src/server/api/context";
import type { MailboxDelegation } from "../../../src/server/api/auth/delegation";

const owner = `G${"A".repeat(55)}`;
const delegate = `G${"B".repeat(55)}`;
const stranger = `G${"C".repeat(55)}`;
const resourceId = `mailbox:${owner}:policy`;
const now = new Date("2026-07-21T12:00:00.000Z");

function principal(address: string, overrides: Partial<ApiPrincipal> = {}): ApiPrincipal {
  return {
    address,
    authMethod: "header",
    authenticatedAt: now,
    metadata: {},
    ...overrides,
  };
}

function delegation(overrides: Partial<MailboxDelegation> = {}): MailboxDelegation {
  return {
    grantor: owner,
    delegate,
    allowedActions: ["policy:update"],
    resourceScope: [resourceId],
    issuedAt: "2026-07-21T11:00:00.000Z",
    expiresAt: "2026-07-21T13:00:00.000Z",
    revoked: false,
    ...overrides,
  };
}

describe("authorization policy helpers (#1467)", () => {
  it("allows the resource owner and emits an owner audit record", () => {
    const result = authorizeResourceOwner({
      principal: principal(owner),
      resourceOwner: owner,
      action: "policy:update",
      resource: { type: "mailbox_policy", id: resourceId },
    });

    expect(result.authorized).toBe(true);
    expect(result.actor).toBe(owner);
    expect(result.audit).toMatchObject({
      decision: "allow",
      reason: "owner",
      action: "policy:update",
      actor: owner,
      resourceOwner: owner,
      authMethod: "header",
      resource: { type: "mailbox_policy", id: resourceId },
    });
  });

  it("rejects a non-owner with a stable forbidden code and deny audit", () => {
    let thrown: unknown;
    try {
      authorizeResourceOwner({
        principal: principal(stranger),
        resourceOwner: owner,
        action: "policy:update",
        resource: { type: "mailbox_policy" },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      status: 403,
      code: AUTHORIZATION_FORBIDDEN_CODE,
    });
    // Audit metadata is attached to the error details.
    expect((thrown as { details: { audit: unknown } }).details.audit).toMatchObject({
      decision: "deny",
      reason: "not_owner",
      actor: stranger,
      resourceOwner: owner,
    });
  });

  it("allows a valid delegate and records a delegated reason", () => {
    const result = authorizeResourceOwner({
      principal: principal(delegate),
      resourceOwner: owner,
      action: "policy:update",
      resource: { type: "mailbox_policy" },
      delegation: {
        action: "policy:update",
        resource: resourceId,
        delegations: [delegation()],
        now,
      },
    });

    expect(result.authorized).toBe(true);
    expect(result.actor).toBe(delegate);
    expect(result.audit.reason).toBe("delegated");
    expect(result.audit.decision).toBe("allow");
  });

  it("denies a delegate whose delegation is out of scope", () => {
    const result = evaluateResourceAuthorization({
      principal: principal(delegate),
      resourceOwner: owner,
      action: "policy:delete",
      delegation: {
        action: "policy:delete",
        resource: resourceId,
        delegations: [delegation()],
        now,
      },
    });

    expect(result.authorized).toBe(false);
    expect(result.audit).toMatchObject({ decision: "deny", reason: "not_owner" });
  });

  it("denies an expired delegation without throwing in evaluate mode", () => {
    const result = evaluateResourceAuthorization({
      principal: principal(delegate),
      resourceOwner: owner,
      action: "policy:update",
      delegation: {
        action: "policy:update",
        resource: resourceId,
        delegations: [delegation({ expiresAt: "2026-07-21T11:30:00.000Z" })],
        now,
      },
    });

    expect(result.authorized).toBe(false);
    expect(result.audit.reason).toBe("not_owner");
  });

  it("treats an anonymous-style empty principal address as a non-owner denial", () => {
    const result = evaluateResourceAuthorization({
      principal: principal("", { authMethod: "anonymous" }),
      resourceOwner: owner,
      action: "policy:update",
    });

    expect(result.authorized).toBe(false);
    expect(result.audit).toMatchObject({
      decision: "deny",
      reason: "not_owner",
      authMethod: "anonymous",
      actor: "",
    });
  });

  it("does not leak sensitive fields into the audit record", () => {
    const result = authorizeResourceOwner({
      principal: principal(owner, { metadata: { secretToken: "do-not-log" } }),
      resourceOwner: owner,
      action: "policy:update",
      resource: { type: "mailbox_policy" },
    });

    const serialized = JSON.stringify(result.audit);
    expect(serialized).not.toContain("do-not-log");
    expect(serialized).not.toContain("secretToken");
  });
});
