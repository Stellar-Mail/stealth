import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  AccessValidationError,
  sanitizeRole,
  validateRole,
  validateAccessLevel,
  validateEmailAddress,
  validateThreadId,
  validateAccessRequest,
  checkAccess,
  guardTeamSize,
  guardAttachmentCount,
  LIMITS,
} from "../guards/access-guards.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-access-requests.json");

async function loadFixture() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

// --- sanitizeRole ---

test("sanitizeRole strips whitespace and lowercases", () => {
  assert.equal(sanitizeRole("  Admin  "), "admin");
});

test("sanitizeRole removes non-alphanumeric characters except _ and -", () => {
  assert.equal(sanitizeRole("admin; DROP TABLE"), "admindroptable");
});

test("sanitizeRole returns null for non-string input", () => {
  assert.equal(sanitizeRole(null), null);
  assert.equal(sanitizeRole(42), null);
});

// --- validateRole ---

test("validateRole accepts all allowed roles", () => {
  for (const role of LIMITS.ALLOWED_ROLES) {
    assert.equal(validateRole(role), role);
  }
});

test("validateRole throws for null and empty string", () => {
  assert.throws(() => validateRole(null), AccessValidationError);
  assert.throws(() => validateRole(""), AccessValidationError);
});

test("validateRole throws for unknown roles", () => {
  assert.throws(() => validateRole("superadmin"), AccessValidationError);
  assert.throws(() => validateRole("ADMIN"), AccessValidationError);
});

test("validateRole throws for oversized role string", () => {
  assert.throws(() => validateRole("a".repeat(LIMITS.MAX_ROLE_LENGTH + 1)), AccessValidationError);
});

// --- validateAccessLevel ---

test("validateAccessLevel accepts all allowed levels", () => {
  for (const level of LIMITS.ALLOWED_ACCESS_LEVELS) {
    assert.equal(validateAccessLevel(level), level);
  }
});

test("validateAccessLevel throws for unknown levels", () => {
  assert.throws(() => validateAccessLevel("superwrite"), AccessValidationError);
  assert.throws(() => validateAccessLevel("*"), AccessValidationError);
});

// --- validateEmailAddress ---

test("validateEmailAddress accepts well-formed addresses", () => {
  assert.equal(validateEmailAddress("alice@example.test"), "alice@example.test");
  assert.equal(validateEmailAddress("a+tag@sub.domain.test"), "a+tag@sub.domain.test");
});

test("validateEmailAddress throws for CRLF header injection", () => {
  assert.throws(
    () => validateEmailAddress("user@evil.test\r\nBcc: victim@example.test"),
    AccessValidationError,
  );
  assert.throws(
    () => validateEmailAddress("user@evil.test\nX-Injected: yes"),
    AccessValidationError,
  );
});

test("validateEmailAddress throws for null byte", () => {
  assert.throws(() => validateEmailAddress("user\0@evil.test"), AccessValidationError);
});

test("validateEmailAddress throws for missing local part or domain", () => {
  assert.throws(() => validateEmailAddress("@missinglocal.test"), AccessValidationError);
  assert.throws(() => validateEmailAddress("user@"), AccessValidationError);
  assert.throws(() => validateEmailAddress("nodomain"), AccessValidationError);
});

test("validateEmailAddress throws for empty string", () => {
  assert.throws(() => validateEmailAddress(""), AccessValidationError);
});

// --- validateThreadId ---

test("validateThreadId accepts alphanumeric IDs with _ and -", () => {
  assert.equal(validateThreadId("thread-support-001"), "thread-support-001");
  assert.equal(validateThreadId("THREAD_001"), "THREAD_001");
});

test("validateThreadId throws for path traversal", () => {
  assert.throws(() => validateThreadId("../../../secret"), AccessValidationError);
});

test("validateThreadId throws for spaces and special characters", () => {
  assert.throws(() => validateThreadId("thread 001"), AccessValidationError);
  assert.throws(() => validateThreadId("<script>alert(1)</script>"), AccessValidationError);
});

test("validateThreadId throws for oversized ID", () => {
  assert.throws(
    () => validateThreadId("a".repeat(LIMITS.MAX_THREAD_ID_LENGTH + 1)),
    AccessValidationError,
  );
});

// --- validateAccessRequest ---

test("validateAccessRequest passes a well-formed request", () => {
  assert.equal(
    validateAccessRequest({
      role: "manager",
      accessLevel: "assign",
      requesterEmail: "alice@example.test",
      threadId: "thread-001",
    }),
    true,
  );
});

test("validateAccessRequest throws for non-object input", () => {
  assert.throws(() => validateAccessRequest(null), AccessValidationError);
  assert.throws(() => validateAccessRequest("admin"), AccessValidationError);
  assert.throws(() => validateAccessRequest([]), AccessValidationError);
});

test("validateAccessRequest propagates field-level errors", () => {
  assert.throws(
    () =>
      validateAccessRequest({
        role: "ADMIN",
        accessLevel: "read",
        requesterEmail: "a@b.test",
        threadId: "t-001",
      }),
    AccessValidationError,
  );
});

// --- checkAccess ---

test("checkAccess grants access when policy allows it", async () => {
  const { policy } = await loadFixture();
  assert.equal(checkAccess("manager", "assign", policy), true);
  assert.equal(checkAccess("admin", "delete", policy), true);
  assert.equal(checkAccess("agent", "read", policy), true);
});

test("checkAccess denies access when policy does not allow it", async () => {
  const { policy } = await loadFixture();
  assert.equal(checkAccess("viewer", "write", policy), false);
  assert.equal(checkAccess("agent", "delete", policy), false);
  assert.equal(checkAccess("guest", "read", policy), false);
});

test("checkAccess returns false for unknown role in policy", async () => {
  const { policy } = await loadFixture();
  assert.equal(checkAccess("superadmin", "manage", policy), false);
});

// --- fixture: valid requests match policy ---

test("all fixture valid requests resolve correctly against the policy", async () => {
  const { validRequests, policy } = await loadFixture();
  for (const req of validRequests) {
    assert.doesNotThrow(() => validateAccessRequest(req), `${req.id} should pass validation`);
    const granted = checkAccess(req.role, req.accessLevel, policy);
    assert.equal(granted, req.expectGranted, `${req.id}: expected granted=${req.expectGranted}`);
  }
});

// --- fixture: hostile inputs are all rejected ---

test("all fixture hostile inputs are rejected by the appropriate guard", async () => {
  const { hostileInputs } = await loadFixture();
  const validators = {
    role: validateRole,
    accessLevel: validateAccessLevel,
    email: validateEmailAddress,
    threadId: validateThreadId,
  };
  for (const entry of hostileInputs) {
    const fn = validators[entry.field];
    assert.ok(fn, `no validator mapped for field "${entry.field}"`);
    assert.throws(
      () => fn(entry.value),
      AccessValidationError,
      `hostile input for ${entry.field} ("${entry.reason}") must throw AccessValidationError`,
    );
  }
});

// --- performance guards ---

test("guardTeamSize passes for arrays within the limit", () => {
  assert.equal(guardTeamSize(new Array(LIMITS.MAX_TEAM_SIZE).fill({})), true);
});

test("guardTeamSize throws when team exceeds the safe limit", () => {
  assert.throws(
    () => guardTeamSize(new Array(LIMITS.MAX_TEAM_SIZE + 1).fill({})),
    AccessValidationError,
  );
});

test("guardTeamSize throws for non-array input", () => {
  assert.throws(() => guardTeamSize(null), AccessValidationError);
});

test("guardAttachmentCount passes for arrays within the limit", () => {
  assert.equal(guardAttachmentCount(new Array(LIMITS.MAX_ATTACHMENT_COUNT).fill({})), true);
});

test("guardAttachmentCount throws when attachment count exceeds the safe limit", () => {
  assert.throws(
    () => guardAttachmentCount(new Array(LIMITS.MAX_ATTACHMENT_COUNT + 1).fill({})),
    AccessValidationError,
  );
});

test("guardAttachmentCount throws for non-array input", () => {
  assert.throws(() => guardAttachmentCount("not-an-array"), AccessValidationError);
});
