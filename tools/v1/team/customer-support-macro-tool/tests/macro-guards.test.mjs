import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MACRO_GUARD_LIMITS,
  MacroGuardError,
  guardAttachmentMetadata,
  guardHistoryWindow,
  guardMacroBatch,
  guardSearchOptions,
  sanitizeMacroInput,
  sanitizeMacroText,
  sanitizeStoredMacro,
  validateMacroCategory,
  validateMacroId,
  validateTags,
  validateVariableMap,
} from "../guards/macro-guards.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(currentDir, "..", "fixtures", "hostile-macro-inputs.json"), "utf8"),
);

const baseMacro = fixture.validMacro;

function assertGuardError(fn, field) {
  assert.throws(
    fn,
    (error) => error instanceof MacroGuardError && error.field === field,
    `expected MacroGuardError for ${field}`,
  );
}

describe("Customer Support Macro guards - text sanitization", () => {
  for (const entry of fixture.sanitizationCases) {
    it(`sanitizes ${entry.field}`, () => {
      assert.equal(sanitizeMacroText(entry.input), entry.expected);
    });
  }

  it("returns an empty string for non-string text", () => {
    assert.equal(sanitizeMacroText(null), "");
    assert.equal(sanitizeMacroText(42), "");
  });

  it("truncates text to the provided limit", () => {
    assert.equal(sanitizeMacroText("abcdef", 3), "abc");
  });
});

describe("Customer Support Macro guards - field validators", () => {
  it("accepts safe macro ids", () => {
    assert.equal(validateMacroId("macro_safe-001"), "macro_safe-001");
  });

  it("rejects path-like ids", () => {
    assertGuardError(() => validateMacroId("../../macros"), "id");
  });

  it("accepts allowlisted categories", () => {
    assert.equal(validateMacroCategory("refund"), "refund");
    assert.equal(validateMacroCategory("technical"), "technical");
  });

  it("rejects unsupported categories", () => {
    assertGuardError(() => validateMacroCategory("live-inbox"), "category");
  });

  it("normalizes safe tags", () => {
    assert.deepEqual(validateTags([" Billing ", "<b>Urgent</b>"]), ["billing", "urgent"]);
  });

  it("rejects too many tags", () => {
    const tags = Array.from({ length: MACRO_GUARD_LIMITS.MAX_TAG_COUNT + 1 }, (_, index) => {
      return `tag-${index}`;
    });
    assertGuardError(() => validateTags(tags), "tags");
  });
});

describe("Customer Support Macro guards - macro input", () => {
  it("returns a sanitized copy without mutating input", () => {
    const input = {
      title: " <b>Refund</b>\u0000 update ",
      body: "Hi\u200b {{customer_name}}, refund approved.",
      category: "refund",
      tags: [" Billing "],
    };

    const sanitized = sanitizeMacroInput(input);
    assert.equal(sanitized.title, "Refund update");
    assert.equal(sanitized.body, "Hi {{customer_name}}, refund approved.");
    assert.deepEqual(sanitized.tags, ["billing"]);
    assert.equal(input.title, " <b>Refund</b>\u0000 update ");
  });

  for (const entry of fixture.hostileMacros) {
    it(`rejects ${entry.id}: ${entry.reason}`, () => {
      assertGuardError(() => sanitizeStoredMacro({ ...baseMacro, ...entry.patch }), entry.field);
    });
  }

  it("rejects non-object macro input", () => {
    assertGuardError(() => sanitizeMacroInput(null), "input");
    assertGuardError(() => sanitizeMacroInput([]), "input");
  });

  it("guards and sanitizes a bounded macro batch", () => {
    const result = guardMacroBatch([baseMacro]);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, baseMacro.id);
    assert.deepEqual(result[0].tags, ["refund", "status"]);
  });

  it("rejects oversized macro batches before scanning", () => {
    const macros = Array.from(
      { length: MACRO_GUARD_LIMITS.MAX_MACRO_BATCH_SIZE + 1 },
      (_, index) => ({
        ...baseMacro,
        id: `macro_${index}`,
      }),
    );

    assertGuardError(() => guardMacroBatch(macros), "macros");
  });
});

describe("Customer Support Macro guards - variables and search", () => {
  it("sanitizes variable values", () => {
    const variables = validateVariableMap(fixture.validVariables);
    assert.equal(variables.customer_name, "Avery Stone");
    assert.equal(variables.order_id, "ORD-123");
  });

  it("rejects invalid variable names", () => {
    assertGuardError(() => validateVariableMap({ "../customer": "Avery" }), "variables");
  });

  it("rejects too many variables", () => {
    const variables = Object.fromEntries(
      Array.from({ length: MACRO_GUARD_LIMITS.MAX_VARIABLE_COUNT + 1 }, (_, index) => [
        `var_${index}`,
        "value",
      ]),
    );
    assertGuardError(() => validateVariableMap(variables), "variables");
  });

  it("guards search options", () => {
    const options = guardSearchOptions({
      query: "<b>refund</b>\u0000",
      category: "refund",
      tags: [" Billing "],
      favoritesOnly: true,
    });

    assert.equal(options.query, "refund");
    assert.equal(options.category, "refund");
    assert.deepEqual(options.tags, ["billing"]);
    assert.equal(options.favoritesOnly, true);
  });
});

describe("Customer Support Macro guards - collection limits", () => {
  it("rejects attachment content and accepts metadata", () => {
    const metadata = guardAttachmentMetadata([
      {
        name: fixture.sanitizationCases[2].input,
        sizeBytes: 1024,
      },
    ]);

    assert.equal(metadata[0].name, fixture.sanitizationCases[2].expected);
    assertGuardError(
      () => guardAttachmentMetadata([{ name: "macro.csv", sizeBytes: 10, content: "raw" }]),
      "attachments",
    );
  });

  it("rejects oversized attachment lists", () => {
    const attachments = Array.from(
      { length: MACRO_GUARD_LIMITS.MAX_ATTACHMENT_COUNT + 1 },
      (_, index) => ({
        name: `file-${index}.csv`,
        sizeBytes: 100,
      }),
    );

    assertGuardError(() => guardAttachmentMetadata(attachments), "attachments");
  });

  it("rejects oversized history windows", () => {
    const history = Array.from(
      { length: MACRO_GUARD_LIMITS.MAX_HISTORY_EVENTS + 1 },
      (_, index) => ({
        id: `event-${index}`,
      }),
    );

    assertGuardError(() => guardHistoryWindow(history), "history");
  });
});
