import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createSecurityFlaggingExecutor,
  executeSecurityFlagging,
  SecurityFlaggingErrorCode,
} from "../services/security-flagging-execution.service.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(
  await readFile(join(here, "..", "fixtures", "execution-contract-cases.json"), "utf8"),
);

function dependencies(mode = "normal") {
  const persisted = [];
  return {
    persisted,
    authorizeReporter: async () => {
      if (mode === "internal-failure") throw new Error("auth unavailable");
      return mode !== "unauthorized";
    },
    findActiveFlag: async () => (mode === "duplicate" ? "flag-existing-001" : null),
    persistFlag: async (record) => {
      if (mode === "persistence-failure") throw new Error("storage unavailable");
      persisted.push(record);
    },
    generateId: () => "flag-contract-001",
    now: () => new Date("2026-07-18T12:00:00.000Z"),
  };
}

test("error codes are stable and unique", () => {
  const codes = Object.values(SecurityFlaggingErrorCode);
  assert.equal(new Set(codes).size, codes.length);
  for (const [key, value] of Object.entries(SecurityFlaggingErrorCode)) assert.equal(key, value);
});

test("entry point normalizes, persists, and returns the success fixture", async () => {
  const deps = dependencies();
  const result = await executeSecurityFlagging(cases.success.input, deps);
  assert.deepEqual(result, { ok: true, data: cases.success.expected });
  assert.deepEqual(deps.persisted, [cases.success.expected]);
});

test("fixtures cover validation and service-boundary failures", async () => {
  for (const fixture of cases.failures) {
    const deps = dependencies(fixture.mode);
    const result = await createSecurityFlaggingExecutor(deps).execute({
      ...cases.success.input,
      ...fixture.override,
    });
    assert.equal(result.ok, false, fixture.name);
    assert.equal(result.error.code, fixture.expectedCode, fixture.name);
    if (fixture.expectedField) assert.equal(result.error.field, fixture.expectedField);
    assert.equal(deps.persisted.length, 0, fixture.name);
  }
});

test("duplicate failures expose the existing flag id", async () => {
  const result = await executeSecurityFlagging(cases.success.input, dependencies("duplicate"));
  assert.equal(result.ok, false);
  assert.equal(result.error.existingFlagId, "flag-existing-001");
});

test("missing dependencies are rejected during construction", () => {
  assert.throws(() => createSecurityFlaggingExecutor(), TypeError);
});
