/**
 * Team Security Flagging — executable tests
 * Run with: node --test tests/security-flagging.test.mjs
 * (Node 18+ required; no extra dependencies needed)
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  SecurityFlagError,
  LIMITS,
  sanitizeText,
  validateSeverity,
  validateCategory,
  validateStatus,
  validateEmail,
  validateThreadId,
  validateEmailId,
  validateDescription,
  validateEvidence,
  validateCreateFlagInput,
  classifyEmail,
  canTransition,
  validateStatusTransition,
  isMoreSevere,
  maxSeverity,
} from "../services/security-flagging.service.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dir, "..", "fixtures", "security-flag-cases.json");

async function loadFixtures() {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// sanitizeText
// ---------------------------------------------------------------------------

test("sanitizeText strips leading/trailing whitespace", () => {
  assert.equal(sanitizeText("  hello  "), "hello");
});

test("sanitizeText strips control characters", () => {
  assert.equal(sanitizeText("hello\x00world"), "helloworld");
  assert.equal(sanitizeText("line\x1Fbreak"), "linebreak");
});

test("sanitizeText returns null for non-string input", () => {
  assert.equal(sanitizeText(null), null);
  assert.equal(sanitizeText(42), null);
  assert.equal(sanitizeText({}), null);
});

// ---------------------------------------------------------------------------
// validateSeverity
// ---------------------------------------------------------------------------

test("validateSeverity accepts all allowed values", () => {
  for (const s of LIMITS.ALLOWED_SEVERITIES) {
    assert.equal(validateSeverity(s), s);
  }
});

test("validateSeverity throws for unknown value", () => {
  assert.throws(() => validateSeverity("extreme"), SecurityFlagError);
  assert.throws(() => validateSeverity("CRITICAL"), SecurityFlagError);
});

test("validateSeverity throws for empty and null", () => {
  assert.throws(() => validateSeverity(""), SecurityFlagError);
  assert.throws(() => validateSeverity(null), SecurityFlagError);
});

// ---------------------------------------------------------------------------
// validateCategory
// ---------------------------------------------------------------------------

test("validateCategory accepts all allowed values", () => {
  for (const c of LIMITS.ALLOWED_CATEGORIES) {
    assert.equal(validateCategory(c), c);
  }
});

test("validateCategory throws for unknown value", () => {
  assert.throws(() => validateCategory("hacking"), SecurityFlagError);
  assert.throws(() => validateCategory("Phishing"), SecurityFlagError);
});

// ---------------------------------------------------------------------------
// validateStatus
// ---------------------------------------------------------------------------

test("validateStatus accepts all allowed values", () => {
  for (const s of LIMITS.ALLOWED_STATUSES) {
    assert.equal(validateStatus(s), s);
  }
});

test("validateStatus throws for unknown value", () => {
  assert.throws(() => validateStatus("pending"), SecurityFlagError);
  assert.throws(() => validateStatus("RESOLVED"), SecurityFlagError);
});

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------

test("validateEmail accepts well-formed addresses", () => {
  assert.equal(validateEmail("alice@company.example"), "alice@company.example");
  assert.equal(validateEmail("a+tag@sub.domain.test"), "a+tag@sub.domain.test");
});

test("validateEmail throws for CRLF injection", () => {
  assert.throws(
    () => validateEmail("user@evil.test\r\nBcc: victim@example.test"),
    SecurityFlagError,
  );
  assert.throws(() => validateEmail("user@evil.test\nX-Injected: yes"), SecurityFlagError);
});

test("validateEmail throws for null byte", () => {
  assert.throws(() => validateEmail("user\x00@evil.test"), SecurityFlagError);
});

test("validateEmail throws for missing local part or domain", () => {
  assert.throws(() => validateEmail("@missinglocal.test"), SecurityFlagError);
  assert.throws(() => validateEmail("user@"), SecurityFlagError);
  assert.throws(() => validateEmail("nodomain"), SecurityFlagError);
});

test("validateEmail throws for empty string and non-string", () => {
  assert.throws(() => validateEmail(""), SecurityFlagError);
  assert.throws(() => validateEmail(null), SecurityFlagError);
});

test("validateEmail throws when email exceeds max length", () => {
  const long = "a".repeat(LIMITS.MAX_EMAIL_LENGTH) + "@x.test";
  assert.throws(() => validateEmail(long), SecurityFlagError);
});

// ---------------------------------------------------------------------------
// validateThreadId
// ---------------------------------------------------------------------------

test("validateThreadId accepts alphanumeric IDs with _ and -", () => {
  assert.equal(validateThreadId("thread-support-001"), "thread-support-001");
  assert.equal(validateThreadId("THREAD_001"), "THREAD_001");
});

test("validateThreadId throws for path traversal", () => {
  assert.throws(() => validateThreadId("../../../etc/passwd"), SecurityFlagError);
});

test("validateThreadId throws for XSS payload", () => {
  assert.throws(() => validateThreadId("<script>alert(1)</script>"), SecurityFlagError);
});

test("validateThreadId throws for spaces", () => {
  assert.throws(() => validateThreadId("thread 001"), SecurityFlagError);
});

test("validateThreadId throws for oversized ID", () => {
  assert.throws(
    () => validateThreadId("a".repeat(LIMITS.MAX_THREAD_ID_LENGTH + 1)),
    SecurityFlagError,
  );
});

// ---------------------------------------------------------------------------
// validateDescription
// ---------------------------------------------------------------------------

test("validateDescription accepts valid text", () => {
  assert.equal(validateDescription("Suspicious link in body"), "Suspicious link in body");
});

test("validateDescription throws for empty string", () => {
  assert.throws(() => validateDescription(""), SecurityFlagError);
  assert.throws(() => validateDescription(null), SecurityFlagError);
});

test("validateDescription throws for text exceeding max length", () => {
  assert.throws(
    () => validateDescription("x".repeat(LIMITS.MAX_DESCRIPTION_LENGTH + 1)),
    SecurityFlagError,
  );
});

// ---------------------------------------------------------------------------
// validateEvidence
// ---------------------------------------------------------------------------

test("validateEvidence accepts a valid array of strings", () => {
  const result = validateEvidence(["External domain", "Urgent language"]);
  assert.deepEqual(result, ["External domain", "Urgent language"]);
});

test("validateEvidence throws for non-array input", () => {
  assert.throws(() => validateEvidence("not-an-array"), SecurityFlagError);
  assert.throws(() => validateEvidence(null), SecurityFlagError);
});

test("validateEvidence throws when item count exceeds max", () => {
  const items = new Array(LIMITS.MAX_EVIDENCE_ITEMS + 1).fill("item");
  assert.throws(() => validateEvidence(items), SecurityFlagError);
});

test("validateEvidence throws for oversized individual item", () => {
  const longItem = "x".repeat(LIMITS.MAX_EVIDENCE_LENGTH + 1);
  assert.throws(() => validateEvidence([longItem]), SecurityFlagError);
});

test("validateEvidence throws for empty item", () => {
  assert.throws(() => validateEvidence([""]), SecurityFlagError);
});

// ---------------------------------------------------------------------------
// validateCreateFlagInput
// ---------------------------------------------------------------------------

test("validateCreateFlagInput accepts a well-formed flag", () => {
  assert.equal(
    validateCreateFlagInput({
      emailId: "email-001",
      threadId: "thread-001",
      reportedBy: "alice@company.example",
      senderEmail: "attacker@evil.example",
      severity: "high",
      category: "phishing",
      description: "Suspicious link detected in email body.",
    }),
    true,
  );
});

test("validateCreateFlagInput throws for non-object input", () => {
  assert.throws(() => validateCreateFlagInput(null), SecurityFlagError);
  assert.throws(() => validateCreateFlagInput("admin"), SecurityFlagError);
  assert.throws(() => validateCreateFlagInput([]), SecurityFlagError);
});

test("validateCreateFlagInput propagates field-level errors", () => {
  assert.throws(
    () =>
      validateCreateFlagInput({
        emailId: "email-001",
        threadId: "thread-001",
        reportedBy: "alice@company.example",
        senderEmail: "attacker@evil.example",
        severity: "EXTREME",
        category: "phishing",
        description: "Test",
      }),
    SecurityFlagError,
  );
});

// ---------------------------------------------------------------------------
// classifyEmail
// ---------------------------------------------------------------------------

test("classifyEmail detects phishing signals", () => {
  const result = classifyEmail({
    subject: "Urgent: Verify your account to avoid suspension",
    senderEmail: "support@fake-verify.example.net",
    snippet: "Your account has been flagged for unusual sign-in activity.",
    bodyPreview: "Click here to confirm your credentials. This is urgent action required. Act now.",
  });
  assert.equal(result.category, "phishing");
  assert.ok(["critical", "high"].includes(result.severity));
  assert.ok(result.matchedSignals.length > 0);
});

test("classifyEmail detects malware signals", () => {
  const result = classifyEmail({
    subject: "Invoice attached — enable macros to view",
    senderEmail: "billing@invoices.example.xyz",
    snippet: "Please open the attachment and enable macros.",
    bodyPreview: "Download the file and run the installer to generate your receipt.",
  });
  assert.equal(result.category, "malware");
  assert.ok(result.matchedSignals.length > 0);
});

test("classifyEmail detects social-engineering signals", () => {
  const result = classifyEmail({
    subject: "Urgent request from CEO — Wire transfer needed",
    senderEmail: "ceo-urgent@company-hq.example.biz",
    snippet: "Keep this confidential. Do not share.",
    bodyPreview: "Wire transfer required immediately. Do not reply to this email.",
  });
  assert.equal(result.category, "social-engineering");
});

test("classifyEmail detects credential-theft signals", () => {
  const result = classifyEmail({
    subject: "Reset your password now",
    senderEmail: "security@accounts.example.com",
    snippet: "Enter your password to verify your identity.",
    bodyPreview: "Two-factor authentication required. Sign in to confirm your account.",
  });
  assert.equal(result.category, "credential-theft");
});

test("classifyEmail returns low severity and 'other' for benign content", () => {
  const result = classifyEmail({
    subject: "June product digest — tips and updates",
    senderEmail: "updates@example-product.com",
    snippet: "This month's digest covers improvements.",
    bodyPreview: "Read the full newsletter on our website.",
  });
  assert.equal(result.severity, "low");
  assert.equal(result.category, "other");
  assert.equal(result.confidence, "low");
});

test("classifyEmail includes matchedSignals array", () => {
  const result = classifyEmail({
    subject: "Verify your account",
    senderEmail: "noreply@fake.example",
    snippet: "Click here to confirm your credentials.",
    bodyPreview: "Urgent action required.",
  });
  assert.ok(Array.isArray(result.matchedSignals));
});

// ---------------------------------------------------------------------------
// classifyEmail — fixture-driven
// ---------------------------------------------------------------------------

test("fixture email signals match expected classification severity tier", async () => {
  const { emailSignals } = await loadFixtures();
  for (const signal of emailSignals) {
    const result = classifyEmail(signal);
    const expected = signal.expectedClassification;
    assert.equal(
      result.severity,
      expected.severity,
      `${signal.id}: expected severity "${expected.severity}", got "${result.severity}"`,
    );
    assert.equal(
      result.category,
      expected.category,
      `${signal.id}: expected category "${expected.category}", got "${result.category}"`,
    );
  }
});

// ---------------------------------------------------------------------------
// canTransition
// ---------------------------------------------------------------------------

test("canTransition allows valid state progressions", async () => {
  const { statusTransitions } = await loadFixtures();
  for (const { from, to } of statusTransitions.valid) {
    assert.equal(canTransition(from, to), true, `Expected ${from} → ${to} to be allowed`);
  }
});

test("canTransition rejects invalid transitions", async () => {
  const { statusTransitions } = await loadFixtures();
  for (const { from, to, reason } of statusTransitions.invalid) {
    assert.equal(
      canTransition(from, to),
      false,
      `Expected ${from} → ${to} to be blocked (${reason})`,
    );
  }
});

test("canTransition returns false for unknown from-status", () => {
  assert.equal(canTransition("nonexistent", "resolved"), false);
});

// ---------------------------------------------------------------------------
// validateStatusTransition
// ---------------------------------------------------------------------------

test("validateStatusTransition does not throw for valid transitions", () => {
  assert.doesNotThrow(() => validateStatusTransition("new", "under-review"));
  assert.doesNotThrow(() => validateStatusTransition("under-review", "escalated"));
  assert.doesNotThrow(() => validateStatusTransition("escalated", "resolved"));
});

test("validateStatusTransition throws for invalid transitions", () => {
  assert.throws(() => validateStatusTransition("new", "resolved"), SecurityFlagError);
  assert.throws(() => validateStatusTransition("resolved", "new"), SecurityFlagError);
  assert.throws(() => validateStatusTransition("dismissed", "escalated"), SecurityFlagError);
});

test("validateStatusTransition throws for unknown status values", () => {
  assert.throws(() => validateStatusTransition("pending", "resolved"), SecurityFlagError);
  assert.throws(() => validateStatusTransition("new", "pending"), SecurityFlagError);
});

// ---------------------------------------------------------------------------
// isMoreSevere / maxSeverity
// ---------------------------------------------------------------------------

test("isMoreSevere returns true when left is higher severity", () => {
  assert.equal(isMoreSevere("critical", "high"), true);
  assert.equal(isMoreSevere("high", "medium"), true);
  assert.equal(isMoreSevere("medium", "low"), true);
});

test("isMoreSevere returns false when left is lower or equal", () => {
  assert.equal(isMoreSevere("low", "high"), false);
  assert.equal(isMoreSevere("high", "high"), false);
  assert.equal(isMoreSevere("low", "critical"), false);
});

test("maxSeverity returns the higher of two severities", () => {
  assert.equal(maxSeverity("high", "critical"), "critical");
  assert.equal(maxSeverity("critical", "low"), "critical");
  assert.equal(maxSeverity("medium", "medium"), "medium");
  assert.equal(maxSeverity("low", "high"), "high");
});

// ---------------------------------------------------------------------------
// Hostile input fixture — all rejected
// ---------------------------------------------------------------------------

test("fixture hostile inputs are rejected by the appropriate validator", async () => {
  const { hostileInputs } = await loadFixtures();
  const validators = {
    email: validateEmail,
    threadId: validateThreadId,
    severity: validateSeverity,
    category: validateCategory,
    status: validateStatus,
  };

  for (const entry of hostileInputs) {
    const fn = validators[entry.field];
    assert.ok(fn, `No validator mapped for field "${entry.field}"`);
    assert.throws(
      () => fn(entry.value),
      SecurityFlagError,
      `Hostile input for ${entry.field} ("${entry.reason}") must throw SecurityFlagError`,
    );
  }
});

// ---------------------------------------------------------------------------
// Valid fixture flags all pass input validation
// ---------------------------------------------------------------------------

test("all fixture valid flags pass createFlagInput validation", async () => {
  const { validFlags } = await loadFixtures();
  for (const flag of validFlags) {
    assert.doesNotThrow(
      () => validateCreateFlagInput(flag),
      `Flag "${flag.id}" should pass validation`,
    );
  }
});
