/* eslint-disable no-control-regex -- guard intentionally strips unsafe control bytes from hostile mail input. */

import type {
  MailToTicketGuardOptions,
  MailToTicketGuardResult,
  MailToTicketInput,
  SanitizedMailToTicketInput,
  TicketPriority,
} from "../types";

const DEFAULT_OPTIONS: MailToTicketGuardOptions = {
  maxSubjectLength: 180,
  maxBodyLength: 24_000,
  maxRecipients: 25,
  maxAttachments: 10,
  maxAttachmentNameLength: 160,
};

const VALID_PRIORITIES = new Set<TicketPriority>(["low", "normal", "high", "urgent"]);

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const HEADER_INJECTION = /(?:\r|\n)\s*(?:bcc|cc|to|from|reply-to|subject):/i;
const SCRIPT_LIKE_CONTENT = /<\/?(?:script|iframe|object|embed|link|meta)\b[^>]*>/gi;

export class MailToTicketSecurityGuard {
  private readonly options: MailToTicketGuardOptions;

  constructor(options: Partial<MailToTicketGuardOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  sanitize(input: MailToTicketInput): MailToTicketGuardResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const subject = this.cleanText(
      input.subject,
      this.options.maxSubjectLength,
      "subject",
      errors,
      warnings,
    );
    const body = this.cleanText(input.body, this.options.maxBodyLength, "body", errors, warnings);
    const from = this.cleanEmail(input.from, "from", errors);
    const to = this.cleanEmailList(input.to ?? [], "to", errors);
    const cc = this.cleanEmailList(input.cc ?? [], "cc", errors);
    const attachmentNames = this.cleanAttachmentNames(
      input.attachmentNames ?? [],
      errors,
      warnings,
    );
    const teamId = this.cleanTeamId(input.teamId, errors);
    const requestedPriority = this.cleanPriority(input.requestedPriority, warnings);

    if (!subject.trim()) {
      errors.push("subject is required");
    }

    if (!body.trim()) {
      errors.push("body is required");
    }

    if (HEADER_INJECTION.test(input.subject) || HEADER_INJECTION.test(input.body)) {
      errors.push("input contains header-injection-like content");
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    const value: SanitizedMailToTicketInput = {
      subject,
      body,
      from,
      to,
      cc,
      attachmentNames,
      teamId,
      requestedPriority,
      warnings,
    };

    return { ok: true, value, errors: [] };
  }

  estimateProcessingCost(input: MailToTicketInput): number {
    const bodyUnits = Math.ceil((input.body?.length ?? 0) / 1_000);
    const recipientUnits = (input.to?.length ?? 0) + (input.cc?.length ?? 0);
    const attachmentUnits = (input.attachmentNames?.length ?? 0) * 2;
    return bodyUnits + recipientUnits + attachmentUnits;
  }

  shouldDefer(input: MailToTicketInput, maxImmediateCost = 40): boolean {
    return this.estimateProcessingCost(input) > maxImmediateCost;
  }

  private cleanText(
    value: string,
    maxLength: number,
    field: string,
    errors: string[],
    warnings: string[],
  ): string {
    if (typeof value !== "string") {
      errors.push(`${field} must be a string`);
      return "";
    }

    const withoutControls = value.replace(CONTROL_CHARACTERS, "");
    const withoutActiveMarkup = withoutControls.replace(
      SCRIPT_LIKE_CONTENT,
      "[removed unsafe markup]",
    );
    const normalized = withoutActiveMarkup.replace(/\s+$/gm, "").trim();

    if (normalized.length > maxLength) {
      warnings.push(`${field} was truncated to ${maxLength} characters`);
      return normalized.slice(0, maxLength).trimEnd();
    }

    if (normalized !== value) {
      warnings.push(`${field} was normalized for safe ticket creation`);
    }

    return normalized;
  }

  private cleanEmail(value: string, field: string, errors: string[]): string {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalized)) {
      errors.push(`${field} must be a valid email address`);
      return "";
    }
    return normalized;
  }

  private cleanEmailList(values: string[], field: string, errors: string[]): string[] {
    if (values.length > this.options.maxRecipients) {
      errors.push(`${field} has too many recipients`);
      return [];
    }

    return values.map((value, index) => this.cleanEmail(value, `${field}[${index}]`, errors));
  }

  private cleanAttachmentNames(names: string[], errors: string[], warnings: string[]): string[] {
    if (names.length > this.options.maxAttachments) {
      errors.push("too many attachments for immediate ticket conversion");
      return [];
    }

    return names.map((name, index) => {
      const cleaned = String(name ?? "")
        .replace(CONTROL_CHARACTERS, "")
        .replace(/[\\/]/g, "_")
        .trim();

      if (!cleaned) {
        errors.push(`attachmentNames[${index}] is empty after sanitization`);
        return "";
      }

      if (cleaned.length > this.options.maxAttachmentNameLength) {
        warnings.push(`attachmentNames[${index}] was truncated`);
        return cleaned.slice(0, this.options.maxAttachmentNameLength).trimEnd();
      }

      return cleaned;
    });
  }

  private cleanTeamId(value: string | undefined, errors: string[]): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(normalized)) {
      errors.push(
        "teamId must be an opaque id containing only letters, numbers, dash, or underscore",
      );
      return null;
    }

    return normalized;
  }

  private cleanPriority(value: TicketPriority | undefined, warnings: string[]): TicketPriority {
    if (!value) {
      return "normal";
    }

    if (!VALID_PRIORITIES.has(value)) {
      warnings.push("requestedPriority was not recognized and defaulted to normal");
      return "normal";
    }

    return value;
  }
}
