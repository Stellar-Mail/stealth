import { describe, expect, it } from "vitest";
import {
  filterAttachments,
  formatAttachmentSummary,
  formatBytes,
  inferCategory,
  isSafeSenderAddress,
  isValidAttachmentId,
  sortAttachmentsByDate,
  validateAttachmentDraft,
  validateAttachment,
  applyDraftToRecord,
  categoryLabel,
} from "../helpers/attachmentHelpers";
import type { DemoAttachmentRecord } from "../types/attachment";
import { demoAttachmentRecords, blankAttachmentDraft } from "../fixtures/attachmentFixtures";

// ---------------------------------------------------------------------------
// isSafeSenderAddress
// ---------------------------------------------------------------------------

describe("isSafeSenderAddress", () => {
  it("accepts @example.com addresses", () => {
    expect(isSafeSenderAddress("billing@example.com")).toBe(true);
  });

  it("accepts @example.org addresses", () => {
    expect(isSafeSenderAddress("info@example.org")).toBe(true);
  });

  it("accepts *stealth.demo federation handles", () => {
    expect(isSafeSenderAddress("relay07*stealth.demo")).toBe(true);
    expect(isSafeSenderAddress("bridge*stealth.demo")).toBe(true);
  });

  it("accepts subdomain *stealth.demo handles", () => {
    expect(isSafeSenderAddress("node*east.stealth.demo")).toBe(true);
  });

  it("rejects live email addresses", () => {
    expect(isSafeSenderAddress("user@gmail.com")).toBe(false);
    expect(isSafeSenderAddress("admin@company.io")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isSafeSenderAddress("")).toBe(false);
  });

  it("trims whitespace before checking", () => {
    expect(isSafeSenderAddress("  billing@example.com  ")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateAttachmentDraft
// ---------------------------------------------------------------------------

describe("validateAttachmentDraft", () => {
  const valid: Parameters<typeof validateAttachmentDraft>[0] = {
    fileName: "invoice.pdf",
    fileSize: "120 KB",
    fileSizeBytes: 122880,
    fileType: "PDF Document",
    category: "document",
    messageSubject: "Test subject",
    sender: "billing@example.com",
    receivedAt: "2026-06-16T12:00:00",
  };

  it("returns no errors for a fully valid draft", () => {
    expect(validateAttachmentDraft(valid)).toHaveLength(0);
  });

  it("reports error for missing fileName", () => {
    const errors = validateAttachmentDraft({ ...valid, fileName: "" });
    expect(errors.some((e) => e.field === "fileName")).toBe(true);
  });

  it("reports error for fileName without extension", () => {
    const errors = validateAttachmentDraft({ ...valid, fileName: "myfile" });
    expect(errors.some((e) => e.field === "fileName")).toBe(true);
  });

  it("reports error for invalid fileSize display string", () => {
    const errors = validateAttachmentDraft({ ...valid, fileSize: "not-a-size" });
    expect(errors.some((e) => e.field === "fileSize")).toBe(true);
  });

  it("accepts valid fileSize display strings", () => {
    for (const size of ["4.2 KB", "120 KB", "1 MB", "500 B"]) {
      const errors = validateAttachmentDraft({ ...valid, fileSize: size });
      expect(errors.some((e) => e.field === "fileSize")).toBe(false);
    }
  });

  it("reports error for negative fileSizeBytes", () => {
    const errors = validateAttachmentDraft({ ...valid, fileSizeBytes: -1 });
    expect(errors.some((e) => e.field === "fileSizeBytes")).toBe(true);
  });

  it("accepts zero fileSizeBytes (e.g. empty placeholder)", () => {
    const errors = validateAttachmentDraft({ ...valid, fileSizeBytes: 0 });
    expect(errors.some((e) => e.field === "fileSizeBytes")).toBe(false);
  });

  it("reports error for invalid category", () => {
    const errors = validateAttachmentDraft({ ...valid, category: "unknown" as never });
    expect(errors.some((e) => e.field === "category")).toBe(true);
  });

  it("reports error for unsafe sender", () => {
    const errors = validateAttachmentDraft({ ...valid, sender: "user@gmail.com" });
    expect(errors.some((e) => e.field === "sender")).toBe(true);
  });

  it("reports error for missing messageSubject", () => {
    const errors = validateAttachmentDraft({ ...valid, messageSubject: "  " });
    expect(errors.some((e) => e.field === "messageSubject")).toBe(true);
  });

  it("reports error for invalid receivedAt timestamp", () => {
    const errors = validateAttachmentDraft({ ...valid, receivedAt: "not-a-date" });
    expect(errors.some((e) => e.field === "receivedAt")).toBe(true);
  });

  it("accepts receivedAt without seconds", () => {
    const errors = validateAttachmentDraft({ ...valid, receivedAt: "2026-06-16T12:00" });
    expect(errors.some((e) => e.field === "receivedAt")).toBe(false);
  });

  it("rejects live previewUrl", () => {
    const errors = validateAttachmentDraft({
      ...valid,
      previewUrl: "https://example.com/file.pdf",
    });
    expect(errors.some((e) => e.field === "previewUrl")).toBe(true);
  });

  it("accepts relative or hash previewUrl", () => {
    for (const url of ["#my-preview", "/static/preview"]) {
      const errors = validateAttachmentDraft({ ...valid, previewUrl: url });
      expect(errors.some((e) => e.field === "previewUrl")).toBe(false);
    }
  });

  it("accepts absent previewUrl", () => {
    const { previewUrl: _pv, ...rest } = valid;
    const errors = validateAttachmentDraft(rest);
    expect(errors.some((e) => e.field === "previewUrl")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateAttachment (structured result)
// ---------------------------------------------------------------------------

describe("validateAttachment", () => {
  it("returns valid:true for a valid draft", () => {
    const result = validateAttachment({
      fileName: "proof.proof",
      fileSize: "2.1 KB",
      fileSizeBytes: 2150,
      fileType: "Cryptographic Proof",
      category: "proof",
      messageSubject: "Delivery receipt settled",
      sender: "receipts*stealth.demo",
      receivedAt: "2026-06-16T11:00:00",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid:false with errors for an invalid draft", () => {
    const result = validateAttachment({ fileName: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// inferCategory
// ---------------------------------------------------------------------------

describe("inferCategory", () => {
  it("infers document from .pdf", () => expect(inferCategory(".pdf")).toBe("document"));
  it("infers image from image/png", () => expect(inferCategory("image/png")).toBe("image"));
  it("infers data from .json", () => expect(inferCategory(".json")).toBe("data"));
  it("infers proof from .proof", () => expect(inferCategory(".proof")).toBe("proof"));
  it("infers transaction from .tx", () => expect(inferCategory(".tx")).toBe("transaction"));
  it("infers archive from .zip", () => expect(inferCategory(".zip")).toBe("archive"));
  it("falls back to other for unknown extensions", () =>
    expect(inferCategory(".xyz")).toBe("other"));
});

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

describe("formatBytes", () => {
  it("formats bytes below 1 KB", () => expect(formatBytes(512)).toBe("512 B"));
  it("formats exact kilobytes without decimal", () => expect(formatBytes(122880)).toBe("120 KB"));
  it("formats fractional kilobytes with 1 decimal", () => expect(formatBytes(4301)).toBe("4.2 KB"));
  it("formats megabytes", () => expect(formatBytes(1048576)).toBe("1 MB"));
  it("formats fractional megabytes", () => expect(formatBytes(1572864)).toBe("1.5 MB"));
});

// ---------------------------------------------------------------------------
// categoryLabel
// ---------------------------------------------------------------------------

describe("categoryLabel", () => {
  it("returns a non-empty label for every category", () => {
    const categories = [
      "document",
      "image",
      "data",
      "proof",
      "transaction",
      "archive",
      "other",
    ] as const;
    for (const cat of categories) {
      expect(categoryLabel(cat).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// isValidAttachmentId
// ---------------------------------------------------------------------------

describe("isValidAttachmentId", () => {
  it("accepts valid att- slugs", () => {
    expect(isValidAttachmentId("att-invoice-1042")).toBe(true);
    expect(isValidAttachmentId("att-relay-spec")).toBe(true);
  });

  it("rejects ids without att- prefix", () => {
    expect(isValidAttachmentId("invoice-1042")).toBe(false);
    expect(isValidAttachmentId("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyDraftToRecord
// ---------------------------------------------------------------------------

describe("applyDraftToRecord", () => {
  it("merges id with draft into a full record", () => {
    const draft = { ...blankAttachmentDraft, fileName: "test.pdf", fileType: "PDF Document" };
    const record = applyDraftToRecord("att-test", draft);
    expect(record.id).toBe("att-test");
    expect(record.fileName).toBe("test.pdf");
  });
});

// ---------------------------------------------------------------------------
// formatAttachmentSummary
// ---------------------------------------------------------------------------

describe("formatAttachmentSummary", () => {
  it("produces a summary string containing file name, type, size, and sender", () => {
    const record = demoAttachmentRecords[0];
    const summary = formatAttachmentSummary(record);
    expect(summary).toContain(record.fileName);
    expect(summary).toContain(record.fileType);
    expect(summary).toContain(record.fileSize);
    expect(summary).toContain(record.sender);
  });
});

// ---------------------------------------------------------------------------
// sortAttachmentsByDate
// ---------------------------------------------------------------------------

describe("sortAttachmentsByDate", () => {
  it("sorts newest first", () => {
    const sorted = sortAttachmentsByDate(demoAttachmentRecords);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].receivedAt >= sorted[i + 1].receivedAt).toBe(true);
    }
  });

  it("does not mutate the original array", () => {
    const copy = [...demoAttachmentRecords];
    sortAttachmentsByDate(demoAttachmentRecords);
    expect(demoAttachmentRecords).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// filterAttachments
// ---------------------------------------------------------------------------

describe("filterAttachments", () => {
  it("returns all records for an empty query", () => {
    expect(filterAttachments(demoAttachmentRecords, "")).toHaveLength(demoAttachmentRecords.length);
  });

  it("filters by fileName (case-insensitive)", () => {
    const results = filterAttachments(demoAttachmentRecords, "INVOICE");
    expect(results.every((r) => r.fileName.toLowerCase().includes("invoice"))).toBe(true);
  });

  it("filters by sender", () => {
    const results = filterAttachments(demoAttachmentRecords, "billing@example.com");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.sender.includes("billing"))).toBe(true);
  });

  it("filters by description", () => {
    const results = filterAttachments(demoAttachmentRecords, "soroban");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty array when no match", () => {
    expect(filterAttachments(demoAttachmentRecords, "zzznomatch999")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// blankAttachmentDraft shape
// ---------------------------------------------------------------------------

describe("blankAttachmentDraft", () => {
  it("has all required AttachmentDraft keys", () => {
    const requiredKeys: (keyof typeof blankAttachmentDraft)[] = [
      "fileName",
      "fileSize",
      "fileSizeBytes",
      "fileType",
      "category",
      "messageSubject",
      "sender",
      "receivedAt",
    ];
    for (const key of requiredKeys) {
      expect(key in blankAttachmentDraft).toBe(true);
    }
  });

  it("uses a safe deterministic receivedAt timestamp", () => {
    // Must not be dynamic — must be a fixed ISO string.
    expect(blankAttachmentDraft.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });
});

// ---------------------------------------------------------------------------
// demoAttachmentRecords fixture integrity
// ---------------------------------------------------------------------------

describe("demoAttachmentRecords fixture", () => {
  it("all records have unique ids", () => {
    const ids = demoAttachmentRecords.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all ids match att- slug pattern", () => {
    for (const record of demoAttachmentRecords) {
      expect(isValidAttachmentId(record.id)).toBe(true);
    }
  });

  it("all senders use safe demo domains", () => {
    for (const record of demoAttachmentRecords) {
      expect(isSafeSenderAddress(record.sender)).toBe(
        true,
        `Unsafe sender in fixture record ${record.id}: ${record.sender}`,
      );
    }
  });

  it("all receivedAt values are valid ISO local timestamps", () => {
    const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
    for (const record of demoAttachmentRecords) {
      expect(ISO_PATTERN.test(record.receivedAt)).toBe(true);
    }
  });

  it("covers all AttachmentCategory values", () => {
    const categories = new Set(demoAttachmentRecords.map((r) => r.category));
    const expected = ["document", "image", "data", "proof", "transaction", "archive"];
    for (const cat of expected) {
      expect(categories.has(cat as never)).toBe(true);
    }
  });
});
