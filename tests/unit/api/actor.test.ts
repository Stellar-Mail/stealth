import { describe, expect, it } from "vitest";

import { ACTOR_HEADER, requireActor, requireActorMatches } from "../../../src/server/api/actor";
import {
  assertDelegationCanBeIssued,
  type MailboxDelegation,
} from "../../../src/server/api/auth/delegation";

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const resource = `mailbox:${owner}:policy`;
const now = new Date("2026-07-21T12:00:00.000Z");

function delegation(overrides: Partial<MailboxDelegation> = {}): MailboxDelegation {
  return {
    grantor: owner,
    delegate: sender,
    allowedActions: ["policy:update"],
    resourceScope: [resource],
    issuedAt: "2026-07-21T11:00:00.000Z",
    expiresAt: "2026-07-21T13:00:00.000Z",
    revoked: false,
    ...overrides,
  };
}

function delegatedRequest() {
  return new Request("https://stealth.test/api", { headers: { [ACTOR_HEADER]: sender } });
}

describe("API actor guard", () => {
  it("requires a valid actor header", () => {
    expect(() => requireActor(new Request("https://stealth.test/api"))).toThrowError(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("rejects an actor that does not own the resource", () => {
    const request = new Request("https://stealth.test/api", {
      headers: { [ACTOR_HEADER]: sender },
    });

    expect(() => requireActorMatches(request, owner)).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("returns the matching owner", () => {
    const request = new Request("https://stealth.test/api", {
      headers: { [ACTOR_HEADER]: owner },
    });

    expect(requireActorMatches(request, owner)).toBe(owner);
  });

  it("allows a valid delegation within its action, resource, and time window", () => {
    expect(
      requireActorMatches(delegatedRequest(), owner, {
        action: "policy:update",
        resource,
        delegations: [delegation()],
        now,
      }),
    ).toBe(sender);
  });

  it.each([
    ["action", { action: "policy:delete", resource }],
    ["resource", { action: "policy:update", resource: `mailbox:${owner}:other` }],
  ])("rejects an over-scoped %s", (_scope, requestScope) => {
    expect(() =>
      requireActorMatches(delegatedRequest(), owner, {
        ...requestScope,
        delegations: [delegation()],
        now,
      }),
    ).toThrowError(expect.objectContaining({ status: 403 }));
  });

  it("rejects an expired delegation", () => {
    expect(() =>
      requireActorMatches(delegatedRequest(), owner, {
        action: "policy:update",
        resource,
        delegations: [delegation({ expiresAt: "2026-07-21T12:00:00.000Z" })],
        now,
      }),
    ).toThrowError(expect.objectContaining({ status: 403, message: "The delegation has expired" }));
  });

  it("rejects a revoked delegation", () => {
    expect(() =>
      requireActorMatches(delegatedRequest(), owner, {
        action: "policy:update",
        resource,
        delegations: [delegation({ revoked: true })],
        now,
      }),
    ).toThrowError(
      expect.objectContaining({ status: 403, message: "The delegation has been revoked" }),
    );
  });

  it("rejects a delegate attempting to expand its own authority", () => {
    expect(() =>
      assertDelegationCanBeIssued(
        sender,
        delegation({
          grantor: owner,
          allowedActions: ["policy:update", "policy:delete"],
          expiresAt: "2026-07-22T13:00:00.000Z",
        }),
      ),
    ).toThrowError(expect.objectContaining({ status: 403 }));
  });
});
