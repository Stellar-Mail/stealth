/**
 * execution-contract.ts — Team Digest Generator (non-UI test execution contract)
 *
 * Headless, backend-facing execution contract and service boundary for test workflows
 * and non-UI integration. Ensures that the digest generator can be tested and invoked
 * independently of any React or presentation concerns.
 */

import {
  generateTeamDigest,
  type TeamDigestItem,
  type TeamDigestSummary,
} from "../src/digestGenerator";
import {
  generateDigest,
  type ActivityItem,
  type GeneratedActivityDigest,
} from "../services/digest-generator.service.mjs";
import { validateEmail } from "../services/inputValidation";
import { sanitizeEmailContent, sanitizeEmailSubject } from "../services/contentSanitization";
import type { ValidationError } from "../types";

/** Explicit error codes for non-UI test execution operations. */
export enum TestDigestErrorCode {
  InvalidInput = "INVALID_INPUT",
  ValidationFailed = "VALIDATION_FAILED",
  SanitizationFailed = "SANITIZATION_FAILED",
  ExecutionFailed = "EXECUTION_FAILED",
  UnknownOperation = "UNKNOWN_OPERATION",
}

/** Discriminated union outcome returned by every contract operation. */
export type TestDigestResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: TestDigestErrorCode;
      message: string;
      details?: unknown;
    };

/** Operations supported by the test execution contract. */
export type TestDigestOperation =
  | {
      type: "generate_from_items";
      items: TeamDigestItem[];
      options?: { topSubjectLimit?: number };
    }
  | {
      type: "generate_from_activity";
      activity: ActivityItem[];
      date?: string;
      generatedAt?: string;
    }
  | {
      type: "validate_email";
      email: string;
    }
  | {
      type: "sanitize_content";
      html: string;
      subject?: string;
    };

/** Output produced by the test execution contract. */
export type TestDigestOutput =
  | {
      type: "generate_from_items";
      summary: TeamDigestSummary;
    }
  | {
      type: "generate_from_activity";
      digest: GeneratedActivityDigest;
    }
  | {
      type: "validate_email";
      valid: boolean;
      error?: ValidationError;
    }
  | {
      type: "sanitize_content";
      sanitizedHtml: string;
      sanitizedSubject?: string;
    };

/** Typed helper for success result. */
export function ok<T>(value: T): TestDigestResult<T> {
  return { ok: true, value };
}

/** Typed helper for failure result. */
export function fail<T = never>(
  error: TestDigestErrorCode,
  message: string,
  details?: unknown,
): TestDigestResult<T> {
  return { ok: false, error, message, details };
}

/** Service interface for non-UI test execution contract. */
export interface ITestDigestExecutionService {
  execute(operation: TestDigestOperation): TestDigestResult<TestDigestOutput>;
  generateFromItems(
    items: TeamDigestItem[],
    options?: { topSubjectLimit?: number },
  ): TestDigestResult<TeamDigestSummary>;
  generateFromActivity(
    activity: ActivityItem[],
    date?: string,
    generatedAt?: string,
  ): TestDigestResult<GeneratedActivityDigest>;
  validateEmailAddress(
    email: string,
  ): TestDigestResult<{ valid: boolean; error?: ValidationError }>;
  sanitizeContent(
    html: string,
    subject?: string,
  ): TestDigestResult<{ sanitizedHtml: string; sanitizedSubject?: string }>;
}

/**
 * Headless execution service implementing the non-UI contract for tests.
 */
export class TestDigestExecutionService implements ITestDigestExecutionService {
  execute(operation: TestDigestOperation): TestDigestResult<TestDigestOutput> {
    try {
      if (!operation || typeof operation !== "object") {
        return fail(TestDigestErrorCode.InvalidInput, "Operation must be a valid object");
      }

      switch (operation.type) {
        case "generate_from_items": {
          const res = this.generateFromItems(operation.items, operation.options);
          if (!res.ok) return res;
          return ok({ type: "generate_from_items", summary: res.value });
        }
        case "generate_from_activity": {
          const res = this.generateFromActivity(
            operation.activity,
            operation.date,
            operation.generatedAt,
          );
          if (!res.ok) return res;
          return ok({ type: "generate_from_activity", digest: res.value });
        }
        case "validate_email": {
          const res = this.validateEmailAddress(operation.email);
          if (!res.ok) return res;
          return ok({
            type: "validate_email",
            valid: res.value.valid,
            error: res.value.error,
          });
        }
        case "sanitize_content": {
          const res = this.sanitizeContent(operation.html, operation.subject);
          if (!res.ok) return res;
          return ok({
            type: "sanitize_content",
            sanitizedHtml: res.value.sanitizedHtml,
            sanitizedSubject: res.value.sanitizedSubject,
          });
        }
        default:
          return fail(TestDigestErrorCode.UnknownOperation, `Unsupported operation type`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(TestDigestErrorCode.ExecutionFailed, msg);
    }
  }

  generateFromItems(
    items: TeamDigestItem[],
    options?: { topSubjectLimit?: number },
  ): TestDigestResult<TeamDigestSummary> {
    try {
      if (!items || !Array.isArray(items)) {
        return fail(TestDigestErrorCode.InvalidInput, "items must be an array");
      }
      for (const item of items) {
        if (!item.id || item.id.trim() === "") {
          return fail(TestDigestErrorCode.InvalidInput, "each item requires a valid id");
        }
        if (!item.author || item.author.trim() === "") {
          return fail(TestDigestErrorCode.InvalidInput, "each item requires a valid author");
        }
      }
      const summary = generateTeamDigest(items, options);
      return ok(summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(TestDigestErrorCode.ExecutionFailed, msg);
    }
  }

  generateFromActivity(
    activity: ActivityItem[],
    date = "2026-07-27",
    generatedAt?: string,
  ): TestDigestResult<GeneratedActivityDigest> {
    try {
      if (!activity || !Array.isArray(activity)) {
        return fail(TestDigestErrorCode.InvalidInput, "activity must be an array");
      }
      const digest = generateDigest(activity, date, generatedAt);
      return ok(digest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(TestDigestErrorCode.ExecutionFailed, msg);
    }
  }

  validateEmailAddress(
    email: string,
  ): TestDigestResult<{ valid: boolean; error?: ValidationError }> {
    try {
      const error = validateEmail(email);
      if (error) {
        return ok({ valid: false, error });
      }
      return ok({ valid: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(TestDigestErrorCode.ExecutionFailed, msg);
    }
  }

  sanitizeContent(
    html: string,
    subject?: string,
  ): TestDigestResult<{
    sanitizedHtml: string;
    sanitizedSubject?: string;
  }> {
    try {
      const sanitizedHtml = sanitizeEmailContent(html);
      const sanitizedSubject = subject !== undefined ? sanitizeEmailSubject(subject) : undefined;
      return ok({ sanitizedHtml, sanitizedSubject });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(TestDigestErrorCode.SanitizationFailed, msg);
    }
  }
}

/** Factory function to create a new headless TestDigestExecutionService instance. */
export function createTestDigestExecutionService(): ITestDigestExecutionService {
  return new TestDigestExecutionService();
}
