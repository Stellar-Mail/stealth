import { describe, expect, it } from "vitest";
import type { Draft } from "../types/draft";
import { draftDatasetSample } from "../fixtures/draftDatasetFixtures";
import { DATASET_EXPORT_SCHEMA_VERSION } from "../types/datasetExport";
import {
  buildDatasetExport,
  buildExportFilename,
  serializeDraftDataset,
  serializeDraftDatasetState,
} from "../helpers/datasetExport";

describe("dataset JSON export", () => {
  it("builds an envelope with version, count, and drafts", () => {
    const result = buildDatasetExport(draftDatasetSample);
    expect(result.version).toBe(DATASET_EXPORT_SCHEMA_VERSION);
    expect(result.count).toBe(draftDatasetSample.length);
    expect(result.drafts).toHaveLength(draftDatasetSample.length);
    expect(result.drafts[0]?.id).toBe("draft-dataset-001");
  });

  it("serializes deterministic, pretty JSON ending in a newline", () => {
    const json = serializeDraftDataset(draftDatasetSample);
    expect(json.endsWith("\n")).toBe(true);
    expect(json).toContain('"version": 1');
    expect(serializeDraftDataset(draftDatasetSample)).toBe(json);
    const parsed = JSON.parse(json);
    expect(parsed.count).toBe(draftDatasetSample.length);
    expect(parsed.drafts).toHaveLength(draftDatasetSample.length);
  });

  it("normalizes drafts to only the known fields", () => {
    const messy = [
      {
        id: "x1",
        subject: "Hi",
        body: "There",
        recipients: ["a@example.com"],
        secret: "should-not-export",
      },
    ] as unknown as Draft[];
    const parsed = JSON.parse(serializeDraftDataset(messy));
    expect(Object.keys(parsed.drafts[0]).sort()).toEqual(["body", "id", "recipients", "subject"]);
  });

  it("handles an empty dataset", () => {
    const parsed = JSON.parse(serializeDraftDataset([]));
    expect(parsed.count).toBe(0);
    expect(parsed.drafts).toEqual([]);
  });

  it("serializes from dataset state", () => {
    const json = serializeDraftDatasetState({
      drafts: draftDatasetSample,
      selectedId: null,
    });
    expect(JSON.parse(json).count).toBe(draftDatasetSample.length);
  });

  it("builds a UTC-dated filename", () => {
    const date = new Date("2026-06-18T23:30:00Z");
    expect(buildExportFilename(date)).toBe("draft-dataset-export-2026-06-18.json");
  });

  it("supports a custom filename prefix", () => {
    const date = new Date("2026-01-05T00:00:00Z");
    expect(buildExportFilename(date, "demo-drafts")).toBe("demo-drafts-2026-01-05.json");
  });
});
