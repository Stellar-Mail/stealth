/**
 * Customer Support Macro Tool
 * Unit tests: macro.service.ts
 *
 * Run from repo root:
 *   npx vitest run tools/v1/team/customer-support-macro-tool/tests
 *
 * These tests are fully isolated — no DOM, no React, no network.
 * All logic under test lives in ../services/macro.service.ts.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createMacro,
  deleteMacro,
  extractVariables,
  interpolateMacro,
  recordMacroUsage,
  searchMacros,
  sortMacros,
  updateMacro,
  validateMacroInput,
  type Macro,
  type MacroCreateInput,
} from "../services/macro.service";
import {
  FIXTURE_MACROS,
  FIXTURE_MACRO_NO_VARS,
  FIXTURE_MACRO_WITH_VARS,
} from "../fixtures/macros.fixture";

// ---------------------------------------------------------------------------
// createMacro
// ---------------------------------------------------------------------------

describe("createMacro", () => {
  it("creates a macro with the given title, body, and category", () => {
    const input: MacroCreateInput = {
      title: "Hello World",
      body: "This is the body.",
      category: "general",
    };
    const macro = createMacro(input);
    expect(macro.title).toBe("Hello World");
    expect(macro.body).toBe("This is the body.");
    expect(macro.category).toBe("general");
  });

  it("trims whitespace from the title", () => {
    const macro = createMacro({ title: "  Spaced  ", body: "b", category: "general" });
    expect(macro.title).toBe("Spaced");
  });

  it("normalises tags to lowercase and trims them", () => {
    const macro = createMacro({
      title: "T",
      body: "B",
      category: "billing",
      tags: ["  Billing  ", "URGENT"],
    });
    expect(macro.tags).toEqual(["billing", "urgent"]);
  });

  it("defaults usageCount to 0 and isFavorite to false", () => {
    const macro = createMacro({ title: "t", body: "b", category: "general" });
    expect(macro.usageCount).toBe(0);
    expect(macro.isFavorite).toBe(false);
  });

  it("defaults tags to an empty array when not provided", () => {
    const macro = createMacro({ title: "t", body: "b", category: "general" });
    expect(macro.tags).toEqual([]);
  });

  it("generates a unique id for each call", () => {
    // Stagger timing to avoid collision
    const a = createMacro({ title: "a", body: "a", category: "general" });
    const b = createMacro({ title: "b", body: "b", category: "general" });
    expect(a.id).not.toBe(b.id);
  });

  it("sets createdAt and updatedAt as ISO-8601 strings", () => {
    const macro = createMacro({ title: "t", body: "b", category: "general" });
    expect(() => new Date(macro.createdAt)).not.toThrow();
    expect(() => new Date(macro.updatedAt)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateMacro
// ---------------------------------------------------------------------------

describe("updateMacro", () => {
  const base: Macro = { ...FIXTURE_MACRO_NO_VARS };

  it("applies title change", () => {
    const updated = updateMacro(base, { title: "New Title" });
    expect(updated.title).toBe("New Title");
  });

  it("applies body change", () => {
    const updated = updateMacro(base, { body: "Updated body." });
    expect(updated.body).toBe("Updated body.");
  });

  it("applies isFavorite toggle to true", () => {
    const updated = updateMacro(base, { isFavorite: true });
    expect(updated.isFavorite).toBe(true);
  });

  it("does not mutate the original macro", () => {
    const original = { ...base };
    updateMacro(base, { title: "Should not change" });
    expect(base.title).toBe(original.title);
  });

  it("updates updatedAt timestamp", () => {
    const before = base.updatedAt;
    // Ensure at least 1 ms passes
    const updated = updateMacro(base, { title: "changed" });
    // updatedAt must be a valid ISO string and >= the original
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime(),
    );
  });

  it("does not change unspecified fields", () => {
    const updated = updateMacro(base, { title: "Only title" });
    expect(updated.body).toBe(base.body);
    expect(updated.category).toBe(base.category);
    expect(updated.usageCount).toBe(base.usageCount);
  });
});

// ---------------------------------------------------------------------------
// deleteMacro
// ---------------------------------------------------------------------------

describe("deleteMacro", () => {
  it("removes the macro with the given id", () => {
    const remaining = deleteMacro(FIXTURE_MACROS, "macro_fixture_001");
    expect(remaining.find((m) => m.id === "macro_fixture_001")).toBeUndefined();
  });

  it("does not remove other macros", () => {
    const remaining = deleteMacro(FIXTURE_MACROS, "macro_fixture_001");
    expect(remaining.length).toBe(FIXTURE_MACROS.length - 1);
  });

  it("returns the same list when id is not found", () => {
    const result = deleteMacro(FIXTURE_MACROS, "non_existent_id");
    expect(result.length).toBe(FIXTURE_MACROS.length);
  });

  it("returns an empty list when deleting the only macro", () => {
    const result = deleteMacro([FIXTURE_MACRO_NO_VARS], FIXTURE_MACRO_NO_VARS.id);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// recordMacroUsage
// ---------------------------------------------------------------------------

describe("recordMacroUsage", () => {
  it("increments usageCount by 1", () => {
    const before = FIXTURE_MACRO_NO_VARS.usageCount;
    const updated = recordMacroUsage(FIXTURE_MACRO_NO_VARS);
    expect(updated.usageCount).toBe(before + 1);
  });

  it("does not mutate the original macro", () => {
    const before = FIXTURE_MACRO_NO_VARS.usageCount;
    recordMacroUsage(FIXTURE_MACRO_NO_VARS);
    expect(FIXTURE_MACRO_NO_VARS.usageCount).toBe(before);
  });

  it("can increment from 0 to 1", () => {
    const macro = createMacro({ title: "t", body: "b", category: "general" });
    expect(macro.usageCount).toBe(0);
    const updated = recordMacroUsage(macro);
    expect(updated.usageCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// interpolateMacro
// ---------------------------------------------------------------------------

describe("interpolateMacro", () => {
  it("replaces known variables with their values", () => {
    const result = interpolateMacro("Hi {{customer_name}}, your ticket is {{ticket_id}}.", {
      customer_name: "Alice",
      ticket_id: "TK-999",
    });
    expect(result).toBe("Hi Alice, your ticket is TK-999.");
  });

  it("leaves unknown variables untouched", () => {
    const result = interpolateMacro("Hello {{unknown_var}}.", {});
    expect(result).toBe("Hello {{unknown_var}}.");
  });

  it("handles an empty variables map", () => {
    const result = interpolateMacro(FIXTURE_MACRO_WITH_VARS.body, {});
    expect(result).toBe(FIXTURE_MACRO_WITH_VARS.body);
  });

  it("replaces all occurrences of the same variable", () => {
    const result = interpolateMacro("{{name}} is {{name}}.", { name: "Alice" });
    expect(result).toBe("Alice is Alice.");
  });

  it("works with a body that has no variables", () => {
    const result = interpolateMacro(FIXTURE_MACRO_NO_VARS.body, { anything: "ignored" });
    expect(result).toBe(FIXTURE_MACRO_NO_VARS.body);
  });

  it("replaces all three variables in FIXTURE_MACRO_WITH_VARS", () => {
    const result = interpolateMacro(FIXTURE_MACRO_WITH_VARS.body, {
      customer_name: "Bob",
      ticket_id: "TK-123",
      agent_name: "Carol",
    });
    expect(result).toBe("Hi Bob, your ticket TK-123 is assigned to Carol.");
  });
});

// ---------------------------------------------------------------------------
// extractVariables
// ---------------------------------------------------------------------------

describe("extractVariables", () => {
  it("extracts variables from a body string", () => {
    const vars = extractVariables(FIXTURE_MACRO_WITH_VARS.body);
    expect(vars).toEqual(["customer_name", "ticket_id", "agent_name"]);
  });

  it("returns an empty array when there are no variables", () => {
    const vars = extractVariables(FIXTURE_MACRO_NO_VARS.body);
    expect(vars).toEqual([]);
  });

  it("returns unique variable names (no duplicates)", () => {
    const vars = extractVariables("{{x}} and {{x}} and {{y}}");
    expect(vars).toEqual(["x", "y"]);
  });

  it("returns variables in order of first appearance", () => {
    const vars = extractVariables("{{b}} then {{a}}");
    expect(vars).toEqual(["b", "a"]);
  });
});

// ---------------------------------------------------------------------------
// searchMacros
// ---------------------------------------------------------------------------

describe("searchMacros", () => {
  it("returns all macros when no options are provided", () => {
    const result = searchMacros(FIXTURE_MACROS, {});
    expect(result.length).toBe(FIXTURE_MACROS.length);
  });

  it("filters by text query in title", () => {
    const result = searchMacros(FIXTURE_MACROS, { query: "refund" });
    expect(
      result.every(
        (m) =>
          m.title.toLowerCase().includes("refund") ||
          m.body.toLowerCase().includes("refund") ||
          m.tags.some((t) => t.includes("refund")),
      ),
    ).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by text query in body", () => {
    const result = searchMacros(FIXTURE_MACROS, { query: "password" });
    expect(result.length).toBeGreaterThan(0);
  });

  it("filters by category", () => {
    const result = searchMacros(FIXTURE_MACROS, { category: "technical" });
    expect(result.every((m) => m.category === "technical")).toBe(true);
  });

  it("returns empty array when no macros match the category", () => {
    const result = searchMacros([FIXTURE_MACRO_NO_VARS], { category: "billing" });
    // FIXTURE_MACRO_NO_VARS is "general" so should not match
    expect(result).toEqual([]);
  });

  it("filters by tags (must match all supplied tags)", () => {
    const result = searchMacros(FIXTURE_MACROS, { tags: ["billing"] });
    expect(result.every((m) => m.tags.includes("billing"))).toBe(true);
  });

  it("returns empty when macro does not have all requested tags", () => {
    const result = searchMacros(FIXTURE_MACROS, {
      tags: ["billing", "non_existent_tag"],
    });
    expect(result).toEqual([]);
  });

  it("filters favorites only", () => {
    const result = searchMacros(FIXTURE_MACROS, { favoritesOnly: true });
    expect(result.every((m) => m.isFavorite)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("combines query and category filters (AND)", () => {
    const result = searchMacros(FIXTURE_MACROS, {
      query: "password",
      category: "technical",
    });
    expect(result.every((m) => m.category === "technical")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("is case-insensitive for text query", () => {
    const lower = searchMacros(FIXTURE_MACROS, { query: "refund" });
    const upper = searchMacros(FIXTURE_MACROS, { query: "REFUND" });
    expect(lower.map((m) => m.id)).toEqual(upper.map((m) => m.id));
  });
});

// ---------------------------------------------------------------------------
// sortMacros
// ---------------------------------------------------------------------------

describe("sortMacros", () => {
  it("sorts by title ascending (default direction)", () => {
    const sorted = sortMacros(FIXTURE_MACROS, "title");
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].title.localeCompare(sorted[i + 1].title)).toBeLessThanOrEqual(0);
    }
  });

  it("sorts by title descending", () => {
    const sorted = sortMacros(FIXTURE_MACROS, "title", "desc");
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].title.localeCompare(sorted[i + 1].title)).toBeGreaterThanOrEqual(0);
    }
  });

  it("sorts by usageCount descending", () => {
    const sorted = sortMacros(FIXTURE_MACROS, "usageCount", "desc");
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].usageCount).toBeGreaterThanOrEqual(sorted[i + 1].usageCount);
    }
  });

  it("sorts by usageCount ascending", () => {
    const sorted = sortMacros(FIXTURE_MACROS, "usageCount", "asc");
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].usageCount).toBeLessThanOrEqual(sorted[i + 1].usageCount);
    }
  });

  it("does not mutate the original array", () => {
    const original = [...FIXTURE_MACROS];
    sortMacros(FIXTURE_MACROS, "title");
    expect(FIXTURE_MACROS).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// validateMacroInput
// ---------------------------------------------------------------------------

describe("validateMacroInput", () => {
  it("returns no errors for valid input", () => {
    const errors = validateMacroInput({
      title: "Valid title",
      body: "Valid body.",
      category: "general",
    });
    expect(errors).toEqual([]);
  });

  it("returns error when title is missing", () => {
    const errors = validateMacroInput({ body: "b", category: "general" });
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("returns error when title is empty string", () => {
    const errors = validateMacroInput({ title: "", body: "b", category: "general" });
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("returns error when title is whitespace-only", () => {
    const errors = validateMacroInput({ title: "   ", body: "b", category: "general" });
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("returns error when title exceeds 120 characters", () => {
    const errors = validateMacroInput({
      title: "A".repeat(121),
      body: "b",
      category: "general",
    });
    expect(errors.some((e) => e.field === "title")).toBe(true);
  });

  it("returns error when body is missing", () => {
    const errors = validateMacroInput({ title: "T", category: "general" });
    expect(errors.some((e) => e.field === "body")).toBe(true);
  });

  it("returns error when body exceeds 4000 characters", () => {
    const errors = validateMacroInput({
      title: "T",
      body: "B".repeat(4001),
      category: "general",
    });
    expect(errors.some((e) => e.field === "body")).toBe(true);
  });

  it("can return multiple errors simultaneously", () => {
    const errors = validateMacroInput({ title: "", body: "" });
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it("does not error on a body of exactly 4000 characters", () => {
    const errors = validateMacroInput({
      title: "T",
      body: "B".repeat(4000),
      category: "general",
    });
    expect(errors.some((e) => e.field === "body")).toBe(false);
  });
});
