// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  GUARD_LIMITS,
  sanitizeText,
  sanitizeStringField,
  isFiniteNumber,
  isNonEmptyString,
  isDecisionKind,
  isPrototypeSafe,
  isRegexSafe,
  safeJsonParse,
  normalizeDate,
  sanitizeAmount,
  validatePaymentApprovalInput,
  validateContext,
  checkInputLimits,
  sanitizeInput,
  batchSizeGuard,
  trimCollection,
  safeExecuteApproval,
} from "../services/guards";
import type { PaymentApprovalInput } from "../types/contract";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function validInput(overrides?: Partial<PaymentApprovalInput>): PaymentApprovalInput {
  return {
    paymentId: "pay-123",
    approverId: "user-456",
    decision: "approve",
    notes: "Looks good",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sanitizeText
// ---------------------------------------------------------------------------

describe("sanitizeText", () => {
  it("normalizes NFC", () => {
    // e + combining acute accent vs precomposed é
    const decomposed = "e\u0301";
    const composed = "\u00e9";
    expect(sanitizeText(decomposed)).toBe(composed);
  });

  it("strips control characters", () => {
    const dirty = "hello\u0000\u0008\u001fworld";
    expect(sanitizeText(dirty)).toBe("helloworld");
  });

  it("strips invisible characters", () => {
    const dirty = "hello\u200b\u200c\u200d\u2060\ufeffworld";
    expect(sanitizeText(dirty)).toBe("helloworld");
  });

  it("preserves normal text", () => {
    expect(sanitizeText("Hello, World! 123")).toBe("Hello, World! 123");
  });

  it("handles empty string", () => {
    expect(sanitizeText("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// sanitizeStringField
// ---------------------------------------------------------------------------

describe("sanitizeStringField", () => {
  it("trims and sanitizes a string", () => {
    expect(sanitizeStringField("  hello\u0000  ")).toBe("hello");
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeStringField(42)).toBe("");
    expect(sanitizeStringField(null)).toBe("");
    expect(sanitizeStringField(undefined)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// isFiniteNumber
// ---------------------------------------------------------------------------

describe("isFiniteNumber", () => {
  it("returns true for finite numbers", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-1.5)).toBe(true);
    expect(isFiniteNumber(100_000)).toBe(true);
  });

  it("returns false for non-numbers", () => {
    expect(isFiniteNumber("0")).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
  });

  it("returns false for NaN and Infinity", () => {
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isNonEmptyString
// ---------------------------------------------------------------------------

describe("isNonEmptyString", () => {
  it("returns true for non-empty strings", () => {
    expect(isNonEmptyString("hello")).toBe(true);
    expect(isNonEmptyString("  x  ")).toBe(true);
  });

  it("returns false for empty/whitespace/non-strings", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDecisionKind
// ---------------------------------------------------------------------------

describe("isDecisionKind", () => {
  it("accepts approve and reject", () => {
    expect(isDecisionKind("approve")).toBe(true);
    expect(isDecisionKind("reject")).toBe(true);
  });

  it("rejects other strings", () => {
    expect(isDecisionKind("maybe")).toBe(false);
    expect(isDecisionKind("")).toBe(false);
    expect(isDecisionKind(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isPrototypeSafe
// ---------------------------------------------------------------------------

describe("isPrototypeSafe", () => {
  it("returns true for safe objects", () => {
    expect(isPrototypeSafe({ a: 1, b: 2 })).toBe(true);
  });

  it("returns false for __proto__", () => {
    const obj = {};
    Object.defineProperty(obj, "__proto__", { value: {}, enumerable: true, configurable: true });
    expect(isPrototypeSafe(obj as Record<string, unknown>)).toBe(false);
  });

  it("returns false for constructor", () => {
    expect(isPrototypeSafe({ constructor: {} })).toBe(false);
  });

  it("returns false for prototype", () => {
    expect(isPrototypeSafe({ prototype: {} })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isRegexSafe
// ---------------------------------------------------------------------------

describe("isRegexSafe", () => {
  it("returns true for simple patterns", () => {
    expect(isRegexSafe(/hello/)).toBe(true);
    // eslint-disable-next-line no-control-regex
    expect(isRegexSafe(/[\u0000-\u001f]/)).toBe(true);
  });

  it("returns true for non-catastrophic patterns", () => {
    expect(isRegexSafe(/a+b+c+/)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// safeJsonParse
// ---------------------------------------------------------------------------

describe("safeJsonParse", () => {
  it("parses valid JSON matching the guard", () => {
    const result = safeJsonParse(
      '{"x":1}',
      (v): v is { x: number } => typeof v === "object" && v !== null && "x" in v,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ x: 1 });
  });

  it("returns error for invalid JSON", () => {
    const result = safeJsonParse("not json", (v): v is unknown => true);
    expect(result.ok).toBe(false);
  });

  it("returns error when guard fails", () => {
    const result = safeJsonParse('{"x":1}', (v): v is { y: string } => false);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeDate
// ---------------------------------------------------------------------------

describe("normalizeDate", () => {
  it("normalizes a Date object", () => {
    const d = new Date("2026-06-25T08:00:00Z");
    expect(normalizeDate(d)).toBe("2026-06-25T08:00:00.000Z");
  });

  it("normalizes an ISO string", () => {
    expect(normalizeDate("2026-06-25T08:00:00Z")).toBe("2026-06-25T08:00:00.000Z");
  });

  it("falls back to now for invalid string", () => {
    const result = normalizeDate("not-a-date");
    expect(Number.isFinite(new Date(result).getTime())).toBe(true);
  });

  it("falls back to now for invalid Date", () => {
    const result = normalizeDate(new Date("invalid"));
    expect(Number.isFinite(new Date(result).getTime())).toBe(true);
  });

  it("returns now when undefined", () => {
    const result = normalizeDate();
    expect(Number.isFinite(new Date(result).getTime())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sanitizeAmount
// ---------------------------------------------------------------------------

describe("sanitizeAmount", () => {
  it("accepts valid amounts", () => {
    expect(sanitizeAmount(0)).toBe(0);
    expect(sanitizeAmount(5000)).toBe(5000);
    expect(sanitizeAmount(0.01)).toBe(0.01);
  });

  it("rejects negative", () => {
    expect(sanitizeAmount(-1)).toBeNull();
  });

  it("rejects NaN", () => {
    expect(sanitizeAmount(NaN)).toBeNull();
  });

  it("rejects Infinity", () => {
    expect(sanitizeAmount(Infinity)).toBeNull();
  });

  it("rejects over max", () => {
    expect(sanitizeAmount(GUARD_LIMITS.maxAmount + 1)).toBeNull();
  });

  it("rejects non-numbers", () => {
    expect(sanitizeAmount("5000")).toBeNull();
    expect(sanitizeAmount(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validatePaymentApprovalInput
// ---------------------------------------------------------------------------

describe("validatePaymentApprovalInput", () => {
  it("returns null for valid input", () => {
    expect(validatePaymentApprovalInput(validInput())).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(validatePaymentApprovalInput(null)).not.toBeNull();
    expect(validatePaymentApprovalInput("string")).not.toBeNull();
    expect(validatePaymentApprovalInput(42)).not.toBeNull();
  });

  it("rejects empty paymentId", () => {
    const issue = validatePaymentApprovalInput(validInput({ paymentId: "" }));
    expect(issue?.field).toBe("paymentId");
  });

  it("rejects empty approverId", () => {
    const issue = validatePaymentApprovalInput(validInput({ approverId: "" }));
    expect(issue?.field).toBe("approverId");
  });

  it("rejects invalid decision", () => {
    const issue = validatePaymentApprovalInput(
      validInput({ decision: "maybe" as PaymentApprovalInput["decision"] }),
    );
    expect(issue?.field).toBe("decision");
  });

  it("rejects non-string notes", () => {
    const issue = validatePaymentApprovalInput(validInput({ notes: 42 as unknown as string }));
    expect(issue?.field).toBe("notes");
  });

  it("rejects invalid decidedAt", () => {
    const issue = validatePaymentApprovalInput(
      validInput({ decidedAt: 12345 as unknown as string }),
    );
    expect(issue?.field).toBe("decidedAt");
  });

  it("rejects prototype pollution in top-level", () => {
    const malicious = { ...validInput() };
    Object.defineProperty(malicious, "__proto__", {
      value: {},
      enumerable: true,
      configurable: true,
    });
    const issue = validatePaymentApprovalInput(malicious);
    expect(issue).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateContext
// ---------------------------------------------------------------------------

describe("validateContext", () => {
  it("returns null for valid context", () => {
    expect(validateContext({ approverId: "u1", role: "manager" })).toBeNull();
  });

  it("rejects non-object", () => {
    expect(validateContext(null)).not.toBeNull();
    expect(validateContext("string")).not.toBeNull();
  });

  it("rejects missing approverId", () => {
    const issue = validateContext({ role: "manager" });
    expect(issue?.field).toBe("context.approverId");
  });

  it("rejects missing role", () => {
    const issue = validateContext({ approverId: "u1" });
    expect(issue?.field).toBe("context.role");
  });

  it("rejects non-finite approvalLimit", () => {
    const issue = validateContext({
      approverId: "u1",
      role: "manager",
      approvalLimit: NaN,
    });
    expect(issue?.field).toBe("context.approvalLimit");
  });

  it("rejects non-array allowedRoles", () => {
    const issue = validateContext({
      approverId: "u1",
      role: "manager",
      allowedRoles: "admin",
    });
    expect(issue?.field).toBe("context.allowedRoles");
  });

  it("rejects empty role in allowedRoles", () => {
    const issue = validateContext({
      approverId: "u1",
      role: "manager",
      allowedRoles: [""],
    });
    expect(issue?.field).toBe("context.allowedRoles");
  });

  it("rejects prototype pollution in context", () => {
    const ctx = { approverId: "u1", role: "manager" };
    Object.defineProperty(ctx, "__proto__", { value: {}, enumerable: true, configurable: true });
    const issue = validateContext(ctx);
    expect(issue).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkInputLimits
// ---------------------------------------------------------------------------

describe("checkInputLimits", () => {
  it("returns empty array for within-limit input", () => {
    expect(checkInputLimits(validInput())).toHaveLength(0);
  });

  it("flags oversized paymentId", () => {
    const input = validInput({ paymentId: "x".repeat(GUARD_LIMITS.maxPaymentIdChars + 1) });
    const issues = checkInputLimits(input);
    expect(issues.some((i) => i.field === "paymentId")).toBe(true);
  });

  it("flags oversized approverId", () => {
    const input = validInput({ approverId: "x".repeat(GUARD_LIMITS.maxApproverIdChars + 1) });
    const issues = checkInputLimits(input);
    expect(issues.some((i) => i.field === "approverId")).toBe(true);
  });

  it("flags oversized notes", () => {
    const input = validInput({ notes: "x".repeat(GUARD_LIMITS.maxNotesChars + 1) });
    const issues = checkInputLimits(input);
    expect(issues.some((i) => i.field === "notes")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sanitizeInput
// ---------------------------------------------------------------------------

describe("sanitizeInput", () => {
  it("trims and sanitizes string fields", () => {
    const dirty = validInput({
      paymentId: "  pay-123\u0000  ",
      approverId: "  user-456\u200b  ",
      notes: "  \u0008note\u0008  ",
    });
    const clean = sanitizeInput(dirty);
    expect(clean.paymentId).toBe("pay-123");
    expect(clean.approverId).toBe("user-456");
    expect(clean.notes).toBe("note");
  });

  it("preserves decision unchanged", () => {
    const input = validInput({ decision: "reject" });
    expect(sanitizeInput(input).decision).toBe("reject");
  });

  it("does not mutate the original", () => {
    const input = validInput({ notes: "  hello  " });
    const _clean = sanitizeInput(input);
    expect(input.notes).toBe("  hello  ");
  });

  it("sanitizes context fields", () => {
    const input = validInput({
      context: {
        approverId: "  u1  ",
        role: "  manager  ",
        allowedRoles: ["  admin  ", "  viewer  "],
      },
    });
    const clean = sanitizeInput(input);
    expect(clean.context?.role).toBe("manager");
    expect(clean.context?.allowedRoles).toEqual(["admin", "viewer"]);
  });
});

// ---------------------------------------------------------------------------
// batchSizeGuard
// ---------------------------------------------------------------------------

describe("batchSizeGuard", () => {
  it("returns default for non-number input", () => {
    const result = batchSizeGuard("not a number");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.size).toBe(100);
  });

  it("clamps to maxBatchSize", () => {
    const result = batchSizeGuard(GUARD_LIMITS.maxBatchSize + 1000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.size).toBe(GUARD_LIMITS.maxBatchSize);
  });

  it("rejects zero", () => {
    const result = batchSizeGuard(0);
    expect(result.ok).toBe(false);
  });

  it("accepts valid size", () => {
    const result = batchSizeGuard(500);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.size).toBe(500);
  });

  it("floors fractional sizes", () => {
    const result = batchSizeGuard(10.7);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// trimCollection
// ---------------------------------------------------------------------------

describe("trimCollection", () => {
  it("trims to maxLength", () => {
    expect(trimCollection([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
  });

  it("returns original when within limit", () => {
    const arr = [1, 2];
    expect(trimCollection(arr, 5)).toStrictEqual(arr);
  });

  it("handles invalid maxLength", () => {
    const arr = [1, 2, 3];
    expect(trimCollection(arr, -1)).toBe(arr);
    expect(trimCollection(arr, NaN)).toBe(arr);
  });
});

// ---------------------------------------------------------------------------
// safeExecuteApproval
// ---------------------------------------------------------------------------

describe("safeExecuteApproval", () => {
  it("returns ok with sanitized input for valid input", () => {
    const result = safeExecuteApproval(validInput());
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.input.paymentId).toBe("pay-123");
      expect(result.input.decision).toBe("approve");
    }
  });

  it("returns error for null input", () => {
    const result = safeExecuteApproval(null);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe("INVALID_INPUT");
    }
  });

  it("returns error for missing paymentId", () => {
    const result = safeExecuteApproval({ approverId: "u1", decision: "approve" });
    expect(result.status).toBe("error");
  });

  it("returns error for oversized input", () => {
    const result = safeExecuteApproval(
      validInput({ notes: "x".repeat(GUARD_LIMITS.maxNotesChars + 1) }),
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe("INPUT_TOO_LARGE");
    }
  });

  it("rejects prototype pollution", () => {
    const malicious = { ...validInput() };
    Object.defineProperty(malicious, "__proto__", {
      value: {},
      enumerable: true,
      configurable: true,
    });
    const result = safeExecuteApproval(malicious);
    expect(result.status).toBe("error");
  });

  it("sanitizes control characters from input", () => {
    const result = safeExecuteApproval(
      validInput({ paymentId: "pay\u0000-123", notes: "note\u0008" }),
    );
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.input.paymentId).toBe("pay-123");
      expect(result.input.notes).toBe("note");
    }
  });

  it("returns error for invalid context", () => {
    const result = safeExecuteApproval(
      validInput({
        context: { role: "manager" } as import("../types/contract").PaymentApprovalContext,
      }),
    );
    expect(result.status).toBe("error");
  });
});
