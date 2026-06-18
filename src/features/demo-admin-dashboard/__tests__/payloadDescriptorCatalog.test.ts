import { describe, expect, it } from "vitest";
import {
  PAYLOAD_DESCRIPTOR_CATALOG,
  getPayloadDescriptorCatalog,
  getPayloadDescriptorsByKind,
} from "../fixtures/payloadDescriptorCatalog";

describe("payload descriptor catalog", () => {
  it("provides all required descriptor kinds", () => {
    const kinds = new Set(PAYLOAD_DESCRIPTOR_CATALOG.map((entry) => entry.kind));

    expect(kinds).toEqual(new Set(["pdf", "image", "text", "key", "encrypted"]));
  });

  it("keeps descriptors deterministic and safe for public review", () => {
    const catalog = getPayloadDescriptorCatalog();
    const byKind = getPayloadDescriptorsByKind();

    expect(catalog).toHaveLength(PAYLOAD_DESCRIPTOR_CATALOG.length);
    expect(catalog).toEqual(PAYLOAD_DESCRIPTOR_CATALOG);
    expect(Object.keys(byKind)).toEqual(["pdf", "image", "text", "key", "encrypted"]);

    for (const descriptor of catalog) {
      expect(descriptor.id.trim()).not.toBe("");
      expect(descriptor.label.trim()).not.toBe("");
      expect(descriptor.kind).toMatch(/^(pdf|image|text|key|encrypted)$/);
      expect(descriptor.fileName.trim()).not.toBe("");
      expect(descriptor.contentType.trim()).not.toBe("");
      expect(descriptor.summary.trim()).not.toBe("");
      expect(descriptor.samplePreview.trim()).not.toBe("");
      expect(descriptor.samplePreview).not.toContain("real ");
      expect(descriptor.samplePreview).not.toContain("private");
      expect(descriptor.samplePreview).not.toContain("secret");
    }
  });

  it("returns descriptors grouped by category", () => {
    const grouped = getPayloadDescriptorsByKind();

    expect(grouped.pdf).toHaveLength(2);
    expect(grouped.image).toHaveLength(2);
    expect(grouped.text).toHaveLength(2);
    expect(grouped.key).toHaveLength(2);
    expect(grouped.encrypted).toHaveLength(2);
  });
});
