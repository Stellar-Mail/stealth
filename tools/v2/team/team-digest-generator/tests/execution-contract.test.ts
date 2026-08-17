/**
 * execution-contract.test.ts — Unit tests for the non-UI test execution contract
 *
 * Verifies headless backend execution, error codes, and fixtures for the
 * team-digest-generator test suite without any UI dependencies.
 */

import { describe, it, expect } from "vitest";
import { createTestDigestExecutionService, TestDigestErrorCode } from "./execution-contract";
import {
  VALID_ITEMS_FIXTURE,
  VALID_ACTIVITY_FIXTURE,
  VALID_EMAIL_FIXTURE,
  VALID_SANITIZE_FIXTURE,
  INVALID_ITEMS_MISSING_AUTHOR,
  INVALID_ACTIVITY_NOT_ARRAY,
  INVALID_EMAIL_FIXTURE,
  INVALID_OPERATION_FIXTURE,
} from "./execution-contract.fixtures";

describe("TestDigestExecutionService — Success Cases", () => {
  const service = createTestDigestExecutionService();

  it("generates a digest summary from items successfully", () => {
    const res = service.execute({
      type: "generate_from_items",
      items: VALID_ITEMS_FIXTURE,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.type === "generate_from_items") {
      expect(res.value.summary.totalItems).toBe(2);
      expect(res.value.summary.actionItems.length).toBe(1);
    }
  });

  it("generates a digest from activity array successfully", () => {
    const res = service.execute({
      type: "generate_from_activity",
      activity: VALID_ACTIVITY_FIXTURE,
      date: "2026-07-27",
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.type === "generate_from_activity") {
      expect(res.value.digest.items.length).toBe(2);
      expect(res.value.digest.summary.totalItems).toBe(2);
    }
  });

  it("validates a well-formed email address successfully", () => {
    const res = service.execute({
      type: "validate_email",
      email: VALID_EMAIL_FIXTURE,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.type === "validate_email") {
      expect(res.value.valid).toBe(true);
      expect(res.value.error).toBeUndefined();
    }
  });

  it("sanitizes email content and subject successfully", () => {
    const res = service.execute({
      type: "sanitize_content",
      html: VALID_SANITIZE_FIXTURE.html,
      subject: VALID_SANITIZE_FIXTURE.subject,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.type === "sanitize_content") {
      expect(res.value.sanitizedHtml).not.toContain("<script>");
      expect(res.value.sanitizedHtml).not.toContain("javascript:");
      expect(res.value.sanitizedSubject).not.toContain("\x00");
    }
  });
});

describe("TestDigestExecutionService — Failure Cases", () => {
  const service = createTestDigestExecutionService();

  it("returns InvalidInput error when items are missing an author", () => {
    const res = service.execute({
      type: "generate_from_items",
      items: INVALID_ITEMS_MISSING_AUTHOR,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(TestDigestErrorCode.InvalidInput);
    }
  });

  it("returns InvalidInput error when activity is not an array", () => {
    const res = service.execute({
      type: "generate_from_activity",
      activity: INVALID_ACTIVITY_NOT_ARRAY as never,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(TestDigestErrorCode.InvalidInput);
    }
  });

  it("returns validation error structure when email contains SQL injection characters", () => {
    const res = service.execute({
      type: "validate_email",
      email: INVALID_EMAIL_FIXTURE,
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.type === "validate_email") {
      expect(res.value.valid).toBe(false);
      expect(res.value.error?.code).toBe("INVALID_FORMAT");
    }
  });

  it("returns UnknownOperation error when operation type is unrecognized", () => {
    const res = service.execute(INVALID_OPERATION_FIXTURE as never);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe(TestDigestErrorCode.UnknownOperation);
    }
  });
});
