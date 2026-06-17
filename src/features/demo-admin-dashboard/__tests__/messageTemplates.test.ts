import { describe, expect, it } from "vitest";
import { messageTemplates } from "../templates/messageTemplates";

describe("messageTemplates fixtures", () => {
  it("have unique ids", () => {
    const ids = messageTemplates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("have non-empty required fields", () => {
    for (const template of messageTemplates) {
      expect(template.name.trim()).not.toBe("");
      expect(template.subject.trim()).not.toBe("");
      expect(template.body.trim()).not.toBe("");
      expect(template.recipients.length).toBeGreaterThan(0);
    }
  });

  it("use only safe, fake demo recipients", () => {
    // Guard against real addresses leaking into the public repo.
    for (const template of messageTemplates) {
      for (const recipient of template.recipients) {
        expect(recipient).toMatch(/(\*stealth\.demo|@example\.(com|org))$/);
      }
    }
  });

  it("includes an internal campaign review template for admin note scenarios", () => {
    const internalTemplate = messageTemplates.find(
      (template) => template.id === "campaign-review-note",
    );
    expect(internalTemplate).toBeDefined();
    expect(internalTemplate?.category).toBe("internal");
    expect(internalTemplate?.tags).toContain("campaign");
    expect(internalTemplate?.subject.toLowerCase()).toContain("internal");
  });
});
