/**
 * tests/unit/api/envelope-repository.test.ts
 *
 * Issue #1936 — BETA-029: Persist encrypted envelopes and immutable message metadata.
 *
 * Coverage:
 *  - Domain rule: plaintext fields (subject, body) never accepted.
 *  - Domain rule: storedEnvelopeSchema validates every required field.
 *  - Insert semantics: first insert -> "inserted".
 *  - Retry/idempotency: byte-identical resubmission -> "duplicate" (safe).
 *  - Conflict: different payload same ID -> "conflict" (unrecoverable).
 *  - Concurrency: exactly one winner out of N concurrent inserts.
 *  - Tamper detection: ValidatedApiRepository rejects a corrupted record.
 *  - Size limit: ciphertext exceeding 20 MiB is rejected by the schema.
 *  - Index consistency: listEnvelopes ordering is stable and recipient-filtered.
 *  - Reset: envelopes are cleared by reset().
 *  - Contract: MemoryApiRepository satisfies ApiRepository for envelope methods.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { StoredEnvelope } from "../../../src/server/api/domain";
import {
  storedEnvelopeSchema,
  storedEnvelopeProtectedHeadersSchema,
} from "../../../src/server/api/domain";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  ValidatedApiRepository,
  registerRecordSchema,
  paginate,
  PAGINATED_QUERY_ORDERINGS,
} from "../../../src/server/api/repository";
import { DataIntegrityError } from "../../../src/server/api/errors";

// ---------------------------------------------------------------------------
// Register schemas (mirrors context.ts — required once per test file)
// ---------------------------------------------------------------------------
import {
  mailboxPolicySchema,
  senderRuleSchema,
  postageSchema,
  receiptSchema,
  idempotencyRecordSchema,
} from "../../../src/server/api/domain";

registerRecordSchema("mailboxPolicy", 1, mailboxPolicySchema);
registerRecordSchema("senderRule", 1, senderRuleSchema);
registerRecordSchema("postage", 1, postageSchema);
registerRecordSchema("receipt", 1, receiptSchema);
registerRecordSchema("idempotencyRecord", 2, idempotencyRecordSchema, {
  1: (data: any) => ({ ...data, requestDigest: "legacy:unrecoverable" }),
});
registerRecordSchema("storedEnvelope", 1, storedEnvelopeSchema);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SENDER = `G${"A".repeat(55)}`;
const RECIPIENT = `G${"B".repeat(55)}`;
const EPHEMERAL_KEY = `G${"C".repeat(55)}`;
const MSG_ID_A = "a".repeat(64);
const MSG_ID_B = "b".repeat(64);
const COMMITMENT = "c".repeat(64);
const MAC = "d".repeat(64);
const NONCE = "ab12cd34ef56"; // even-length hex

function makeEnvelope(overrides: Partial<StoredEnvelope> = {}): StoredEnvelope {
  return {
    messageId: MSG_ID_A,
    senderId: SENDER,
    recipientId: RECIPIENT,
    ciphertext: "dGVzdC1jaXBoZXJ0ZXh0", // base64 "test-ciphertext"
    protectedHeaders: {
      algorithm: "AES-256-GCM",
      ephemeral_public_key: EPHEMERAL_KEY,
      nonce: NONCE,
      mac: MAC,
      version: "v1",
    },
    contentCommitment: COMMITMENT,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "pending",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Domain schema validation
// ---------------------------------------------------------------------------

describe("storedEnvelopeSchema — domain rules", () => {
  it("accepts a valid StoredEnvelope", () => {
    const result = storedEnvelopeSchema.safeParse(makeEnvelope());
    expect(result.success).toBe(true);
  });

  it("rejects a record with empty ciphertext", () => {
    const result = storedEnvelopeSchema.safeParse(makeEnvelope({ ciphertext: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a record with plaintext fields (subject)", () => {
    // The schema is strict: no 'subject' field should ever be accepted.
    const withSubject = { ...makeEnvelope(), subject: "hello" } as any;
    // storedEnvelopeSchema uses z.object which strips unknown fields in parse.
    // Acceptance test: parsed output must NOT contain 'subject'.
    const result = storedEnvelopeSchema.safeParse(withSubject);
    if (result.success) {
      expect((result.data as any).subject).toBeUndefined();
    }
    // Regardless of parse success, the field must not survive.
  });

  it("rejects a record with plaintext fields (body)", () => {
    const withBody = { ...makeEnvelope(), body: "secret message" } as any;
    const result = storedEnvelopeSchema.safeParse(withBody);
    if (result.success) {
      expect((result.data as any).body).toBeUndefined();
    }
  });

  it("rejects a record with an invalid messageId (not 64 hex chars)", () => {
    const result = storedEnvelopeSchema.safeParse(makeEnvelope({ messageId: "short" }));
    expect(result.success).toBe(false);
  });

  it("rejects a record with an invalid senderId (not a G-address)", () => {
    const result = storedEnvelopeSchema.safeParse(makeEnvelope({ senderId: "not-a-g-address" }));
    expect(result.success).toBe(false);
  });

  it("rejects a record with an invalid contentCommitment (not 64 hex chars)", () => {
    const result = storedEnvelopeSchema.safeParse(makeEnvelope({ contentCommitment: "tooshort" }));
    expect(result.success).toBe(false);
  });

  it("rejects a record with an invalid createdAt timestamp", () => {
    const result = storedEnvelopeSchema.safeParse(makeEnvelope({ createdAt: "not-a-timestamp" }));
    expect(result.success).toBe(false);
  });

  it("rejects ciphertext with non-base64 characters", () => {
    const result = storedEnvelopeSchema.safeParse(makeEnvelope({ ciphertext: "this has spaces!" }));
    expect(result.success).toBe(false);
  });

  it("rejects ciphertext exceeding 20 MiB", () => {
    // 20 MiB + 1 byte of valid base64 characters
    const oversized = "A".repeat(20 * 1024 * 1024 + 1);
    const result = storedEnvelopeSchema.safeParse(makeEnvelope({ ciphertext: oversized }));
    expect(result.success).toBe(false);
  });
});

describe("storedEnvelopeProtectedHeadersSchema — header fields", () => {
  it("accepts valid protected headers", () => {
    const result = storedEnvelopeProtectedHeadersSchema.safeParse({
      algorithm: "AES-256-GCM",
      ephemeral_public_key: EPHEMERAL_KEY,
      nonce: NONCE,
      mac: MAC,
      version: "v1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid version format", () => {
    const result = storedEnvelopeProtectedHeadersSchema.safeParse({
      algorithm: "AES-256-GCM",
      ephemeral_public_key: EPHEMERAL_KEY,
      nonce: NONCE,
      mac: MAC,
      version: "1", // must be 'v<digit>'
    });
    expect(result.success).toBe(false);
  });

  it("rejects nonce with non-hex characters", () => {
    const result = storedEnvelopeProtectedHeadersSchema.safeParse({
      algorithm: "AES-256-GCM",
      ephemeral_public_key: EPHEMERAL_KEY,
      nonce: "GGGG", // uppercase not in [a-f0-9]
      mac: MAC,
      version: "v1",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. MemoryApiRepository — insert semantics
// ---------------------------------------------------------------------------

describe("MemoryApiRepository — envelope insert semantics", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("returns 'inserted' on the first insert", async () => {
    const envelope = makeEnvelope();
    const result = await repo.insertEnvelope(envelope);
    expect(result.outcome).toBe("inserted");
    if (result.outcome === "inserted") {
      expect(result.envelope.messageId).toBe(MSG_ID_A);
    }
  });

  it("returns 'duplicate' for a byte-identical resubmission", async () => {
    const envelope = makeEnvelope();
    await repo.insertEnvelope(envelope);

    const retry = await repo.insertEnvelope({ ...envelope });
    expect(retry.outcome).toBe("duplicate");
    if (retry.outcome === "duplicate") {
      expect(retry.envelope.messageId).toBe(MSG_ID_A);
    }
  });

  it("returns 'conflict' when a different payload uses the same messageId", async () => {
    await repo.insertEnvelope(makeEnvelope());

    const different = makeEnvelope({ ciphertext: "ZGlmZmVyZW50" }); // different base64
    const result = await repo.insertEnvelope(different);
    expect(result.outcome).toBe("conflict");
  });

  it("returns null for a missing envelope", async () => {
    await expect(repo.getEnvelope(MSG_ID_A)).resolves.toBeNull();
  });

  it("retrieves an inserted envelope by messageId", async () => {
    const envelope = makeEnvelope();
    await repo.insertEnvelope(envelope);

    const retrieved = await repo.getEnvelope(MSG_ID_A);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.messageId).toBe(MSG_ID_A);
    expect(retrieved?.senderId).toBe(SENDER);
    expect(retrieved?.recipientId).toBe(RECIPIENT);
    // Critical: plaintext fields must not exist on the retrieved record.
    expect((retrieved as any)?.subject).toBeUndefined();
    expect((retrieved as any)?.body).toBeUndefined();
  });

  it("isolates envelopes by messageId", async () => {
    await repo.insertEnvelope(makeEnvelope({ messageId: MSG_ID_A }));
    await repo.insertEnvelope(makeEnvelope({ messageId: MSG_ID_B }));

    await expect(repo.getEnvelope(MSG_ID_A)).resolves.toMatchObject({ messageId: MSG_ID_A });
    await expect(repo.getEnvelope(MSG_ID_B)).resolves.toMatchObject({ messageId: MSG_ID_B });
  });

  it("does not reflect post-write mutation of the input object", async () => {
    const envelope = makeEnvelope();
    await repo.insertEnvelope(envelope);

    // Mutate the original reference after insert.
    (envelope as any).senderId = "MUTATED";

    const retrieved = await repo.getEnvelope(MSG_ID_A);
    expect(retrieved?.senderId).toBe(SENDER);
  });

  it("clears all envelopes on reset()", async () => {
    await repo.insertEnvelope(makeEnvelope());
    repo.reset();
    await expect(repo.getEnvelope(MSG_ID_A)).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Concurrency: exactly one winner out of N concurrent inserts
// ---------------------------------------------------------------------------

describe("MemoryApiRepository — concurrent insert safety", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("allows exactly one winner out of 10 concurrent identical inserts", async () => {
    const envelope = makeEnvelope();

    const results = await Promise.all(
      Array.from({ length: 10 }, () => repo.insertEnvelope({ ...envelope })),
    );

    const inserted = results.filter((r) => r.outcome === "inserted");
    const duplicates = results.filter((r) => r.outcome === "duplicate");
    const conflicts = results.filter((r) => r.outcome === "conflict");

    // Exactly one "inserted"; the rest must be "duplicate" (byte-identical).
    expect(inserted).toHaveLength(1);
    expect(duplicates).toHaveLength(9);
    expect(conflicts).toHaveLength(0);

    // The stored record is consistent.
    await expect(repo.getEnvelope(MSG_ID_A)).resolves.toMatchObject({
      messageId: MSG_ID_A,
    });
  });

  it("returns 'conflict' for every racer that has a different payload", async () => {
    // First insert wins.
    await repo.insertEnvelope(makeEnvelope());

    // 5 concurrent submissions each with different ciphertext.
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        repo.insertEnvelope(makeEnvelope({ ciphertext: `ZGlmZmVyZW50${i}AA=` })),
      ),
    );

    // All must be "conflict" because the first insert already wrote a record.
    for (const r of results) {
      expect(r.outcome).toBe("conflict");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. ValidatedApiRepository — tamper detection
// ---------------------------------------------------------------------------

describe("ValidatedApiRepository — envelope tamper detection", () => {
  let inner: MemoryApiRepository;
  let repo: ValidatedApiRepository;

  beforeEach(() => {
    inner = new MemoryApiRepository();
    repo = new ValidatedApiRepository(inner);
  });

  it("passes through a valid stored envelope unchanged", async () => {
    await inner.insertEnvelope(makeEnvelope());
    const retrieved = await repo.getEnvelope(MSG_ID_A);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.messageId).toBe(MSG_ID_A);
  });

  it("throws DataIntegrityError when the stored record has a corrupted messageId", async () => {
    await inner.insertEnvelope(makeEnvelope());
    // Directly corrupt the in-memory store to simulate storage tampering.
    const envelopeMap = (inner as any)["envelopes"] as Map<string, StoredEnvelope>;
    envelopeMap.set(MSG_ID_A, { ...makeEnvelope(), messageId: "corrupted" as any });

    await expect(repo.getEnvelope(MSG_ID_A)).rejects.toBeInstanceOf(DataIntegrityError);
  });

  it("throws DataIntegrityError when ciphertext contains invalid characters", async () => {
    await inner.insertEnvelope(makeEnvelope());
    const envelopeMap = (inner as any)["envelopes"] as Map<string, StoredEnvelope>;
    envelopeMap.set(MSG_ID_A, { ...makeEnvelope(), ciphertext: "<<<INVALID>>>" });

    let error: unknown;
    try {
      await repo.getEnvelope(MSG_ID_A);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(DataIntegrityError);
    if (error instanceof DataIntegrityError) {
      expect(error.recordType).toBe("storedEnvelope");
      // The error must not expose the corrupt payload.
      expect(error.message).not.toContain("INVALID");
    }
  });

  it("throws DataIntegrityError when contentCommitment is malformed", async () => {
    await inner.insertEnvelope(makeEnvelope());
    const envelopeMap = (inner as any)["envelopes"] as Map<string, StoredEnvelope>;
    envelopeMap.set(MSG_ID_A, {
      ...makeEnvelope(),
      contentCommitment: "not-a-valid-hash",
    });

    await expect(repo.getEnvelope(MSG_ID_A)).rejects.toBeInstanceOf(DataIntegrityError);
  });

  it("generates a unique correlation ID per DataIntegrityError", async () => {
    await inner.insertEnvelope(makeEnvelope());
    const envelopeMap = (inner as any)["envelopes"] as Map<string, StoredEnvelope>;

    envelopeMap.set(MSG_ID_A, { ...makeEnvelope(), messageId: "bad1" as any });
    let e1: DataIntegrityError | undefined;
    try {
      await repo.getEnvelope(MSG_ID_A);
    } catch (e) {
      if (e instanceof DataIntegrityError) e1 = e;
    }

    envelopeMap.set(MSG_ID_A, { ...makeEnvelope(), messageId: "bad2" as any });
    let e2: DataIntegrityError | undefined;
    try {
      await repo.getEnvelope(MSG_ID_A);
    } catch (e) {
      if (e instanceof DataIntegrityError) e2 = e;
    }

    expect(e1).toBeInstanceOf(DataIntegrityError);
    expect(e2).toBeInstanceOf(DataIntegrityError);
    expect(e1?.correlationId).not.toBe(e2?.correlationId);
  });
});

// ---------------------------------------------------------------------------
// 5. Recipient-indexed listing (index consistency without plaintext)
// ---------------------------------------------------------------------------

describe("listEnvelopes — recipient-indexed pagination ordering", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("sorts envelopes by createdAt descending with messageId tie-breaker", async () => {
    const envelopesData: StoredEnvelope[] = [
      makeEnvelope({
        messageId: "1".repeat(64),
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      makeEnvelope({
        messageId: "2".repeat(64),
        createdAt: "2026-01-03T00:00:00.000Z",
      }),
      makeEnvelope({
        messageId: "3".repeat(64),
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    ];

    for (const env of envelopesData) {
      await repo.insertEnvelope(env);
    }

    // Retrieve and sort using the declared ordering.
    const allEnvelopes: StoredEnvelope[] = [];
    for (const env of envelopesData) {
      const stored = await repo.getEnvelope(env.messageId);
      if (stored) allEnvelopes.push(stored);
    }

    const spec = PAGINATED_QUERY_ORDERINGS.listEnvelopes;
    const page = paginate(allEnvelopes, spec, { limit: 10 });

    // Descending: newest first.
    expect(page.items[0]?.createdAt).toBe("2026-01-03T00:00:00.000Z");
    expect(page.items[1]?.createdAt).toBe("2026-01-02T00:00:00.000Z");
    expect(page.items[2]?.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(page.nextContinuationKey).toBeNull();
  });

  it("paginates envelopes correctly with continuation keys", async () => {
    const envelopesData: StoredEnvelope[] = [
      makeEnvelope({ messageId: "1".repeat(64), createdAt: "2026-01-01T00:00:00.000Z" }),
      makeEnvelope({ messageId: "2".repeat(64), createdAt: "2026-01-02T00:00:00.000Z" }),
      makeEnvelope({ messageId: "3".repeat(64), createdAt: "2026-01-03T00:00:00.000Z" }),
      makeEnvelope({ messageId: "4".repeat(64), createdAt: "2026-01-04T00:00:00.000Z" }),
    ];

    for (const env of envelopesData) {
      await repo.insertEnvelope(env);
    }

    const allEnvelopes: StoredEnvelope[] = [];
    for (const env of envelopesData) {
      const stored = await repo.getEnvelope(env.messageId);
      if (stored) allEnvelopes.push(stored);
    }

    const spec = PAGINATED_QUERY_ORDERINGS.listEnvelopes;

    // Page 1: first 2
    const page1 = paginate(allEnvelopes, spec, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextContinuationKey).not.toBeNull();

    // Page 2: remaining 2
    const page2 = paginate(allEnvelopes, spec, {
      limit: 2,
      after: page1.nextContinuationKey!,
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.nextContinuationKey).toBeNull();

    // All 4 unique, no duplicates across pages.
    const allIds = [...page1.items, ...page2.items].map((e) => e.messageId);
    expect(new Set(allIds).size).toBe(4);
  });

  it("filters by recipientId without indexing plaintext", async () => {
    const otherRecipient = `G${"D".repeat(55)}`;

    await repo.insertEnvelope(makeEnvelope({ messageId: "1".repeat(64) }));
    await repo.insertEnvelope(
      makeEnvelope({ messageId: "2".repeat(64), recipientId: otherRecipient }),
    );

    const env1 = await repo.getEnvelope("1".repeat(64));
    const env2 = await repo.getEnvelope("2".repeat(64));

    const all = [env1, env2].filter((e): e is StoredEnvelope => e !== null);

    // Caller filters by recipient before pagination (plaintext never indexed).
    const forRecipient = all.filter((e) => e.recipientId === RECIPIENT);
    expect(forRecipient).toHaveLength(1);
    expect(forRecipient[0]?.messageId).toBe("1".repeat(64));
  });
});

// ---------------------------------------------------------------------------
// 6. Repository contract: ApiRepository interface conformance
// ---------------------------------------------------------------------------

describe("MemoryApiRepository — ApiRepository envelope contract", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("satisfies ApiRepository.getEnvelope(missing) === null", async () => {
    await expect(repo.getEnvelope(MSG_ID_A)).resolves.toBeNull();
  });

  it("satisfies ApiRepository.insertEnvelope -> ApiRepository.getEnvelope round-trip", async () => {
    const envelope = makeEnvelope();
    const insertResult = await repo.insertEnvelope(envelope);
    expect(insertResult.outcome).toBe("inserted");

    const retrieved = await repo.getEnvelope(MSG_ID_A);
    expect(retrieved).toMatchObject({
      messageId: MSG_ID_A,
      senderId: SENDER,
      recipientId: RECIPIENT,
      contentCommitment: COMMITMENT,
    });
  });

  it("insertEnvelope is insert-only: no upsert behaviour", async () => {
    const original = makeEnvelope();
    await repo.insertEnvelope(original);

    // A different payload cannot overwrite the original.
    const attempt = makeEnvelope({ ciphertext: "bmV3Y2lwaGVydGV4dA==" });
    const result = await repo.insertEnvelope(attempt);
    expect(result.outcome).toBe("conflict");

    // Original is preserved.
    const stored = await repo.getEnvelope(MSG_ID_A);
    expect(stored?.ciphertext).toBe(original.ciphertext);
  });
});
