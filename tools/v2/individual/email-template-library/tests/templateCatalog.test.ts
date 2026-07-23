import { describe, expect, it } from "vitest";

import type { EmailTemplate } from "../types";
import { validateTemplateCatalog } from "../services/templateCatalog";

function template(id: string, overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id,
    name: `Template ${id}`,
    categoryId: null,
    subject: "Subject",
    body: "Body {{x}}",
    variables: [{ key: "x", label: "X" }],
    ...overrides,
  };
}

describe("validateTemplateCatalog (#490)", () => {
  it("accepts a clean catalog", () => {
    const result = validateTemplateCatalog([template("a"), template("b")]);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("flags duplicate template ids", () => {
    const result = validateTemplateCatalog([template("a"), template("a")]);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DUPLICATE_TEMPLATE_ID", templateId: "a" }),
      ]),
    );
  });

  it("flags duplicate variable keys within a template", () => {
    const t = template("a", {
      variables: [
        { key: "x", label: "X" },
        { key: "x", label: "X again" },
      ],
    });
    const result = validateTemplateCatalog([t]);
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.code === "DUPLICATE_VARIABLE_KEY" && i.templateId === "a"),
    ).toBe(true);
  });

  it("flags invalid variable key identifiers", () => {
    const t = template("a", { variables: [{ key: "1bad", label: "Bad" }] });
    const result = validateTemplateCatalog([t]);
    expect(
      result.issues.some(
        (i) => i.code === "DUPLICATE_VARIABLE_KEY" && /not a valid identifier/.test(i.message),
      ),
    ).toBe(true);
  });

  it("flags unknown category references when categories are provided", () => {
    const t = template("a", { categoryId: "missing" });
    const result = validateTemplateCatalog([t], new Set(["known"]));
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNKNOWN_CATEGORY", templateId: "a" }),
      ]),
    );
  });

  it("skips category checks when no known categories are supplied", () => {
    const t = template("a", { categoryId: "anything" });
    const result = validateTemplateCatalog([t]);
    expect(result.issues.every((i) => i.code !== "UNKNOWN_CATEGORY")).toBe(true);
  });

  it("is deterministic for the same input", () => {
    const catalog = [
      template("a"),
      template("a", {
        variables: [
          { key: "x", label: "X" },
          { key: "x", label: "Y" },
        ],
      }),
    ];
    expect(validateTemplateCatalog(catalog)).toEqual(validateTemplateCatalog(catalog));
  });
});
