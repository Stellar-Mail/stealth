export interface RawDigestEmail {
  id?: unknown;
  sender?: unknown;
  subject?: unknown;
  receivedAt?: unknown;
  body?: unknown;
  labels?: unknown;
  attachments?: unknown;
}

export interface GuardedDigestEmail {
  id: string;
  sender: string;
  subject: string;
  receivedAt: string;
  body: string;
  labels: string[];
  attachments: string[];
  wasTruncated: boolean;
}

export interface DigestGuardOptions {
  maxEmails?: number;
  maxBodyCharacters?: number;
  maxTextFieldCharacters?: number;
  maxLabels?: number;
  maxAttachments?: number;
}

export interface DigestGuardReport {
  acceptedCount: number;
  rejectedCount: number;
  truncatedCount: number;
  warnings: string[];
}

export interface DigestGuardResult {
  emails: GuardedDigestEmail[];
  report: DigestGuardReport;
}

export const DEFAULT_DIGEST_GUARD_OPTIONS: Required<DigestGuardOptions> = {
  maxEmails: 50,
  maxBodyCharacters: 8_000,
  maxTextFieldCharacters: 180,
  maxLabels: 12,
  maxAttachments: 10,
};

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const HTML_TAG_PATTERN = /<[^>]*>/g;
const WHITESPACE_PATTERN = /\s+/g;

function resolveOptions(options: DigestGuardOptions): Required<DigestGuardOptions> {
  return {
    maxEmails: resolvePositiveInteger(options.maxEmails, DEFAULT_DIGEST_GUARD_OPTIONS.maxEmails),
    maxBodyCharacters: resolvePositiveInteger(
      options.maxBodyCharacters,
      DEFAULT_DIGEST_GUARD_OPTIONS.maxBodyCharacters,
    ),
    maxTextFieldCharacters: resolvePositiveInteger(
      options.maxTextFieldCharacters,
      DEFAULT_DIGEST_GUARD_OPTIONS.maxTextFieldCharacters,
    ),
    maxLabels: resolvePositiveInteger(options.maxLabels, DEFAULT_DIGEST_GUARD_OPTIONS.maxLabels),
    maxAttachments: resolvePositiveInteger(
      options.maxAttachments,
      DEFAULT_DIGEST_GUARD_OPTIONS.maxAttachments,
    ),
  };
}

function resolvePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxCharacters: number): { value: string; truncated: boolean } {
  if (typeof value !== "string") {
    return { value: "", truncated: false };
  }

  const cleaned = value
    .replace(CONTROL_CHARACTER_PATTERN, "")
    .replace(HTML_TAG_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();

  if (cleaned.length <= maxCharacters) {
    return { value: cleaned, truncated: false };
  }

  return {
    value: cleaned.slice(0, maxCharacters).trimEnd(),
    truncated: true,
  };
}

function cleanStringList(
  value: unknown,
  maxItems: number,
  maxCharacters: number,
): { values: string[]; truncated: boolean } {
  if (!Array.isArray(value)) {
    return { values: [], truncated: false };
  }

  const values: string[] = [];
  let truncated = value.length > maxItems;

  for (const item of value.slice(0, maxItems)) {
    const cleaned = cleanText(item, maxCharacters);
    if (cleaned.value.length > 0 && !values.includes(cleaned.value)) {
      values.push(cleaned.value);
    }
    truncated = truncated || cleaned.truncated;
  }

  return { values, truncated };
}

function buildStableId(index: number, sender: string, subject: string): string {
  const source = `${sender}-${subject}-${index}`.toLowerCase();
  const slug = source.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug.length > 0 ? slug.slice(0, 80) : `digest-email-${index + 1}`;
}

function guardEmail(
  rawEmail: unknown,
  index: number,
  options: Required<DigestGuardOptions>,
): { email: GuardedDigestEmail | null; warnings: string[] } {
  const warnings: string[] = [];

  if (!isRecord(rawEmail)) {
    return {
      email: null,
      warnings: [`Email ${index + 1} was rejected because it is not an object.`],
    };
  }

  const sender = cleanText(rawEmail.sender, options.maxTextFieldCharacters);
  const subject = cleanText(rawEmail.subject, options.maxTextFieldCharacters);
  const receivedAt = cleanText(rawEmail.receivedAt, options.maxTextFieldCharacters);
  const body = cleanText(rawEmail.body, options.maxBodyCharacters);
  const id = cleanText(rawEmail.id, options.maxTextFieldCharacters);
  const labels = cleanStringList(
    rawEmail.labels,
    options.maxLabels,
    options.maxTextFieldCharacters,
  );
  const attachments = cleanStringList(
    rawEmail.attachments,
    options.maxAttachments,
    options.maxTextFieldCharacters,
  );

  if (sender.value.length === 0 || subject.value.length === 0 || body.value.length === 0) {
    return {
      email: null,
      warnings: [`Email ${index + 1} was rejected because sender, subject, and body are required.`],
    };
  }

  const wasTruncated =
    sender.truncated ||
    subject.truncated ||
    receivedAt.truncated ||
    body.truncated ||
    id.truncated ||
    labels.truncated ||
    attachments.truncated;

  if (wasTruncated) {
    warnings.push(`Email ${index + 1} exceeded one or more local processing limits.`);
  }

  return {
    email: {
      id: id.value || buildStableId(index, sender.value, subject.value),
      sender: sender.value,
      subject: subject.value,
      receivedAt: receivedAt.value,
      body: body.value,
      labels: labels.values,
      attachments: attachments.values,
      wasTruncated,
    },
    warnings,
  };
}

export function guardDigestEmails(
  input: unknown,
  guardOptions: DigestGuardOptions = {},
): DigestGuardResult {
  const options = resolveOptions(guardOptions);
  const warnings: string[] = [];

  if (!Array.isArray(input)) {
    return {
      emails: [],
      report: {
        acceptedCount: 0,
        rejectedCount: 0,
        truncatedCount: 0,
        warnings: ["Mailbox snapshot was rejected because it is not an array."],
      },
    };
  }

  const emails: GuardedDigestEmail[] = [];
  let rejectedCount = 0;
  let truncatedCount = 0;

  if (input.length > options.maxEmails) {
    warnings.push(`Mailbox snapshot was capped at ${options.maxEmails} emails.`);
  }

  for (const [index, rawEmail] of input.slice(0, options.maxEmails).entries()) {
    const guarded = guardEmail(rawEmail, index, options);
    warnings.push(...guarded.warnings);

    if (guarded.email === null) {
      rejectedCount += 1;
      continue;
    }

    if (guarded.email.wasTruncated) {
      truncatedCount += 1;
    }

    emails.push(guarded.email);
  }

  return {
    emails,
    report: {
      acceptedCount: emails.length,
      rejectedCount,
      truncatedCount,
      warnings,
    },
  };
}
