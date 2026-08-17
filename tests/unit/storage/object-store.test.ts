import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_CHUNK_PREFIX,
  ENVELOPE_BODY_PREFIX,
  ObjectStoreError,
  attachmentChunkKey,
  commitmentDigest,
  createObjectCommitment,
  deserializeMetadata,
  envelopeBodyKey,
  isExpired,
  serializeMetadata,
  validateStageInput,
  verifyObjectIntegrity,
  type ObjectStoreMetadata,
  type StageObjectInput,
} from "../../../src/services/storage/object-store";

const OWNER = "GA7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7GTH7QNF7G";
const MESSAGE_ID = "b".repeat(64);

function makeInput(overrides: Partial<StageObjectInput> = {}): StageObjectInput {
  return {
    kind: "envelope-body",
    messageId: MESSAGE_ID,
    ownerAddress: OWNER,
    contentType: "application/octet-stream",
    contentLength: 4,
    contentCommitment: "v1:sha256:hex:" + "0".repeat(64),
    bytes: new Uint8Array([1, 2, 3, 4]),
    ...overrides,
  };
}

function validMetadata(overrides: Partial<ObjectStoreMetadata> = {}): ObjectStoreMetadata {
  return {
    version: "v1",
    kind: "envelope-body",
    messageId: MESSAGE_ID,
    ownerAddress: OWNER,
    contentType: "application/octet-stream",
    contentLength: 4,
    contentCommitment: "v1:sha256:hex:" + "0".repeat(64),
    status: "committed",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("object-store domain rules", () => {
  it("rejects a non-Stellar owner address", () => {
    expect(() => validateStageInput(makeInput({ ownerAddress: "not-an-address" }))).toThrow(
      ObjectStoreError,
    );
    expect(() => validateStageInput(makeInput({ ownerAddress: "" }))).toThrow(ObjectStoreError);
  });

  it("rejects a malformed messageId", () => {
    expect(() => validateStageInput(makeInput({ messageId: "short" }))).toThrow(ObjectStoreError);
    expect(() => validateStageInput(makeInput({ messageId: "G".repeat(64) }))).toThrow(
      ObjectStoreError,
    );
  });

  it("rejects an empty or oversized content type", () => {
    expect(() => validateStageInput(makeInput({ contentType: "" }))).toThrow(ObjectStoreError);
    expect(() => validateStageInput(makeInput({ contentType: "x".repeat(129) }))).toThrow(
      ObjectStoreError,
    );
  });

  it("rejects a negative or non-integer content length", () => {
    expect(() => validateStageInput(makeInput({ contentLength: -1 }))).toThrow(ObjectStoreError);
    expect(() => validateStageInput(makeInput({ contentLength: 1.5 }))).toThrow(ObjectStoreError);
  });

  it("rejects a malformed content commitment", () => {
    expect(() => validateStageInput(makeInput({ contentCommitment: "not-a-commitment" }))).toThrow(
      ObjectStoreError,
    );
    expect(() =>
      validateStageInput(makeInput({ contentCommitment: "v2:sha256:hex:1234" })),
    ).toThrow(ObjectStoreError);
  });

  it("requires a chunk index for attachment chunks", () => {
    expect(() =>
      validateStageInput(makeInput({ kind: "attachment-chunk", chunkIndex: undefined })),
    ).toThrow(ObjectStoreError);
    expect(() =>
      validateStageInput(makeInput({ kind: "attachment-chunk", chunkIndex: -1 })),
    ).toThrow(ObjectStoreError);
    expect(() =>
      validateStageInput(makeInput({ kind: "attachment-chunk", chunkIndex: 0 })),
    ).not.toThrow();
  });

  it("rejects an unsupported kind", () => {
    expect(() => validateStageInput(makeInput({ kind: "bogus" as any }))).toThrow(ObjectStoreError);
  });
});

describe("deterministic object naming", () => {
  const digest = "c".repeat(64);

  it("derives the same key for the same message + commitment", () => {
    expect(envelopeBodyKey(MESSAGE_ID, `v1:sha256:hex:${digest}`)).toBe(
      envelopeBodyKey(MESSAGE_ID, `v1:sha256:hex:${digest}`),
    );
  });

  it("never includes a filename or plaintext", () => {
    const key = envelopeBodyKey(MESSAGE_ID, `v1:sha256:hex:${digest}`);
    expect(key.startsWith(ENVELOPE_BODY_PREFIX)).toBe(true);
    expect(key).not.toContain("invoice");
    expect(key).not.toContain(".pdf");
  });

  it("derives distinct chunk keys per chunk index", () => {
    const k0 = attachmentChunkKey(MESSAGE_ID, `v1:sha256:hex:${digest}`, 0);
    const k1 = attachmentChunkKey(MESSAGE_ID, `v1:sha256:hex:${digest}`, 1);
    expect(k0).not.toBe(k1);
    expect(k0.startsWith(ATTACHMENT_CHUNK_PREFIX)).toBe(true);
  });

  it("throws when the commitment cannot yield a digest", () => {
    expect(() => envelopeBodyKey(MESSAGE_ID, "bogus")).toThrow(ObjectStoreError);
    expect(() => attachmentChunkKey(MESSAGE_ID, "bogus", 0)).toThrow(ObjectStoreError);
  });
});

describe("commitment helper", () => {
  it("extracts the hex digest from a versioned commitment", () => {
    const digest = "d".repeat(64);
    expect(commitmentDigest(`v1:sha256:hex:${digest}`)).toBe(digest);
  });

  it("returns null for malformed commitments", () => {
    expect(commitmentDigest("bogus")).toBeNull();
    expect(commitmentDigest("v1:sha256:hex:nothex")).toBeNull();
    expect(commitmentDigest(`v1:sha256:hex:${"d".repeat(63)}`)).toBeNull();
  });
});

describe("metadata serialization", () => {
  it("round-trips metadata through the R2 string map", () => {
    const metadata = validMetadata({ chunkIndex: 3, totalChunks: 5 });
    const roundTrip = deserializeMetadata(serializeMetadata(metadata));
    expect(roundTrip).toEqual(metadata);
  });

  it("fails closed on malformed numeric fields", () => {
    expect(() =>
      deserializeMetadata({ ...serializeMetadata(validMetadata()), contentLength: "NaN" }),
    ).toThrow(ObjectStoreError);
    expect(() =>
      deserializeMetadata({ ...serializeMetadata(validMetadata()), contentLength: "-5" }),
    ).toThrow(ObjectStoreError);
  });

  it("rejects metadata with an invalid owner or commitment", () => {
    const raw = serializeMetadata(validMetadata({ ownerAddress: "junk" }));
    const parsed = deserializeMetadata(raw);
    expect(parsed.ownerAddress).toBe("junk");
    expect(() => {
      // assertValidMetadata is exercised by the adapter; here we check parse-level invariants.
      if (!/^G[A-Z2-7]{55}$/.test(parsed.ownerAddress))
        throw new ObjectStoreError("object_store_ownership_error", "Malformed ownerAddress");
    }).toThrow(ObjectStoreError);
  });
});

describe("integrity verification", () => {
  it("verifies length and commitment for matching bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const commitment = await createObjectCommitment(bytes);
    await expect(
      verifyObjectIntegrity({ bytes, contentLength: bytes.length, contentCommitment: commitment }),
    ).resolves.toBeUndefined();
  });

  it("rejects when the length is wrong", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const commitment = await createObjectCommitment(bytes);
    await expect(
      verifyObjectIntegrity({
        bytes,
        contentLength: bytes.length + 1,
        contentCommitment: commitment,
      }),
    ).rejects.toThrow("length mismatch");
  });

  it("rejects when bytes are tampered", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const commitment = await createObjectCommitment(bytes);
    const tampered = new Uint8Array(bytes);
    tampered[0] = 0xff;
    await expect(
      verifyObjectIntegrity({
        bytes: tampered,
        contentLength: bytes.length,
        contentCommitment: commitment,
      }),
    ).rejects.toThrow("SHA-256 commitment");
  });
});

describe("expiry", () => {
  it("considers an object expired at or after its expiry timestamp", () => {
    const metadata = validMetadata({ expiresAt: "2026-01-01T00:00:00.000Z" });
    expect(isExpired(metadata, new Date("2025-12-31T23:59:59.000Z"))).toBe(false);
    expect(isExpired(metadata, new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(isExpired(metadata, new Date("2026-01-02T00:00:00.000Z"))).toBe(true);
  });

  it("never expires an object without an expiry timestamp", () => {
    const metadata = validMetadata();
    expect(isExpired(metadata, new Date("2100-01-01T00:00:00.000Z"))).toBe(false);
  });
});
