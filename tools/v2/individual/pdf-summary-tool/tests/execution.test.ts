import { describe, it, expect, beforeEach } from "vitest";
import { ExecutionService } from "../services/ExecutionService";
import type { ExecutionInput, ExecutionOutput } from "../types/execution";
import fixtures from "../fixtures/execution.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FixtureCase {
  name?: string;
  input: ExecutionInput;
  expectedOutput: {
    success: boolean;
    data?: Record<string, any>;
    dataShape?: Record<string, boolean>;
    error?: { code: string; message: string };
  };
}

// The sample content used by the SUMMARIZE_PDF success fixture (full settings).
const SAMPLE_CONTENT =
  "The quarterly financial report shows significant growth in revenue across all departments. " +
  "Operating expenses remained stable while profit margins improved by twelve percent compared " +
  "to the previous quarter. The marketing team achieved record customer acquisition rates. " +
  "Research and development investments continued to yield positive results with three new " +
  "product launches.";

let service: ExecutionService;

beforeEach(() => {
  service = new ExecutionService();
});

// ---------------------------------------------------------------------------
// Fixture-driven tests
// ---------------------------------------------------------------------------

describe("ExecutionService — success fixtures", () => {
  const cases = fixtures.successCases as FixtureCase[];

  for (const fixture of cases) {
    it(fixture.name ?? `succeeds for ${fixture.input.action}`, async () => {
      const result: ExecutionOutput = await service.execute(fixture.input as ExecutionInput);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // If the fixture specifies an exact data match, verify it
      if (fixture.expectedOutput.data) {
        expect(result.data).toEqual(fixture.expectedOutput.data);
      }

      // If the fixture specifies a shape check, verify structural properties
      if (fixture.expectedOutput.dataShape) {
        const shape = fixture.expectedOutput.dataShape;
        if (shape.hasSummary) {
          expect(result.data).toHaveProperty("summary");
          expect(result.data.summary).toHaveProperty("id");
          expect(result.data.summary).toHaveProperty("pdfId");
          expect(result.data.summary).toHaveProperty("content");
          expect(result.data.summary).toHaveProperty("settings");
          expect(result.data.summary).toHaveProperty("generatedAt");
        }
        if (shape.hasKeywords === true) {
          expect(result.data).toHaveProperty("keywords");
          expect(Array.isArray(result.data.keywords)).toBe(true);
          expect(result.data.keywords.length).toBeGreaterThan(0);
        }
        if (shape.hasKeywords === false) {
          expect(result.data.keywords).toBeUndefined();
        }
        if (shape.summaryHasBullets === true) {
          expect(result.data.summary.content).toContain("•");
        }
        if (shape.summaryHasBullets === false) {
          expect(result.data.summary.content).not.toContain("•");
        }
      }
    });
  }
});

describe("ExecutionService — failure fixtures", () => {
  const cases = fixtures.failureCases as FixtureCase[];

  for (const fixture of cases) {
    it(fixture.name ?? `fails for ${fixture.input.action}`, async () => {
      const result: ExecutionOutput = await service.execute(fixture.input as ExecutionInput);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(fixture.expectedOutput.error!.code);
      expect(result.error!.message).toBe(fixture.expectedOutput.error!.message);
    });
  }
});

// ---------------------------------------------------------------------------
// Targeted behavioural tests
// ---------------------------------------------------------------------------

describe("ExecutionService — determinism", () => {
  it("produces identical output for identical SUMMARIZE_PDF input", async () => {
    const input: ExecutionInput = {
      action: "SUMMARIZE_PDF",
      payload: {
        pdfContent: SAMPLE_CONTENT,
        fileName: "determinism-test.pdf",
        fileSizeBytes: 1024,
        settings: { length: "short", style: "paragraph", includeKeywords: false, language: "en" },
      },
    };

    const a = await service.execute(input);
    // Use a fresh instance to prove there's no cross-state leakage
    const freshService = new ExecutionService();
    const b = await freshService.execute(input);

    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(a.data.summary.content).toBe(b.data.summary.content);
    expect(a.data.summary.id).toBe(b.data.summary.id);
    expect(a.data.summary.pdfId).toBe(b.data.summary.pdfId);
    expect(a.data.summary.settings).toEqual(b.data.summary.settings);
  });
});

describe("ExecutionService — summary lifecycle", () => {
  it("create → get → list → delete → get (not found)", async () => {
    // 1. Create
    const createResult = await service.execute({
      action: "SUMMARIZE_PDF",
      payload: {
        pdfContent: SAMPLE_CONTENT,
        fileName: "lifecycle-test.pdf",
        fileSizeBytes: 2048,
      },
    });
    expect(createResult.success).toBe(true);
    const summaryId = createResult.data.summary.id;
    expect(typeof summaryId).toBe("string");

    // 2. Get — should find it
    const getResult = await service.execute({
      action: "GET_SUMMARY",
      payload: { summaryId },
    });
    expect(getResult.success).toBe(true);
    expect(getResult.data.summary.id).toBe(summaryId);
    expect(getResult.data.summary.content).toBe(createResult.data.summary.content);

    // 3. List — should contain exactly one
    const listResult = await service.execute({ action: "LIST_SUMMARIES" });
    expect(listResult.success).toBe(true);
    expect(listResult.data.count).toBe(1);
    expect(listResult.data.summaries).toHaveLength(1);
    expect(listResult.data.summaries[0].id).toBe(summaryId);

    // 4. Delete
    const deleteResult = await service.execute({
      action: "DELETE_SUMMARY",
      payload: { summaryId },
    });
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.data.deletedId).toBe(summaryId);

    // 5. Get again — should not find it
    const getAgain = await service.execute({
      action: "GET_SUMMARY",
      payload: { summaryId },
    });
    expect(getAgain.success).toBe(false);
    expect(getAgain.error!.code).toBe("SUMMARY_NOT_FOUND");
  });
});

describe("ExecutionService — keyword extraction", () => {
  it("returns keywords when includeKeywords is true", async () => {
    const result = await service.execute({
      action: "SUMMARIZE_PDF",
      payload: {
        pdfContent: SAMPLE_CONTENT,
        fileName: "keywords-test.pdf",
        fileSizeBytes: 1024,
        settings: { includeKeywords: true },
      },
    });
    expect(result.success).toBe(true);
    expect(result.data.keywords).toBeDefined();
    expect(Array.isArray(result.data.keywords)).toBe(true);
    expect(result.data.keywords.length).toBeGreaterThan(0);
    // Keywords should be lowercase strings
    for (const kw of result.data.keywords) {
      expect(typeof kw).toBe("string");
      expect(kw).toBe(kw.toLowerCase());
    }
  });

  it("omits keywords when includeKeywords is false", async () => {
    const result = await service.execute({
      action: "SUMMARIZE_PDF",
      payload: {
        pdfContent: SAMPLE_CONTENT,
        fileName: "no-keywords.pdf",
        fileSizeBytes: 1024,
        settings: { includeKeywords: false },
      },
    });
    expect(result.success).toBe(true);
    expect(result.data.keywords).toBeUndefined();
  });
});

describe("ExecutionService — summary settings", () => {
  it("applies default settings when none are provided", async () => {
    const result = await service.execute({
      action: "SUMMARIZE_PDF",
      payload: {
        pdfContent: SAMPLE_CONTENT,
        fileName: "defaults.pdf",
        fileSizeBytes: 1024,
      },
    });
    expect(result.success).toBe(true);
    expect(result.data.summary.settings).toEqual({
      length: "medium",
      style: "paragraph",
      includeKeywords: false,
      language: "en",
    });
  });

  it("merges partial settings with defaults", async () => {
    const result = await service.execute({
      action: "SUMMARIZE_PDF",
      payload: {
        pdfContent: SAMPLE_CONTENT,
        fileName: "partial.pdf",
        fileSizeBytes: 1024,
        settings: { length: "long" },
      },
    });
    expect(result.success).toBe(true);
    expect(result.data.summary.settings.length).toBe("long");
    expect(result.data.summary.settings.style).toBe("paragraph");
    expect(result.data.summary.settings.includeKeywords).toBe(false);
    expect(result.data.summary.settings.language).toBe("en");
  });

  it("formats as bullet points when style is bullet-points", async () => {
    const result = await service.execute({
      action: "SUMMARIZE_PDF",
      payload: {
        pdfContent: SAMPLE_CONTENT,
        fileName: "bullets.pdf",
        fileSizeBytes: 1024,
        settings: { style: "bullet-points" },
      },
    });
    expect(result.success).toBe(true);
    expect(result.data.summary.content).toContain("•");
  });
});

describe("ExecutionService — state isolation", () => {
  it("each instance starts with empty storage", async () => {
    // First instance: create a summary
    const s1 = new ExecutionService();
    await s1.execute({
      action: "SUMMARIZE_PDF",
      payload: {
        pdfContent: SAMPLE_CONTENT,
        fileName: "isolation.pdf",
        fileSizeBytes: 1024,
      },
    });
    const list1 = await s1.execute({ action: "LIST_SUMMARIES" });
    expect(list1.data.count).toBe(1);

    // Second instance: should be empty
    const s2 = new ExecutionService();
    const list2 = await s2.execute({ action: "LIST_SUMMARIES" });
    expect(list2.data.count).toBe(0);
  });
});
