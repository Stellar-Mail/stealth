import { describe, expect, it } from "vitest";
import { messageTemplates } from "../templates/messageTemplates";
import { groupByCategory, searchTemplates } from "../templates/templateSearch";

describe("searchTemplates", () => {
  it("returns every template for an empty query", () => {
    expect(searchTemplates(messageTemplates, "")).toEqual(messageTemplates);
    expect(searchTemplates(messageTemplates, "   ")).toEqual(messageTemplates);
  });

  it("matches case-insensitively across name, subject, and tags", () => {
    expect(searchTemplates(messageTemplates, "WELCOME").length).toBeGreaterThan(0);
    expect(searchTemplates(messageTemplates, "otp").map((t) => t.id)).toContain("verify-code");
    expect(searchTemplates(messageTemplates, "postage").map((t) => t.id)).toContain(
      "postage-receipt",
    );
  });

  it("ranks name matches above tag/description matches", () => {
    const results = searchTemplates(messageTemplates, "receipt");
    // "Postage receipt" (name hit) should outrank "Delivery proof" (tag hit).
    expect(results[0].id).toBe("postage-receipt");
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchTemplates(messageTemplates, "zzzznomatch")).toEqual([]);
  });
});

describe("groupByCategory", () => {
  it("groups templates without dropping any", () => {
    const groups = groupByCategory(messageTemplates);
    const total = groups.reduce((sum, group) => sum + group.templates.length, 0);
    expect(total).toBe(messageTemplates.length);
  });
});
