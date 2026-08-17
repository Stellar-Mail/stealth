import { describe, expect, it } from "vitest";
import { mapImportedDataset, parseDatasetImport } from "../helpers/datasetImport";
import { DATASET_EXPORT_SCHEMA_VERSION } from "../types/datasetExport";

const validPayload = {
  version: DATASET_EXPORT_SCHEMA_VERSION,
  count: 2,
  drafts: [
    {
      id: "draft-001",
      subject: "Welcome",
      body: "Deterministic demo body.",
      recipients: ["ada@example.com"],
    },
    {
      id: "draft-002",
      subject: "Receipt",
      body: "Second deterministic body.",
      recipients: ["grace@example.org", "linus*stealth.demo"],
    },
  ],
};

describe("mapImportedDataset", () => {
  it("accepts a valid, safe payload and returns normalized drafts", () => {
    const result = mapImportedDataset(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.drafts).toHaveLength(2);
      expect(result.drafts[0]).toEqual({
        id: "draft-001",
        subject: "Welcome",
        body: "Deterministic demo body.",
        recipients: ["ada@example.com"],
      });
    }
  });

  it("strips unknown fields from imported drafts", () => {
    const result = mapImportedDataset({
      ...validPayload,
      count: 1,
      drafts: [{ ...validPayload.drafts[0], secret: "leak", extra: 1 }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.drafts[0])).toEqual(["id", "subject", "body", "recipients"]);
    }
  });

  it("rejects an unsupported schema version", () => {
    const result = mapImportedDataset({ ...validPayload, version: 999 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path === "version")).toBe(true);
    }
  });

  it("rejects unsafe recipient addresses", () => {
    const result = mapImportedDataset({
      version: DATASET_EXPORT_SCHEMA_VERSION,
      count: 1,
      drafts: [
        { id: "draft-x", subject: "Bad", body: "Body", recipients: ["real.person@gmail.com"] },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].path).toBe("drafts[0].recipients[0]");
    }
  });

  it("rejects duplicate draft ids", () => {
    const result = mapImportedDataset({
      version: DATASET_EXPORT_SCHEMA_VERSION,
      count: 2,
      drafts: [validPayload.drafts[0], validPayload.drafts[0]],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.message.includes("Duplicate"))).toBe(true);
    }
  });

  it("flags a count that does not match drafts length", () => {
    const result = mapImportedDataset({ ...validPayload, count: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path === "count")).toBe(true);
    }
  });
});

describe("parseDatasetImport", () => {
  it("parses a valid JSON string", () => {
    const result = parseDatasetImport(JSON.stringify(validPayload));
    expect(result.ok).toBe(true);
  });

  it("reports invalid JSON as an issue instead of throwing", () => {
    const result = parseDatasetImport("{ not json ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0].message).toContain("not valid JSON");
    }
  });
});
