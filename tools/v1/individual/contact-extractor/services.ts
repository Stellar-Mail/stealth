import type {
  ContactConfidence,
  ContactExtractionRequest,
  ContactExtractionResult,
  ExtractedContact,
} from "./types";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN =
  /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const NAME_BEFORE_EMAIL_PATTERN =
  /(?:from|contact|reach|cc|with|by|owner|manager)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*[<,(]/g;
const SIGNATURE_NAME_PATTERN =
  /(?:thanks|regards|best|cheers),?\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/gi;
const ORGANIZATION_PATTERN =
  /\b(?:at|from|for)\s+([A-Z][A-Za-z0-9&.-]+(?:\s+[A-Z][A-Za-z0-9&.-]+){0,3})\b/g;

export function extractContacts(request: ContactExtractionRequest): ContactExtractionResult {
  const text = normalizeWhitespace(`${request.subject}\n${request.from}\n${request.body}`);

  if (!text.trim()) {
    return {
      requestId: request.id,
      sourceLabel: request.sourceLabel,
      status: "error",
      contacts: [],
      error: "Add email text before extracting contacts.",
    };
  }

  const emails = findMatches(text, EMAIL_PATTERN);
  const phones = findMatches(text, PHONE_PATTERN);
  const names = uniqueValues([
    ...findCapturedValues(text, NAME_BEFORE_EMAIL_PATTERN),
    ...findCapturedValues(text, SIGNATURE_NAME_PATTERN),
  ]);
  const organizations = findCapturedValues(text, ORGANIZATION_PATTERN).filter(
    (value) => !looksLikePersonName(value),
  );

  const contacts = buildContacts({ text, emails, phones, names, organizations });

  if (contacts.length === 0) {
    return {
      requestId: request.id,
      sourceLabel: request.sourceLabel,
      status: "error",
      contacts: [],
      error: "No contact details were found in the supplied email text.",
    };
  }

  return {
    requestId: request.id,
    sourceLabel: request.sourceLabel,
    status: "success",
    contacts,
  };
}

export function summarizeContacts(contacts: ExtractedContact[]) {
  return {
    total: contacts.length,
    complete: contacts.filter((contact) => contact.email && contact.displayName !== "Unknown contact")
      .length,
    withPhone: contacts.filter((contact) => Boolean(contact.phone)).length,
    needsReview: contacts.filter((contact) => contact.warnings.length > 0).length,
  };
}

function buildContacts({
  text,
  emails,
  phones,
  names,
  organizations,
}: {
  text: string;
  emails: string[];
  phones: string[];
  names: string[];
  organizations: string[];
}): ExtractedContact[] {
  const emailContacts = emails.map((email, index) => {
    const displayName = names[index] ?? inferNameFromEmail(email);
    const organization = organizations[index] ?? inferOrganizationFromEmail(email);
    const phone = phones[index];
    const warnings = buildWarnings({ displayName, email, phone });

    return {
      id: stableContactId(email, index),
      displayName,
      email,
      phone,
      organization,
      confidence: scoreConfidence({ displayName, email, phone }) as ContactConfidence,
      evidence: evidenceFor(text, email),
      warnings,
    };
  });

  if (emailContacts.length > 0) {
    return emailContacts;
  }

  return phones.map((phone, index) => {
    const displayName = names[index] ?? "Unknown contact";
    const warnings = buildWarnings({ displayName, phone });

    return {
      id: stableContactId(phone, index),
      displayName,
      phone,
      organization: organizations[index],
      confidence: scoreConfidence({ displayName, phone }) as ContactConfidence,
      evidence: evidenceFor(text, phone),
      warnings,
    };
  });
}

function buildWarnings({
  displayName,
  email,
  phone,
}: {
  displayName: string;
  email?: string;
  phone?: string;
}) {
  const warnings: string[] = [];

  if (displayName === "Unknown contact") {
    warnings.push("missing-name");
  }

  if (!email) {
    warnings.push("missing-email");
  }

  if (!phone) {
    warnings.push("missing-phone");
  }

  return warnings;
}

function scoreConfidence({
  displayName,
  email,
  phone,
}: {
  displayName: string;
  email?: string;
  phone?: string;
}): ContactConfidence {
  if (email && phone && displayName !== "Unknown contact") {
    return "high";
  }

  if (email && displayName !== "Unknown contact") {
    return "medium";
  }

  return "low";
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function findMatches(text: string, pattern: RegExp) {
  return uniqueValues(Array.from(text.matchAll(pattern)).map((match) => match[0].trim()));
}

function findCapturedValues(text: string, pattern: RegExp) {
  return uniqueValues(
    Array.from(text.matchAll(pattern))
      .map((match) => match[1]?.trim())
      .filter((value): value is string => Boolean(value)),
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function inferNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const words = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  return words.length > 0 ? words.join(" ") : "Unknown contact";
}

function inferOrganizationFromEmail(email: string) {
  const domain = email.split("@")[1]?.split(".")[0];
  if (!domain || ["gmail", "outlook", "yahoo", "icloud", "proton"].includes(domain)) {
    return undefined;
  }

  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

function looksLikePersonName(value: string) {
  const words = value.split(/\s+/);
  return words.length <= 2 && words.every((word) => /^[A-Z][a-z]+$/.test(word));
}

function evidenceFor(text: string, needle: string) {
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) {
    return needle;
  }

  const start = Math.max(0, index - 42);
  const end = Math.min(text.length, index + needle.length + 42);
  return text.slice(start, end).replace(/\n/g, " ");
}

function stableContactId(value: string, index: number) {
  return `${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${index + 1}`;
}
