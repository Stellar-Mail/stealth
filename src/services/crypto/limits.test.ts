import { describe, expect, it } from "vitest";
import {
  MAX_BODY_BYTES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_FILENAME_BYTES,
  MAX_CONTENT_TYPE_BYTES,
  MAX_SENDER_BYTES,
  MAX_RECIPIENT_BYTES,
  MAX_RECIPIENT_KEYS,
  validateBody,
  validateAttachment,
  validateAttachments,
  validateEnvelopeInput,
} from "./limits";
import { CryptoError } from "./errors";

function makeBody(sizeBytes: number): string {
  return "x".repeat(sizeBytes);
}

function makeAttachment(
  overrides: Partial<{
    filename: string;
    content_type: string;
    size_bytes: number;
    data: ArrayBuffer;
  }> = {},
) {
  return {
    filename: "report.pdf",
    content_type: "application/pdf",
    size_bytes: 1024 * 1024,
    ...overrides,
  };
}

function makeBaseInput(overrides: Record<string, unknown> = {}) {
  return {
    sender: "GD5KD2SB3U6K7BMTQGZ6QLM45TV4VJLJ4A7OQBKLMNOPQRSTUVWXYZ",
    recipient: "GCVANL2B3U6K7BMTQGZ6QLM45TV4VJLJ4A7OQBKLMNOPQRSTUVWXYZ",
    body: "Hello, world!",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Body limits                                                        */
/* ------------------------------------------------------------------ */

describe("validateBody", () => {
  it("accepts a non-empty body under the limit", () => {
    expect(() => validateBody("Hello")).not.toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => validateBody("")).toThrow(CryptoError);
  });

  it("rejects whitespace-only body", () => {
    expect(() => validateBody("   \t\n  ")).toThrow(CryptoError);
  });

  it("accepts body at exact MAX_BODY_BYTES", () => {
    expect(() => validateBody(makeBody(MAX_BODY_BYTES))).not.toThrow();
  });

  it("rejects body one byte over MAX_BODY_BYTES", () => {
    expect(() => validateBody(makeBody(MAX_BODY_BYTES + 1))).toThrow(CryptoError);
  });

  it("measures multi-byte Unicode correctly", () => {
    const emoji = "😀".repeat(MAX_BODY_BYTES / 4);
    expect(() => validateBody(emoji)).not.toThrow();
  });

  it("rejects multi-byte Unicode that exceeds the limit", () => {
    const emoji = "😀".repeat(MAX_BODY_BYTES / 4 + 1);
    expect(() => validateBody(emoji)).toThrow(CryptoError);
  });
});

/* ------------------------------------------------------------------ */
/*  Single attachment limits                                           */
/* ------------------------------------------------------------------ */

describe("validateAttachment", () => {
  it("accepts a valid attachment", () => {
    expect(() => validateAttachment(makeAttachment())).not.toThrow();
  });

  it("rejects empty filename", () => {
    expect(() => validateAttachment(makeAttachment({ filename: "" }))).toThrow(CryptoError);
  });

  it("rejects filename exceeding MAX_FILENAME_BYTES", () => {
    expect(() =>
      validateAttachment(makeAttachment({ filename: "x".repeat(MAX_FILENAME_BYTES + 1) })),
    ).toThrow(CryptoError);
  });

  it("accepts filename at exact MAX_FILENAME_BYTES", () => {
    expect(() =>
      validateAttachment(makeAttachment({ filename: "x".repeat(MAX_FILENAME_BYTES) })),
    ).not.toThrow();
  });

  it("rejects empty content_type", () => {
    expect(() => validateAttachment(makeAttachment({ content_type: "" }))).toThrow(CryptoError);
  });

  it("rejects content_type exceeding MAX_CONTENT_TYPE_BYTES", () => {
    expect(() =>
      validateAttachment(
        makeAttachment({
          content_type: "x".repeat(MAX_CONTENT_TYPE_BYTES + 1),
        }),
      ),
    ).toThrow(CryptoError);
  });

  it("rejects size_bytes exceeding MAX_ATTACHMENT_BYTES", () => {
    expect(() =>
      validateAttachment(makeAttachment({ size_bytes: MAX_ATTACHMENT_BYTES + 1 })),
    ).toThrow(CryptoError);
  });

  it("accepts size_bytes at exact MAX_ATTACHMENT_BYTES", () => {
    expect(() =>
      validateAttachment(makeAttachment({ size_bytes: MAX_ATTACHMENT_BYTES })),
    ).not.toThrow();
  });

  it("rejects data ArrayBuffer exceeding MAX_ATTACHMENT_BYTES", () => {
    const buf = new ArrayBuffer(MAX_ATTACHMENT_BYTES + 1);
    expect(() => validateAttachment(makeAttachment({ data: buf }))).toThrow(CryptoError);
  });

  it("accepts data at exact MAX_ATTACHMENT_BYTES", () => {
    const buf = new ArrayBuffer(MAX_ATTACHMENT_BYTES);
    expect(() => validateAttachment(makeAttachment({ data: buf }))).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Attachments array limits                                           */
/* ------------------------------------------------------------------ */

describe("validateAttachments", () => {
  it("accepts undefined attachments", () => {
    expect(() => validateAttachments(undefined)).not.toThrow();
  });

  it("accepts empty attachments array", () => {
    expect(() => validateAttachments([])).not.toThrow();
  });

  it("accepts attachments at exact MAX_ATTACHMENTS count", () => {
    const attachments = Array.from({ length: MAX_ATTACHMENTS }, () => makeAttachment());
    expect(() => validateAttachments(attachments)).not.toThrow();
  });

  it("rejects attachments exceeding MAX_ATTACHMENTS count", () => {
    const attachments = Array.from({ length: MAX_ATTACHMENTS + 1 }, () => makeAttachment());
    expect(() => validateAttachments(attachments)).toThrow(CryptoError);
  });
});

/* ------------------------------------------------------------------ */
/*  Full envelope input                                                */
/* ------------------------------------------------------------------ */

describe("validateEnvelopeInput", () => {
  it("accepts a valid full input", () => {
    expect(() => validateEnvelopeInput(makeBaseInput())).not.toThrow();
  });

  it("rejects missing sender", () => {
    expect(() => validateEnvelopeInput(makeBaseInput({ sender: "" }))).toThrow(CryptoError);
  });

  it("rejects sender exceeding MAX_SENDER_BYTES", () => {
    expect(() =>
      validateEnvelopeInput(makeBaseInput({ sender: "x".repeat(MAX_SENDER_BYTES + 1) })),
    ).toThrow(CryptoError);
  });

  it("rejects missing recipient", () => {
    expect(() => validateEnvelopeInput(makeBaseInput({ recipient: "" }))).toThrow(CryptoError);
  });

  it("rejects recipient exceeding MAX_RECIPIENT_BYTES", () => {
    expect(() =>
      validateEnvelopeInput(makeBaseInput({ recipient: "x".repeat(MAX_RECIPIENT_BYTES + 1) })),
    ).toThrow(CryptoError);
  });

  it("rejects body exceeding MAX_BODY_BYTES", () => {
    expect(() =>
      validateEnvelopeInput(makeBaseInput({ body: makeBody(MAX_BODY_BYTES + 1) })),
    ).toThrow(CryptoError);
  });

  it("rejects attachments exceeding MAX_ATTACHMENTS", () => {
    const attachments = Array.from({ length: MAX_ATTACHMENTS + 1 }, () => makeAttachment());
    expect(() => validateEnvelopeInput(makeBaseInput({ attachments }))).toThrow(CryptoError);
  });

  it("rejects oversized recipient key count", () => {
    const recipientPublicKeys = Array.from(
      { length: MAX_RECIPIENT_KEYS + 1 },
      () => "spki-base64-data",
    );
    expect(() => validateEnvelopeInput(makeBaseInput({ recipientPublicKeys }))).toThrow(
      CryptoError,
    );
  });

  it("accepts recipient keys at exact MAX_RECIPIENT_KEYS", () => {
    const recipientPublicKeys = Array.from(
      { length: MAX_RECIPIENT_KEYS },
      () => "spki-base64-data",
    );
    expect(() => validateEnvelopeInput(makeBaseInput({ recipientPublicKeys }))).not.toThrow();
  });

  it("produces safe error messages without leaking input", () => {
    try {
      validateEnvelopeInput(makeBaseInput({ body: makeBody(MAX_BODY_BYTES + 1) }));
    } catch (error) {
      expect(error).toBeInstanceOf(CryptoError);
      expect((error as CryptoError).code).toBe("crypto_validation_error");
      expect((error as CryptoError).message).not.toContain("x");
      expect((error as CryptoError).safe).toBe(true);
    }
  });
});
