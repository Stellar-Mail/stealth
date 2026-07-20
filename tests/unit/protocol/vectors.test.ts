/**
 * Canonical interoperability vector tests — TypeScript implementation.
 *
 * Reads protocol/vectors/vectors.json and drives every case through the
 * live TypeScript services and Zod schemas so that CI gates divergence
 * between the fixture and the implementation.
 *
 * Space/time: O(n) over the number of vector cases — each case is exercised
 * exactly once with an isolated MemoryApiRepository, so no shared state leaks.
 */
import { describe, expect, it } from "vitest";

import {
  stellarAddressSchema,
  hash32Schema,
  stroopAmountSchema,
} from "../../../src/server/api/domain";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  evaluateMailboxPolicy,
  setMailboxPolicy,
  setSenderRule,
} from "../../../src/server/api/policy-service";
import { submitPostage, resolvePostage } from "../../../src/server/api/postage-service";
import { createDeliveryReceipt, markReceiptRead } from "../../../src/server/api/receipt-service";
import { ApiError } from "../../../src/server/api/errors";
import type { MailboxPolicy, SenderRule } from "../../../src/server/api/domain";

import vectors from "../../../protocol/vectors/vectors.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertApiError(err: unknown, expected: { code: string; status: number; message: string }) {
  expect(err).toBeInstanceOf(ApiError);
  const apiErr = err as ApiError;
  expect(apiErr.code, "error code").toBe(expected.code);
  expect(apiErr.status, "http status").toBe(expected.status);
  expect(apiErr.message, "error message").toBe(expected.message);
}

// ---------------------------------------------------------------------------
// Primitive: Stellar address
// ---------------------------------------------------------------------------

describe("primitives/address", () => {
  for (const c of vectors.categories.primitives.address.cases) {
    it(c.id, () => {
      const result = stellarAddressSchema.safeParse(c.input);
      expect(result.success, c.description).toBe(c.expected.valid);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(c.expected.error);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Primitive: 32-byte hash
// ---------------------------------------------------------------------------

describe("primitives/hash", () => {
  for (const c of vectors.categories.primitives.hash.cases) {
    it(c.id, () => {
      const result = hash32Schema.safeParse(c.input);
      expect(result.success, c.description).toBe(c.expected.valid);
      if (result.success && "normalized" in c.expected) {
        // Verify the normalised (lowercased) output matches the vector
        expect(result.data).toBe(c.expected.normalized);
      }
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(c.expected.error);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Primitive: Stroop amount (Soroban i128)
// ---------------------------------------------------------------------------

describe("primitives/amount", () => {
  for (const c of vectors.categories.primitives.amount.cases) {
    it(c.id, () => {
      const result = stroopAmountSchema.safeParse(c.input);
      expect(result.success, c.description).toBe(c.expected.valid);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(c.expected.error);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Policy decisions
// ---------------------------------------------------------------------------

describe("policy_decisions", () => {
  const { owner, sender } = vectors.categories.policy_decisions;

  for (const c of vectors.categories.policy_decisions.cases) {
    it(c.id, async () => {
      const repo = new MemoryApiRepository();

      // Apply the optional sender rule
      const rule = c.setup.senderRule as SenderRule;
      if (rule === "allow" || rule === "block") {
        await setSenderRule(repo, owner, sender, rule);
      }

      // Apply the optional mailbox policy
      if (c.setup.policy) {
        const p = c.setup.policy as MailboxPolicy;
        await setMailboxPolicy(repo, owner, p);
      }

      const result = await evaluateMailboxPolicy(repo, {
        owner,
        sender,
        postage: c.input.postage,
        verified: c.input.verified,
      });

      expect(result.allowed, `${c.id}: allowed`).toBe(c.expected.allowed);
      expect(result.reason, `${c.id}: reason`).toBe(c.expected.reason);
    });
  }
});

// ---------------------------------------------------------------------------
// Postage states
// ---------------------------------------------------------------------------

describe("postage_states", () => {
  for (const c of vectors.categories.postage_states.cases) {
    it(c.id, async () => {
      const repo = new MemoryApiRepository();
      const f = c.fixture;

      // Apply preconditions (sender rules, mailbox policy)
      for (const pre of (
        c as { preconditions?: Array<{ op: string; rule?: string; policy?: MailboxPolicy }> }
      ).preconditions ?? []) {
        if (pre.op === "setSenderRule" && pre.rule) {
          await setSenderRule(repo, f.recipient, f.sender, pre.rule as SenderRule);
        }
        if (pre.op === "setPolicy" && pre.policy) {
          await setMailboxPolicy(repo, f.recipient, pre.policy as MailboxPolicy);
        }
      }

      const postageInput = {
        messageId: f.messageId,
        sender: f.sender,
        recipient: f.recipient,
        amount: f.amount,
        paymentHash: f.paymentHash,
      };

      const submitAt = new Date(f.submitAt);
      let lastResult: Awaited<ReturnType<typeof submitPostage>> | undefined;
      let caughtError: unknown;

      for (const op of c.operations) {
        try {
          if (op === "submit") {
            lastResult = await submitPostage(repo, postageInput, submitAt);
          } else if (op === "settle") {
            lastResult = await resolvePostage(repo, f.messageId, "settled");
          } else if (op === "refund") {
            lastResult = await resolvePostage(repo, f.messageId, "refunded");
          }
        } catch (err) {
          caughtError = err;
          break;
        }
      }

      const exp = c.expected as {
        status?: string;
        createdAt?: string;
        error?: { code: string; status: number; message: string };
      };

      if (exp.error) {
        assertApiError(caughtError, exp.error);
      } else {
        expect(caughtError, `${c.id}: unexpected error`).toBeUndefined();
        expect(lastResult?.status, `${c.id}: status`).toBe(exp.status);
        if (exp.createdAt) {
          expect(lastResult?.createdAt, `${c.id}: createdAt`).toBe(exp.createdAt);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

describe("receipts", () => {
  for (const c of vectors.categories.receipts.cases) {
    it(c.id, async () => {
      const repo = new MemoryApiRepository();
      const f = c.fixture as {
        sender: string;
        recipient: string;
        messageId: string;
        deliverAt: string;
        readAt?: string;
      };

      const receiptInput = {
        messageId: f.messageId,
        sender: f.sender,
        recipient: f.recipient,
      };

      const deliverAt = new Date(f.deliverAt);
      const readAt = f.readAt ? new Date(f.readAt) : new Date();

      let lastResult: Awaited<ReturnType<typeof createDeliveryReceipt>> | undefined;
      let caughtError: unknown;

      for (const op of c.operations) {
        try {
          if (op === "deliver") {
            lastResult = await createDeliveryReceipt(repo, receiptInput, deliverAt);
          } else if (op === "read") {
            lastResult = await markReceiptRead(repo, f.messageId, readAt);
          }
        } catch (err) {
          caughtError = err;
          break;
        }
      }

      const exp = c.expected as {
        readAt?: string | null;
        deliveredAt?: string;
        error?: { code: string; status: number; message: string };
      };

      if (exp.error) {
        assertApiError(caughtError, exp.error);
      } else {
        expect(caughtError, `${c.id}: unexpected error`).toBeUndefined();
        if ("readAt" in exp) {
          expect(lastResult?.readAt, `${c.id}: readAt`).toBe(exp.readAt);
        }
        if (exp.deliveredAt) {
          expect(lastResult?.deliveredAt, `${c.id}: deliveredAt`).toBe(exp.deliveredAt);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Tampered cases
// ---------------------------------------------------------------------------

describe("tampered", () => {
  const schemaMap = {
    stellarAddress: stellarAddressSchema,
    hash32: hash32Schema,
    stroopAmount: stroopAmountSchema,
  } as const;

  for (const c of vectors.categories.tampered.cases) {
    it(c.id, () => {
      const schema = schemaMap[c.schema as keyof typeof schemaMap];
      const result = schema.safeParse(c.input);
      expect(result.success, c.description).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(c.expected.error);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Relay submission (auth, idempotency, policy)
// ---------------------------------------------------------------------------

import { Route } from "../../../src/routes/api/v1/postage/index";
import { getApiContext } from "../../../src/server/api/context";

describe("relay_submission", () => {
  const handler = (Route.options as any).server?.handlers?.POST;

  for (const c of (vectors.categories as any).relay_submission.cases) {
    it(c.id, async () => {
      const context = await getApiContext();
      (context.repository as any).reset();

      // For the policy block case, we need to pre-configure a blocked rule.
      if (c.id === "relay/policy/blocked-no-mailbox-leak") {
        await context.repository.setSenderRule(c.input.recipient, c.input.sender, "block");
      }

      // For the idempotency case, we want to run twice, checking the second response is replayed.
      if (c.id === "relay/idempotency/duplicate-key-returns-original") {
        // First, configure recipient policy to accept mail so that we get a 201 success.
        await context.repository.setPolicy(c.input.recipient, {
          allowUnknown: true,
          minimumPostage: "0",
          requireVerified: false,
        });

        const req1 = new Request("https://stealth.test/api/v1/postage", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...c.headers,
          },
          body: JSON.stringify(c.input),
        });
        const res1 = await handler!({ request: req1 });
        expect(res1.status).toBe(201);
        expect(res1.headers.get("x-idempotency-replayed")).toBeNull();
        const body1 = await res1.json();

        // Second request with same key
        const req2 = new Request("https://stealth.test/api/v1/postage", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...c.headers,
          },
          body: JSON.stringify(c.input),
        });
        const res2 = await handler!({ request: req2 });
        expect(res2.status).toBe(201);
        expect(res2.headers.get("x-idempotency-replayed")).toBe("true");
        const body2 = await res2.json();
        expect(body2.data).toEqual(body1.data);
      } else {
        const req = new Request("https://stealth.test/api/v1/postage", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...c.headers,
          },
          body: JSON.stringify(c.input),
        });
        const res = await handler!({ request: req });
        expect(res.status).toBe(c.expected.status);
        if (c.expected.code) {
          const body = await res.json();
          expect(body.error?.code).toBe(c.expected.code);
        }
      }
    });
  }
});
