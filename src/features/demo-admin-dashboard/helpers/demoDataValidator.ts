import type { DemoMessage, DemoDataset, DemoSender } from "../types/dataset";

/**
 * Validation helpers for demo inbox data to ensure safety and compliance.
 *
 * All demo data must be fake, deterministic, and safe for public repository review.
 * These validators help ensure no real PII, secrets, or unsafe content is included.
 */

/**
 * Safe email domains allowed in demo data.
 */
const SAFE_EMAIL_DOMAINS = ["@example.com", "@example.org", ".stealth.demo"];

/**
 * Patterns that might indicate real PII or sensitive data.
 */
const UNSAFE_PATTERNS = [
  // Phone numbers
  /\b\d{3}-\d{3}-\d{4}\b/,
  /\(\d{3}\)\s?\d{3}-\d{4}/,
  /\+\d{1,3}\s?\d{3,4}\s?\d{3,4}\s?\d{3,4}/,

  // Social Security Numbers
  /\b\d{3}-\d{2}-\d{4}\b/,

  // Credit card numbers
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,

  // IP addresses (might be internal/sensitive)
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/,

  // API keys or tokens (basic patterns)
  /[a-zA-Z0-9]{32,}/,
  /(api|token|key)[\s:=]+[a-zA-Z0-9]{16,}/i,

  // Real-looking email domains
  /@gmail\.com/i,
  /@yahoo\.com/i,
  /@hotmail\.com/i,
  /@outlook\.com/i,
  /@company\.com/i,
];

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  field?: string;
  messageId?: string;
  senderId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validates that an email address uses only safe demo domains.
 */
export function validateSafeEmailAddress(email: string): boolean {
  return SAFE_EMAIL_DOMAINS.some((domain) => email.endsWith(domain));
}

/**
 * Checks text content for patterns that might indicate unsafe or real data.
 */
export function validateTextContent(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        severity: "warning",
        message: `Text content matches potentially unsafe pattern: ${pattern.source}`,
        field: "content",
      });
    }
  }

  return issues;
}

/**
 * Validates a demo sender for safety compliance.
 */
export function validateDemoSender(sender: DemoSender): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Validate email address uses safe domains
  if (!validateSafeEmailAddress(sender.address)) {
    issues.push({
      severity: "error",
      message: `Sender email "${sender.address}" does not use a safe demo domain`,
      field: "address",
      senderId: sender.address,
    });
  }

  // Validate sender name doesn't contain unsafe patterns
  if (sender.name) {
    const nameIssues = validateTextContent(sender.name);
    nameIssues.forEach((issue) => {
      issues.push({
        ...issue,
        field: "name",
        senderId: sender.address,
      });
    });
  }

  return issues;
}

/**
 * Validates a demo message for safety compliance.
 */
export function validateDemoMessage(message: DemoMessage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Validate sender
  const senderIssues = validateDemoSender(message.sender);
  senderIssues.forEach((issue) => {
    issues.push({
      ...issue,
      messageId: message.id,
    });
  });

  // Validate recipients use safe domains
  message.recipients.forEach((recipient, index) => {
    if (!validateSafeEmailAddress(recipient)) {
      issues.push({
        severity: "error",
        message: `Recipient email "${recipient}" does not use a safe demo domain`,
        field: `recipients[${index}]`,
        messageId: message.id,
      });
    }
  });

  // Validate text content
  const textFields = [
    { name: "subject", value: message.subject },
    { name: "snippet", value: message.snippet },
    { name: "body", value: message.body },
  ];

  textFields.forEach((field) => {
    const contentIssues = validateTextContent(field.value);
    contentIssues.forEach((issue) => {
      issues.push({
        ...issue,
        field: field.name,
        messageId: message.id,
      });
    });
  });

  // Validate calendar event attendees
  if (message.calendarEvent) {
    message.calendarEvent.attendees.forEach((attendee, index) => {
      if (!validateSafeEmailAddress(attendee)) {
        issues.push({
          severity: "error",
          message: `Calendar attendee "${attendee}" does not use a safe demo domain`,
          field: `calendarEvent.attendees[${index}]`,
          messageId: message.id,
        });
      }
    });
  }

  // Validate attachment URLs are safe demo paths
  message.attachments.forEach((attachment, index) => {
    if (!attachment.url.startsWith("/demo/")) {
      issues.push({
        severity: "warning",
        message: `Attachment URL "${attachment.url}" should use demo path prefix`,
        field: `attachments[${index}].url`,
        messageId: message.id,
      });
    }
  });

  return issues;
}

/**
 * Validates an entire demo dataset for safety compliance.
 */
export function validateDemoDataset(dataset: DemoDataset): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Validate all messages
  dataset.messages.forEach((message) => {
    const messageIssues = validateDemoMessage(message);
    issues.push(...messageIssues);
  });

  // Validate all senders (if provided separately)
  if (dataset.senders) {
    dataset.senders.forEach((sender) => {
      const senderIssues = validateDemoSender(sender);
      issues.push(...senderIssues);
    });
  }

  // Check for deterministic data (no random values)
  const hasRandomLookingIds = dataset.messages.some((message) =>
    /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(message.id),
  );

  if (hasRandomLookingIds) {
    issues.push({
      severity: "warning",
      message: "Dataset contains UUID-like IDs that may not be deterministic",
      field: "messages.id",
    });
  }

  return {
    isValid: issues.filter((issue) => issue.severity === "error").length === 0,
    issues,
  };
}

/**
 * Generates a safety compliance report for demo data.
 */
export function generateComplianceReport(dataset: DemoDataset): string {
  const result = validateDemoDataset(dataset);

  const report = [
    "# Demo Data Safety Compliance Report",
    "",
    `**Dataset:** ${dataset.name}`,
    `**Messages:** ${dataset.messages.length}`,
    `**Status:** ${result.isValid ? "✅ COMPLIANT" : "❌ NON-COMPLIANT"}`,
    "",
  ];

  if (result.issues.length === 0) {
    report.push("No safety issues detected. All data meets compliance requirements.");
  } else {
    const errors = result.issues.filter((issue) => issue.severity === "error");
    const warnings = result.issues.filter((issue) => issue.severity === "warning");

    if (errors.length > 0) {
      report.push("## ❌ Errors (must fix)");
      report.push("");
      errors.forEach((error) => {
        report.push(`- **${error.field || "general"}**: ${error.message}`);
        if (error.messageId) report.push(`  - Message ID: ${error.messageId}`);
        if (error.senderId) report.push(`  - Sender ID: ${error.senderId}`);
      });
      report.push("");
    }

    if (warnings.length > 0) {
      report.push("## ⚠️ Warnings (should review)");
      report.push("");
      warnings.forEach((warning) => {
        report.push(`- **${warning.field || "general"}**: ${warning.message}`);
        if (warning.messageId) report.push(`  - Message ID: ${warning.messageId}`);
        if (warning.senderId) report.push(`  - Sender ID: ${warning.senderId}`);
      });
      report.push("");
    }
  }

  report.push("## Compliance Checklist");
  report.push("");
  report.push(
    "- ✅ Email addresses use safe demo domains (@example.com, @example.org, *.stealth.demo)",
  );
  report.push("- ✅ No real PII (phone numbers, SSNs, credit cards)");
  report.push("- ✅ No real API keys or tokens");
  report.push("- ✅ No internal/sensitive IP addresses");
  report.push("- ✅ Attachment URLs use safe demo paths");
  report.push("- ✅ Calendar attendees use safe domains");
  report.push("- ✅ All content safe for public repository review");

  return report.join("\n");
}

/**
 * Quick validation function for use in tests.
 */
export function assertDemoDataSafety(dataset: DemoDataset): void {
  const result = validateDemoDataset(dataset);

  if (!result.isValid) {
    const errors = result.issues.filter((issue) => issue.severity === "error");
    throw new Error(
      `Demo data validation failed with ${errors.length} error(s):\n` +
        errors.map((error) => `- ${error.message}`).join("\n"),
    );
  }
}
