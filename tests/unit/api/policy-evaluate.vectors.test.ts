import { beforeEach, describe, expect, it } from "vitest";

import { Route as EvaluateRoute } from "../../../src/routes/api/v1/policies/evaluate";
import { ACTOR_HEADER, DELEGATION_HEADER } from "../../../src/server/api/actor";
import type { MailboxDelegation } from "../../../src/server/api/auth/delegation";
import { getApiContext } from "../../../src/server/api/context";
import type { MailboxPolicy, SenderRule } from "../../../src/server/api/domain";
import type { MemoryApiRepository } from "../../../src/server/api/memory-repository";

const evaluateHandler = (EvaluateRoute.options as any).server?.handlers?.POST;

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const delegate = `G${"D".repeat(55)}`;

function createEvaluateRequest(
  body: unknown,
  options?: {
    actor?: string;
    delegation?: MailboxDelegation;
    requestId?: string;
    traceparent?: string;
  },
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (options?.actor) {
    headers[ACTOR_HEADER] = options.actor;
  }
  if (options?.delegation) {
    headers[DELEGATION_HEADER] = JSON.stringify(options.delegation);
  }
  if (options?.requestId) {
    headers["x-request-id"] = options.requestId;
  }
  if (options?.traceparent) {
    headers["traceparent"] = options.traceparent;
  }

  return new Request("https://stealth.test/api/v1/policies/evaluate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

interface RouteVectorFixture {
  name: string;
  policy: MailboxPolicy | null;
  senderRule: SenderRule | null;
  input: {
    owner?: string;
    postage?: unknown;
    sender?: string;
    verified?: unknown;
  };
  headers?: {
    actor?: string;
    delegation?: MailboxDelegation;
    requestId?: string;
    traceparent?: string;
  };
  expectedStatus: number;
  expectedDecision?: {
    allowed: boolean;
    reasonCode: string;
    message: string;
    source: "configured" | "default";
    rule: SenderRule;
  };
  expectedError?: {
    code: string;
  };
}

const basePolicy: MailboxPolicy = {
  allowUnknown: false,
  minimumPostage: "0",
  requireVerified: true,
};

const routeVectors: RouteVectorFixture[] = [
  {
    name: "trusted sender (allow rule) explicitly allowed",
    policy: basePolicy,
    senderRule: "allow",
    input: { owner, postage: "0", sender, verified: false },
    expectedStatus: 200,
    expectedDecision: {
      allowed: true,
      reasonCode: "sender_allowed",
      message: "Sender is explicitly allowed by the recipient.",
      source: "configured",
      rule: "allow",
    },
  },
  {
    name: "blocked sender (block rule) explicitly blocked",
    policy: basePolicy,
    senderRule: "block",
    input: { owner, postage: "0", sender, verified: false },
    expectedStatus: 200,
    expectedDecision: {
      allowed: false,
      reasonCode: "sender_blocked",
      message: "Sender is explicitly blocked by the recipient.",
      source: "configured",
      rule: "block",
    },
  },
  {
    name: "unknown sender rejected when recipient policy disables unknown senders",
    policy: { ...basePolicy, allowUnknown: false },
    senderRule: null,
    input: { owner, postage: "0", sender, verified: false },
    expectedStatus: 200,
    expectedDecision: {
      allowed: false,
      reasonCode: "unknown_senders_disabled",
      message: "Recipient does not accept mail from unknown senders.",
      source: "configured",
      rule: "default",
    },
  },
  {
    name: "verification required when sender is unverified",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: true },
    senderRule: null,
    input: { owner, postage: "1000", sender, verified: false },
    expectedStatus: 200,
    expectedDecision: {
      allowed: false,
      reasonCode: "verification_required",
      message: "Recipient requires sender verification.",
      source: "configured",
      rule: "default",
    },
  },
  {
    name: "insufficient postage when provided amount is lower than policy minimum",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: false, minimumPostage: "5000" },
    senderRule: null,
    input: { owner, postage: "100", sender, verified: true },
    expectedStatus: 200,
    expectedDecision: {
      allowed: false,
      reasonCode: "insufficient_postage",
      message: "Provided postage is insufficient for this recipient.",
      source: "configured",
      rule: "default",
    },
  },
  {
    name: "policy satisfied when all criteria (verification, postage) are met",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: true, minimumPostage: "500" },
    senderRule: null,
    input: { owner, postage: "1000", sender, verified: true },
    expectedStatus: 200,
    expectedDecision: {
      allowed: true,
      reasonCode: "policy_satisfied",
      message: "Sender satisfies all recipient mailbox policies.",
      source: "configured",
      rule: "default",
    },
  },
  {
    name: "missing policy defaults to defaultMailboxPolicy (blocks unknown unverified senders)",
    policy: null,
    senderRule: null,
    input: { owner, postage: "0", sender, verified: false },
    expectedStatus: 200,
    expectedDecision: {
      allowed: false,
      reasonCode: "unknown_senders_disabled",
      message: "Recipient does not accept mail from unknown senders.",
      source: "default",
      rule: "default",
    },
  },
  {
    name: "missing policy allows verified sender when allowed by explicit sender rule",
    policy: null,
    senderRule: "allow",
    input: { owner, postage: "0", sender, verified: true },
    expectedStatus: 200,
    expectedDecision: {
      allowed: true,
      reasonCode: "sender_allowed",
      message: "Sender is explicitly allowed by the recipient.",
      source: "default",
      rule: "allow",
    },
  },
  {
    name: "evaluates policy for delegated actor with valid delegation header",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: false, minimumPostage: "0" },
    senderRule: null,
    input: { owner, postage: "100", sender: delegate, verified: true },
    headers: {
      actor: delegate,
      delegation: {
        grantor: owner,
        delegate,
        allowedActions: ["policy:evaluate"],
        resourceScope: [`mailbox:${owner}:policy`],
        issuedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2029-01-01T00:00:00.000Z",
        revoked: false,
      },
    },
    expectedStatus: 200,
    expectedDecision: {
      allowed: true,
      reasonCode: "policy_satisfied",
      message: "Sender satisfies all recipient mailbox policies.",
      source: "configured",
      rule: "default",
    },
  },
  {
    name: "boundary test: zero postage meeting zero minimum postage policy",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: false, minimumPostage: "0" },
    senderRule: null,
    input: { owner, postage: "0", sender, verified: true },
    expectedStatus: 200,
    expectedDecision: {
      allowed: true,
      reasonCode: "policy_satisfied",
      message: "Sender satisfies all recipient mailbox policies.",
      source: "configured",
      rule: "default",
    },
  },
  {
    name: "boundary test: max i128 postage string passes evaluation",
    policy: { ...basePolicy, allowUnknown: true, requireVerified: false, minimumPostage: "1000" },
    senderRule: null,
    input: { owner, postage: "170141183460469231731687303715884105727", sender, verified: true },
    expectedStatus: 200,
    expectedDecision: {
      allowed: true,
      reasonCode: "policy_satisfied",
      message: "Sender satisfies all recipient mailbox policies.",
      source: "configured",
      rule: "default",
    },
  },
];

describe("POST /api/v1/policies/evaluate vector suite", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  describe("table-driven decision branch vectors", () => {
    for (const vector of routeVectors) {
      it(`evaluates branch vector: ${vector.name}`, async () => {
        if (vector.policy !== null) {
          await repo.setPolicy(owner, vector.policy);
        }
        if (vector.senderRule !== null) {
          await repo.setSenderRule(owner, vector.input.sender!, vector.senderRule);
        }

        const request = createEvaluateRequest(vector.input, vector.headers);
        const response = await evaluateHandler({ request });

        expect(response.status).toBe(vector.expectedStatus);

        const body = await response.json();

        if (vector.expectedDecision) {
          // Failure diagnostic helper
          if (
            body.data?.allowed !== vector.expectedDecision.allowed ||
            body.data?.reasonCode !== vector.expectedDecision.reasonCode
          ) {
            throw new Error(
              `Decision mismatch for branch vector '${vector.name}':\n` +
                `  Expected: allowed=${vector.expectedDecision.allowed}, reasonCode='${vector.expectedDecision.reasonCode}', source='${vector.expectedDecision.source}', rule='${vector.expectedDecision.rule}'\n` +
                `  Received: allowed=${body.data?.allowed}, reasonCode='${body.data?.reasonCode}', source='${body.data?.source}', rule='${body.data?.rule}'`,
            );
          }

          expect(body.data).toEqual(vector.expectedDecision);
        }
      });
    }
  });

  describe("input validation edge cases", () => {
    it.each([
      [
        "invalid owner address",
        { owner: "INVALID_ADDR", postage: "100", sender, verified: true },
        422,
      ],
      [
        "invalid sender address",
        { owner, postage: "100", sender: "INVALID_SENDER", verified: true },
        422,
      ],
      ["negative postage string", { owner, postage: "-100", sender, verified: true }, 422],
      ["non-integer postage string", { owner, postage: "123.45", sender, verified: true }, 422],
      ["missing verified boolean field", { owner, postage: "100", sender }, 422],
    ])(
      "rejects malformed payload '%s' with HTTP %i",
      async (_label, invalidBody, expectedStatus) => {
        const request = createEvaluateRequest(invalidBody);
        const response = await evaluateHandler({ request });

        expect(response.status).toBe(expectedStatus);
        const body = await response.json();
        expect(body.error?.code).toBe("validation_error");
      },
    );
  });

  describe("request correlation & tracing propagation", () => {
    it("preserves trace parent and request id headers during evaluation", async () => {
      const traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
      const requestId = "req-test-eval-123";

      const request = createEvaluateRequest(
        { owner, postage: "0", sender, verified: true },
        { requestId, traceparent },
      );

      const response = await evaluateHandler({ request });
      expect(response.status).toBe(200);
    });
  });
});
