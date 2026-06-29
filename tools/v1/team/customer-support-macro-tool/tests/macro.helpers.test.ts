/**
 * Customer Support Macro Tool
 * Unit tests: macro.service.ts — helper, date-sort, and validation branches.
 *
 * Run from repo root:
 *   npx vitest run tools/v1/team/customer-support-macro-tool/tests
 *
 * Complements macro.service.test.ts by covering the id/timestamp helpers, the
 * createdAt/updatedAt sort keys, the tag/category update branches, and the
 * unknown-category validation branch. Fully isolated: no DOM, no React, no
 * network.
 */

import { describe, expect, it } from "vitest";
import {
  generateMacroId,
  interpolateMacro,
  now,
  sortMacros,
  updateMacro,
  validateMacroInput,
  type Macro,
  type MacroCategory,
} from "../services/macro.service";

function makeMacro(overrides: Partial<Macro> = {}): Macro {
  return {
    id: "macro_test",
    title: "Test macro",
    body: "Body",
    category: "general",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    usageCount: 0,
    isFavorite: false,
    ...overrides,
  };
}

describe("generateMacroId", () => {
  it('returns an id prefixed with "macro_"', () => {
    expect(generateMacroId()).toMatch(/^macro_/);
  });

  it("returns a different id on each call", () => {
    expect(generateMacroId()).not.toBe(generateMacroId());
  });
});

describe("now", () => {
  it("returns a parseable ISO-8601 timestamp", () => {
    const ts = now();
    expect(Number.isNaN(new Date(ts).getTime())).toBe(false);
  });

  it("round-trips through Date without changing", () => {
    const ts = now();
    expect(new Date(ts).toISOString()).toBe(ts);
  });
});

describe("updateMacro — tag and category branches", () => {
  it("normalises updated tags to lowercase and trims them", () => {
    const updated = updateMacro(makeMacro(), { tags: [" Billing ", "URGENT"] });
    expect(updated.tags).toEqual(["billing", "urgent"]);
  });

  it("applies a category change", () => {
    const updated = updateMacro(makeMacro(), { category: "refund" });
    expect(updated.category).toBe("refund");
  });

  it("leaves tags untouched when not provided", () => {
    const base = makeMacro({ tags: ["keep"] });
    const updated = updateMacro(base, { title: "New" });
    expect(updated.tags).toEqual(["keep"]);
  });
});

describe("sortMacros — date keys", () => {
  const older = makeMacro({
    id: "a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const newer = makeMacro({
    id: "b",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  });
  const list = [newer, older];

  it("sorts by createdAt ascending", () => {
    expect(sortMacros(list, "createdAt", "asc").map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("sorts by createdAt descending", () => {
    expect(sortMacros(list, "createdAt", "desc").map((m) => m.id)).toEqual(["b", "a"]);
  });

  it("sorts by updatedAt ascending", () => {
    expect(sortMacros(list, "updatedAt", "asc").map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the original array", () => {
    const original = [...list];
    sortMacros(list, "updatedAt", "desc");
    expect(list).toEqual(original);
  });
});

describe("validateMacroInput — category branch", () => {
  it("flags an unknown category", () => {
    const errors = validateMacroInput({
      title: "T",
      body: "B",
      category: "mystery" as MacroCategory,
    });
    expect(errors.some((e) => e.field === "category")).toBe(true);
  });

  it("accepts a known category", () => {
    const errors = validateMacroInput({
      title: "T",
      body: "B",
      category: "shipping",
    });
    expect(errors.some((e) => e.field === "category")).toBe(false);
  });
});

describe("interpolateMacro — underscored and numeric variable names", () => {
  it("replaces variable names containing digits and underscores", () => {
    const result = interpolateMacro("Order {{order_id_2}} confirmed.", {
      order_id_2: "A-42",
    });
    expect(result).toBe("Order A-42 confirmed.");
  });
});
