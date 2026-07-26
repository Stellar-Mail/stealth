/**
 * Team Security Flagging — guard module tests
 * Run with: node --test tests/security-guards.test.mjs
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  SecurityGuardError,
  guardSecurityFlaggingInput,
  guardDedupBatchSize,
  guardAndValidate,
  LIMITS,
} from "../guards/security-guards.mjs";

// ---------------------------------------------------------------------------
// guardSecurityFlaggingInput
// ---------------------------------------------------------------------------

test("guardSecurityFlaggingInput accepts a valid plain object", () => {
  const input = { emailId: "e-001", severity: "high" };
  assert.equal(guardSecurityFlaggingInput(input), input);
});

test("guardSecurityFlaggingInput rejects null", () => {
  assert.throws(() => guardSecurityFlaggingInput(null), SecurityGuardError);
});

test("guardSecurityFlaggingInput rejects non-object types", () => {
  assert.throws(() => guardSecurityFlaggingInput("admin"), SecurityGuardError);
  assert.throws(() => guardSecurityFlaggingInput(42), SecurityGuardError);
  assert.throws(() => guardSecurityFlaggingInput(true), SecurityGuardError);
});

test("guardSecurityFlaggingInput rejects arrays", () => {
  assert.throws(() => guardSecurityFlaggingInput(["a", "b"]), SecurityGuardError);
  assert.throws(() => guardSecurityFlaggingInput([]), SecurityGuardError);
});

test("guardSecurityFlaggingInput rejects oversized payloads", () => {
  const large = { data: "x".repeat(LIMITS.MAX_BODY_BYTES) };
  assert.throws(() => guardSecurityFlaggingInput(large), SecurityGuardError);
});

test("guardSecurityFlaggingInput accepts payloads at the size boundary", () => {
  const boundary = { data: "x".repeat(LIMITS.MAX_BODY_BYTES - 20) };
  assert.doesNotThrow(() => guardSecurityFlaggingInput(boundary));
});

// ---------------------------------------------------------------------------
// guardDedupBatchSize
// ---------------------------------------------------------------------------

test("guardDedupBatchSize accepts an array within limits", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ emailId: `e-${i}` }));
  assert.equal(guardDedupBatchSize(items), true);
});

test("guardDedupBatchSize rejects non-array input", () => {
  assert.throws(() => guardDedupBatchSize(null), SecurityGuardError);
  assert.throws(() => guardDedupBatchSize("items"), SecurityGuardError);
});

test("guardDedupBatchSize rejects oversized batch", () => {
  const items = Array.from({ length: LIMITS.MAX_DEDUP_BATCH_SIZE + 1 }, (_, i) => `id-${i}`);
  assert.throws(() => guardDedupBatchSize(items), SecurityGuardError);
});

test("guardDedupBatchSize accepts batch at the limit boundary", () => {
  const items = Array.from({ length: LIMITS.MAX_DEDUP_BATCH_SIZE }, (_, i) => `id-${i}`);
  assert.doesNotThrow(() => guardDedupBatchSize(items));
});

// ---------------------------------------------------------------------------
// guardAndValidate
// ---------------------------------------------------------------------------

test("guardAndValidate runs pre-check then field validation on valid input", () => {
  let called = false;
  const result = guardAndValidate({ emailId: "e-001" }, () => {
    called = true;
    return true;
  });
  assert.equal(called, true);
  assert.deepEqual(result, { emailId: "e-001" });
});

test("guardAndValidate rejects null input before calling validators", () => {
  let called = false;
  assert.throws(
    () =>
      guardAndValidate(null, () => {
        called = true;
        return true;
      }),
    SecurityGuardError,
  );
  assert.equal(called, false);
});

test("guardAndValidate propagates field validation errors", () => {
  assert.throws(
    () =>
      guardAndValidate({ emailId: "e-001", severity: "CRITICAL" }, () => {
        throw new Error("Field error");
      }),
    Error,
  );
});

// ---------------------------------------------------------------------------
// LIMITS are frozen and stable
// ---------------------------------------------------------------------------

test("guard LIMITS object is frozen", () => {
  assert.throws(() => {
    LIMITS.MAX_BODY_BYTES = 999;
  });
});

test("guard LIMITS have expected stable values", () => {
  assert.equal(LIMITS.MAX_BODY_BYTES, 65536);
  assert.equal(LIMITS.MAX_CALLS_PER_WINDOW, 100);
  assert.equal(LIMITS.MAX_DEDUP_BATCH_SIZE, 500);
});
