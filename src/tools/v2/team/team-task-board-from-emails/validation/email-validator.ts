/**
 * Team Task Board from Emails - Email Validator
 *
 * Validates email structure, fields, and formats according to RFC 5322
 * Requirement 1: Input Validation for Email Structure
 * Requirement 6: Email Address and Team Member Validation
 */

import type { EmailInput, ValidationResult, ValidationError } from "../types";

// ============================================================================
// Constants
// ============================================================================

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const REQUIRED_FIELDS = ["id", "threadId", "from", "to", "subject", "body", "receivedAt"] as const;

const LIMITS = {
  ID_MIN: 1,
  ID_MAX: 256,
  SUBJECT_MAX: 998, // RFC 5322 limit
  BODY_MAX: 5_000_000, // 5 MB
  EMAIL_MAX: 254, // RFC 5321 limit
  LOCAL_PART_MAX: 64,
  RECIPIENTS_MAX: 100,
  FUTURE_DATE_HOURS: 24,
} as const;

// Known malicious or spam domains (example blocklist)
const BLOCKED_DOMAINS = new Set(["spam.example.com", "malicious.test", "phishing.invalid"]);

// ============================================================================
// Email Validator
// ============================================================================

export class EmailValidator {
  /**
   * Validates a complete email input object
   */
  static validate(email: unknown): ValidationResult<EmailInput> {
    const errors: ValidationError[] = [];

    // Type guard
    if (typeof email !== "object" || email === null) {
      return {
        isValid: false,
        errors: [
          {
            field: "email",
            code: "INVALID_TYPE",
            message: "Email must be a non-null object",
            severity: "error",
          },
        ],
      };
    }

    const input = email as Record<string, unknown>;

    // Validate required fields exist
    this.validateRequiredFields(input, errors);

    // If required fields are missing, stop here
    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Validate individual fields
    this.validateId(input.id, errors);
    this.validateThreadId(input.threadId, errors);
    this.validateFromAddress(input.from, errors);
    this.validateToAddresses(input.to, errors);
    this.validateSubject(input.subject, errors);
    this.validateBody(input.body, errors);
    this.validateReceivedAt(input.receivedAt, errors);

    // Optional fields
    if (input.cc) this.validateCcAddresses(input.cc, errors);
    if (input.bcc) this.validateBccAddresses(input.bcc, errors);

    return {
      isValid: errors.length === 0,
      value: errors.length === 0 ? (input as EmailInput) : undefined,
      errors,
    };
  }

  /**
   * Validates that all required fields are present
   */
  private static validateRequiredFields(
    input: Record<string, unknown>,
    errors: ValidationError[],
  ): void {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in input) || input[field] === null || input[field] === undefined) {
        errors.push({
          field,
          code: "REQUIRED_FIELD_MISSING",
          message: `Required field '${field}' is missing, null, or undefined`,
          severity: "error",
        });
      }
    }
  }

  /**
   * Validates email ID
   * Criteria: Non-empty string, length 1-256
   */
  private static validateId(value: unknown, errors: ValidationError[]): void {
    if (typeof value !== "string") {
      errors.push({
        field: "id",
        code: "INVALID_TYPE",
        message: "Email id must be a string",
        severity: "error",
      });
      return;
    }

    if (value.length < LIMITS.ID_MIN || value.length > LIMITS.ID_MAX) {
      errors.push({
        field: "id",
        code: "INVALID_LENGTH",
        message: `Email id must be between ${LIMITS.ID_MIN} and ${LIMITS.ID_MAX} characters`,
        severity: "error",
      });
    }
  }

  /**
   * Validates thread ID
   * Criteria: Non-empty string, length 1-256
   */
  private static validateThreadId(value: unknown, errors: ValidationError[]): void {
    if (typeof value !== "string") {
      errors.push({
        field: "threadId",
        code: "INVALID_TYPE",
        message: "Thread id must be a string",
        severity: "error",
      });
      return;
    }

    if (value.length < LIMITS.ID_MIN || value.length > LIMITS.ID_MAX) {
      errors.push({
        field: "threadId",
        code: "INVALID_LENGTH",
        message: `Thread id must be between ${LIMITS.ID_MIN} and ${LIMITS.ID_MAX} characters`,
        severity: "error",
      });
    }
  }

  /**
   * Validates from email address
   * Criteria: Valid RFC 5322 format, not from blocked domain
   */
  private static validateFromAddress(value: unknown, errors: ValidationError[]): void {
    if (typeof value !== "string") {
      errors.push({
        field: "from",
        code: "INVALID_TYPE",
        message: "From address must be a string",
        severity: "error",
      });
      return;
    }

    const emailErrors = this.validateEmailAddress(value, "from");
    errors.push(...emailErrors);

    // Check blocked domains
    const domain = value.split("@")[1];
    if (domain && BLOCKED_DOMAINS.has(domain.toLowerCase())) {
      errors.push({
        field: "from",
        code: "BLOCKED_DOMAIN",
        message: `Domain '${domain}' is on the blocklist`,
        severity: "error",
      });
    }
  }

  /**
   * Validates to email addresses
   * Criteria: Array with at least one valid email, max 100 recipients
   */
  private static validateToAddresses(value: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(value)) {
      errors.push({
        field: "to",
        code: "INVALID_TYPE",
        message: "To field must be an array",
        severity: "error",
      });
      return;
    }

    if (value.length === 0) {
      errors.push({
        field: "to",
        code: "EMPTY_ARRAY",
        message: "To field must contain at least one email address",
        severity: "error",
      });
      return;
    }

    if (value.length > LIMITS.RECIPIENTS_MAX) {
      errors.push({
        field: "to",
        code: "TOO_MANY_RECIPIENTS",
        message: `To field cannot contain more than ${LIMITS.RECIPIENTS_MAX} recipients`,
        severity: "error",
      });
    }

    value.forEach((email, index) => {
      const emailErrors = this.validateEmailAddress(email, `to[${index}]`);
      errors.push(...emailErrors);
    });
  }

  /**
   * Validates cc email addresses
   */
  private static validateCcAddresses(value: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(value)) {
      errors.push({
        field: "cc",
        code: "INVALID_TYPE",
        message: "CC field must be an array",
        severity: "error",
      });
      return;
    }

    value.forEach((email, index) => {
      const emailErrors = this.validateEmailAddress(email, `cc[${index}]`);
      errors.push(...emailErrors);
    });
  }

  /**
   * Validates bcc email addresses
   */
  private static validateBccAddresses(value: unknown, errors: ValidationError[]): void {
    if (!Array.isArray(value)) {
      errors.push({
        field: "bcc",
        code: "INVALID_TYPE",
        message: "BCC field must be an array",
        severity: "error",
      });
      return;
    }

    value.forEach((email, index) => {
      const emailErrors = this.validateEmailAddress(email, `bcc[${index}]`);
      errors.push(...emailErrors);
    });
  }

  /**
   * Validates a single email address
   * Criteria: RFC 5322 format, length limits, no consecutive dots, no invalid characters
   */
  private static validateEmailAddress(value: unknown, field: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (typeof value !== "string") {
      errors.push({
        field,
        code: "INVALID_TYPE",
        message: `${field} must be a string`,
        severity: "error",
      });
      return errors;
    }

    // Length check
    if (value.length > LIMITS.EMAIL_MAX) {
      errors.push({
        field,
        code: "EMAIL_TOO_LONG",
        message: `Email address cannot exceed ${LIMITS.EMAIL_MAX} characters`,
        severity: "error",
      });
    }

    // Format check
    if (!EMAIL_REGEX.test(value)) {
      errors.push({
        field,
        code: "INVALID_EMAIL_FORMAT",
        message: `Invalid email address format: ${value}`,
        severity: "error",
      });
      return errors;
    }

    const [localPart, domain] = value.split("@");

    // Local part length check
    if (localPart.length > LIMITS.LOCAL_PART_MAX) {
      errors.push({
        field,
        code: "LOCAL_PART_TOO_LONG",
        message: `Email local part cannot exceed ${LIMITS.LOCAL_PART_MAX} characters`,
        severity: "error",
      });
    }

    // Consecutive dots check
    if (localPart.includes("..")) {
      errors.push({
        field,
        code: "CONSECUTIVE_DOTS",
        message: "Email local part cannot contain consecutive dots",
        severity: "error",
      });
    }

    // Spaces check
    if (localPart.includes(" ")) {
      errors.push({
        field,
        code: "CONTAINS_SPACES",
        message: "Email local part cannot contain spaces",
        severity: "error",
      });
    }

    return errors;
  }

  /**
   * Validates subject line
   * Criteria: String, max 998 characters (RFC 5322)
   */
  private static validateSubject(value: unknown, errors: ValidationError[]): void {
    if (typeof value !== "string") {
      errors.push({
        field: "subject",
        code: "INVALID_TYPE",
        message: "Subject must be a string",
        severity: "error",
      });
      return;
    }

    if (value.length > LIMITS.SUBJECT_MAX) {
      errors.push({
        field: "subject",
        code: "SUBJECT_TOO_LONG",
        message: `Subject cannot exceed ${LIMITS.SUBJECT_MAX} characters (RFC 5322 limit)`,
        severity: "error",
      });
    }
  }

  /**
   * Validates email body
   * Criteria: String, max 5MB
   */
  private static validateBody(value: unknown, errors: ValidationError[]): void {
    if (typeof value !== "string") {
      errors.push({
        field: "body",
        code: "INVALID_TYPE",
        message: "Body must be a string",
        severity: "error",
      });
      return;
    }

    if (value.length > LIMITS.BODY_MAX) {
      errors.push({
        field: "body",
        code: "BODY_TOO_LARGE",
        message: `Body cannot exceed ${LIMITS.BODY_MAX} characters (5 MB limit)`,
        severity: "error",
      });
    }
  }

  /**
   * Validates receivedAt timestamp
   * Criteria: Valid ISO 8601 date, not more than 24 hours in the future
   */
  private static validateReceivedAt(value: unknown, errors: ValidationError[]): void {
    if (typeof value !== "string") {
      errors.push({
        field: "receivedAt",
        code: "INVALID_TYPE",
        message: "ReceivedAt must be a string",
        severity: "error",
      });
      return;
    }

    // Parse as ISO 8601
    const date = new Date(value);

    if (isNaN(date.getTime())) {
      errors.push({
        field: "receivedAt",
        code: "INVALID_DATE_FORMAT",
        message: "ReceivedAt must be a valid ISO 8601 date string",
        severity: "error",
      });
      return;
    }

    // Check if date is too far in the future
    const now = new Date();
    const maxFuture = new Date(now.getTime() + LIMITS.FUTURE_DATE_HOURS * 60 * 60 * 1000);

    if (date > maxFuture) {
      errors.push({
        field: "receivedAt",
        code: "FUTURE_DATE_INVALID",
        message: `ReceivedAt cannot be more than ${LIMITS.FUTURE_DATE_HOURS} hours in the future`,
        severity: "error",
      });
    }
  }

  /**
   * Validates team member identifier
   * Criteria: Alphanumeric with dash/underscore, 1-64 chars, not reserved
   */
  static validateTeamMemberId(id: string): ValidationResult<string> {
    const errors: ValidationError[] = [];

    const TEAM_MEMBER_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
    const RESERVED_IDS = ["admin", "root", "system", "null", "undefined"];

    if (!TEAM_MEMBER_REGEX.test(id)) {
      errors.push({
        field: "teamMemberId",
        code: "INVALID_FORMAT",
        message: "Team member ID must be 1-64 alphanumeric characters, dash, or underscore",
        severity: "error",
      });
    }

    if (RESERVED_IDS.includes(id.toLowerCase())) {
      errors.push({
        field: "teamMemberId",
        code: "RESERVED_KEYWORD",
        message: `Team member ID '${id}' is a reserved keyword`,
        severity: "error",
      });
    }

    return {
      isValid: errors.length === 0,
      value: errors.length === 0 ? id : undefined,
      errors,
    };
  }
}
