import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  assertActorAuthorized,
  assertDelegationCanBeIssued,
  type MailboxDelegation,
} from "../../../src/server/api/auth/delegation";
import { distinctAddressPairArbitrary, instantMsArbitrary } from "./arbitraries";

const NUM_RUNS = 150;
const ACTIONS = ["read", "write", "delete", "settle", "refund"];
const RESOURCES = ["mailbox", "postage", "receipt", "policy"];

describe("assertActorAuthorized (property)", () => {
  it("the resource owner is always authorized, with or without a delegation", () => {
    fc.assert(
      fc.property(distinctAddressPairArbitrary, ([owner]) => {
        expect(assertActorAuthorized(owner, owner)).toBe(owner);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("a bare actor with no delegation is never authorized to act as a different owner", () => {
    fc.assert(
      fc.property(distinctAddressPairArbitrary, ([owner, actor]) => {
        expect(() => assertActorAuthorized(actor, owner)).toThrowError(
          expect.objectContaining({ status: 403 }),
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("matches the exact revoked/expiry/scope decision table for a single delegation", () => {
    const scenarioArbitrary = distinctAddressPairArbitrary.chain(([owner, delegate]) =>
      fc.record({
        owner: fc.constant(owner),
        delegate: fc.constant(delegate),
        allowedActions: fc.uniqueArray(fc.constantFrom(...ACTIONS), {
          minLength: 1,
          maxLength: ACTIONS.length,
        }),
        resourceScope: fc.uniqueArray(fc.constantFrom(...RESOURCES), {
          minLength: 1,
          maxLength: RESOURCES.length,
        }),
        issuedAtMs: instantMsArbitrary,
        expiresAtMs: instantMsArbitrary,
        revoked: fc.boolean(),
        action: fc.constantFrom(...ACTIONS),
        resource: fc.constantFrom(...RESOURCES),
        nowMs: instantMsArbitrary,
      }),
    );

    fc.assert(
      fc.property(
        scenarioArbitrary,
        ({
          owner,
          delegate,
          allowedActions,
          resourceScope,
          issuedAtMs,
          expiresAtMs,
          revoked,
          action,
          resource,
          nowMs,
        }) => {
          const delegation: MailboxDelegation = {
            grantor: owner,
            delegate,
            allowedActions,
            resourceScope,
            issuedAt: new Date(issuedAtMs).toISOString(),
            expiresAt: new Date(expiresAtMs).toISOString(),
            revoked,
          };

          const expectedAuthorized =
            !revoked &&
            nowMs >= issuedAtMs &&
            nowMs < expiresAtMs &&
            allowedActions.includes(action) &&
            resourceScope.includes(resource);

          const authorization = {
            action,
            resource,
            delegations: [delegation],
            now: new Date(nowMs),
          };

          if (expectedAuthorized) {
            expect(assertActorAuthorized(delegate, owner, authorization)).toBe(delegate);
          } else {
            expect(() => assertActorAuthorized(delegate, owner, authorization)).toThrowError(
              expect.objectContaining({ status: 403 }),
            );
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("assertDelegationCanBeIssued (property)", () => {
  it("matches the exact grantor/expiry/non-empty-scope decision table", () => {
    fc.assert(
      fc.property(
        distinctAddressPairArbitrary,
        fc.boolean(),
        instantMsArbitrary,
        instantMsArbitrary,
        fc.array(fc.constantFrom(...ACTIONS), { maxLength: ACTIONS.length }),
        fc.array(fc.constantFrom(...RESOURCES), {
          maxLength: RESOURCES.length,
        }),
        (
          [grantor, other],
          actorIsGrantor,
          issuedAtMs,
          expiresAtMs,
          allowedActions,
          resourceScope,
        ) => {
          const actor = actorIsGrantor ? grantor : other;
          const delegation: MailboxDelegation = {
            grantor,
            delegate: other,
            allowedActions,
            resourceScope,
            issuedAt: new Date(issuedAtMs).toISOString(),
            expiresAt: new Date(expiresAtMs).toISOString(),
            revoked: false,
          };

          const expectedOk =
            actor === grantor &&
            expiresAtMs > issuedAtMs &&
            allowedActions.length > 0 &&
            resourceScope.length > 0;

          if (expectedOk) {
            expect(assertDelegationCanBeIssued(actor, delegation)).toBe(delegation);
          } else {
            expect(() => assertDelegationCanBeIssued(actor, delegation)).toThrowError(
              expect.objectContaining({ status: 403 }),
            );
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
