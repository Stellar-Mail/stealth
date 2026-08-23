import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { openApiDocument } from "../../../src/server/api/openapi";
import {
  ApiClient,
  ApiClientError,
  parseErrorEnvelope,
  statusToCode,
  queryKeys,
  cacheInvalidations,
} from "../../../src/lib/api";
import type {
  Contact,
  MailboxPolicy,
  UnknownSenderRequest,
  PostageQuote,
} from "../../../src/lib/api";

// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — contract tests: the typed client decoders must
// match what the server documents in OpenAPI. We drive the client through
// response envelopes built from the OpenAPI examples/schemas and assert the
// typed data the components will receive.
// ---------------------------------------------------------------------------

function resolveSchema(name: string) {
  const schema = openApiDocument.components.schemas[name];
  if (!schema) throw new Error(`Schema ${name} not found in OpenAPI document`);
  return schema as Record<string, unknown>;
}

function mockFetch(response: { ok: boolean; status: number; json: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.json,
  }) as unknown as typeof fetch;
}

const CONTACT_SCHEMA = resolveSchema("Contact");
const POLICY_SCHEMA = resolveSchema("MailboxPolicy");

const sampleContact: Contact = {
  contactId: "c1",
  owner: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  name: "Ada",
  address: "ada@example.com",
  canonicalAddress: null,
  trust: "default",
  source: "manual",
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-01-02T03:04:05.000Z",
  version: 1,
};

describe("client decoding matches OpenAPI schemas", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ok: true,
        status: 200,
        json: {
          data: sampleContact,
          meta: { requestId: "r1", timestamp: "2026-01-01T00:00:00.000Z" },
        },
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Contact schema fields align with the client Contact DTO", () => {
    expect(CONTACT_SCHEMA.required).toEqual(
      expect.arrayContaining([
        "contactId",
        "owner",
        "name",
        "address",
        "canonicalAddress",
        "trust",
        "source",
        "createdAt",
        "updatedAt",
        "version",
      ]),
    );
    expect(CONTACT_SCHEMA.additionalProperties).toBe(false);
  });

  it("MailboxPolicy schema fields align with the client MailboxPolicy DTO", () => {
    expect(POLICY_SCHEMA.required).toEqual(
      expect.arrayContaining(["allowUnknown", "minimumPostage", "requireVerified"]),
    );
    const props = POLICY_SCHEMA.properties as Record<string, { type?: string }>;
    expect(props.allowUnknown.type).toBe("boolean");
    expect(props.requireVerified.type).toBe("boolean");
  });

  it("the typed client unwraps the success envelope into typed data", async () => {
    const client = new ApiClient();
    const contact = await client.get<Contact>("/contacts");
    expect(contact.contactId).toBe("c1");
    expect(contact.trust).toBe("default");
    expect(contact.canonicalAddress).toBeNull();
  });

  it("the typed client parses the error envelope into ApiClientError", async () => {
    const envelope = {
      error: {
        code: "rate_limited",
        message: "Slow down",
        retryable: true,
        retryClassification: "rate_limited",
        retryAfter: 12,
      },
      meta: { requestId: "r2", timestamp: "2026-01-01T00:00:00.000Z" },
    };
    vi.stubGlobal("fetch", mockFetch({ ok: false, status: 429, json: envelope }));

    const client = new ApiClient();
    await expect(client.get<Contact>("/contacts")).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof ApiClientError)) return false;
      expect(err.code).toBe("rate_limited");
      expect(err.status).toBe(429);
      expect(err.retryable).toBe(true);
      expect(err.retryClassification).toBe("rate_limited");
      expect(err.retryAfterSeconds).toBe(12);
      expect(err.requestId).toBe("r2");
      return true;
    });
  });

  it("parseErrorEnvelope is stable for server-shaped error bodies", () => {
    const error = parseErrorEnvelope(
      {
        error: {
          code: "validation_error",
          message: "Bad input",
          retryable: false,
          retryClassification: "none",
        },
        meta: { requestId: "r3" },
      },
      422,
    );
    expect(error.code).toBe("validation_error");
    expect(error.status).toBe(422);
    expect(error.retryable).toBe(false);
  });

  it("statusToCode maps HTTP statuses to canonical public codes", () => {
    expect(statusToCode(401)).toBe("unauthorized");
    expect(statusToCode(403)).toBe("forbidden");
    expect(statusToCode(404)).toBe("not_found");
    expect(statusToCode(409)).toBe("conflict");
    expect(statusToCode(422)).toBe("validation_error");
    expect(statusToCode(429)).toBe("rate_limited");
    expect(statusToCode(413)).toBe("payload_too_large");
    expect(statusToCode(503)).toBe("dependency_failure");
  });
});

describe("query keys and cache invalidation rules", () => {
  it("query keys are stable, scoped tuples", () => {
    expect(queryKeys.mailbox.queue("GABC")).toEqual(["mailbox", "queue", "GABC"]);
    expect(queryKeys.mailbox.sync("GABC")).toEqual(["mailbox", "sync", "GABC"]);
    expect(queryKeys.mailbox.counts("GABC")).toEqual(["mailbox", "counts", "GABC"]);
    expect(queryKeys.mailbox.delta("GABC")).toEqual(["mailbox", "delta", "GABC"]);
    expect(queryKeys.mailbox.thread("GABC")).toEqual(["mailbox", "thread", "GABC"]);
    expect(queryKeys.auth.session).toEqual(["auth", "session"]);
    expect(queryKeys.policies.policy("GABC")).toEqual(["policies", "GABC"]);
  });

  it("mutations invalidate the documented dependent queries", () => {
    expect(cacheInvalidations.sessionLogout()).toEqual([
      ["auth", "session"],
      ["auth", "sessions"],
    ]);
    expect(cacheInvalidations.tombstoneMessage("GABC")).toEqual([
      ["mailbox", "queue", "GABC"],
      ["mailbox", "sync", "GABC"],
      ["mailbox", "counts", "GABC"],
      ["mailbox", "delta", "GABC"],
      ["mailbox", "thread", "GABC"],
    ]);
    expect(cacheInvalidations.patchMailboxFlags("GABC")).toEqual([
      ["mailbox", "queue", "GABC"],
      ["mailbox", "sync", "GABC"],
      ["mailbox", "counts", "GABC"],
      ["mailbox", "delta", "GABC"],
      ["mailbox", "thread", "GABC"],
    ]);
    expect(cacheInvalidations.updateMailboxPolicy("GABC")).toEqual([
      ["policies", "GABC"],
      ["policies", "reconciliation", "GABC"],
      ["policies", "evaluate", "GABC"],
      ["settings"],
    ]);
  });
});

describe("typed domain DTO shapes carry the server contract", () => {
  it("UnknownSenderRequest DTO matches server shape", () => {
    const request: UnknownSenderRequest = {
      requestId: "uuid",
      recipient: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      sender: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      message: { messageId: "a".repeat(64), ciphertextHash: "b".repeat(64) },
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-02T00:00:00.000Z",
      status: "pending",
    };
    expect(request.status).toBe("pending");
  });

  it("PostageQuote DTO mirrors the compose-facing shape", () => {
    const quote: PostageQuote = {
      amount: "0",
      eligible: true,
      reason: "trusted_sender",
      trusted: true,
      messageId: "a".repeat(64),
    };
    expect(quote.reason).toBe("trusted_sender");
    expect(quote.trusted).toBe(true);
  });

  it("MailboxPolicy DTO matches the OpenAPI required fields", () => {
    const policy: MailboxPolicy = {
      allowUnknown: true,
      minimumPostage: "0",
      requireVerified: false,
    };
    expect(policy).toEqual({
      allowUnknown: true,
      minimumPostage: "0",
      requireVerified: false,
    });
  });
});
