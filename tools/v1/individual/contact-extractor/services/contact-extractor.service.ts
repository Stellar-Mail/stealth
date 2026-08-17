import type { ExtractedContact, ContactExtractionResult, ExtractionOptions } from "../types";

let _idCounter = 0;
function generateId(): string {
  return `contact-${String(++_idCounter).padStart(4, "0")}`;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
const HEADER_NAME_RE = /"([^"]+)"\s*<[^>]+>/;
const SIGNATURE_SEPARATORS = ["---", "-- ", "—", "--"];

export interface ContactExtractorServiceConfig {
  delayMs?: number;
}

function parseHeader(rawEmail: string): {
  fromName: string | null;
  fromEmail: string | null;
} {
  const fromLine = rawEmail.match(/^From:\s*(.+)$/m);
  if (!fromLine) return { fromName: null, fromEmail: null };

  const header = fromLine[1].trim();
  const nameMatch = header.match(HEADER_NAME_RE);
  const emailMatch = header.match(EMAIL_RE);

  return {
    fromName: nameMatch ? nameMatch[1].trim() : null,
    fromEmail: emailMatch ? emailMatch[0] : null,
  };
}

function splitBodyAndSignature(rawEmail: string): { body: string; signature: string } {
  const lines = rawEmail.split("\n");
  let signatureStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i];
    if (SIGNATURE_SEPARATORS.some((sep) => trimmed.startsWith(sep))) {
      signatureStart = i;
      break;
    }
  }

  if (signatureStart === -1) {
    return { body: rawEmail, signature: "" };
  }

  const signature = lines.slice(signatureStart).join("\n").trim();
  const bodyLines = lines.slice(0, signatureStart);
  const bodyStart = bodyLines.findIndex(
    (l) =>
      l.trim() !== "" &&
      !l.startsWith("From:") &&
      !l.startsWith("To:") &&
      !l.startsWith("Subject:"),
  );
  const body =
    bodyStart >= 0 ? bodyLines.slice(bodyStart).join("\n").trim() : bodyLines.join("\n").trim();

  return { body, signature };
}

function extractEmails(text: string): string[] {
  return [...new Set(text.match(EMAIL_RE) ?? [])];
}

function extractPhones(text: string): string[] {
  return [...new Set(text.match(PHONE_RE) ?? [])];
}

function isLikelyOrganization(line: string): boolean {
  const orgKeywords = [
    "corp",
    "inc",
    "ltd",
    "llc",
    "company",
    "studio",
    "enterprises",
    "industries",
    "solutions",
    "group",
    "technologies",
    "consulting",
    "partner",
    "agency",
    "co",
    "design",
  ];
  const lower = line.toLowerCase();
  return orgKeywords.some((kw) => lower.includes(kw));
}

function extractOrganizations(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim());
  return lines.filter(
    (line) =>
      line.length > 1 && !line.includes("@") && !line.match(PHONE_RE) && isLikelyOrganization(line),
  );
}

function buildContactFromHeader(rawEmail: string): ExtractedContact | null {
  const { fromName, fromEmail } = parseHeader(rawEmail);
  if (!fromEmail) return null;

  return {
    id: generateId(),
    name: fromName,
    email: fromEmail,
    phone: null,
    organization: null,
    source: "header",
  };
}

function buildContactsFromSignature(signature: string): ExtractedContact[] {
  if (!signature) return [];

  const emails = extractEmails(signature);
  const phones = extractPhones(signature);
  const orgs = extractOrganizations(signature);

  if (emails.length === 0) return [];

  const lines = signature.split("\n").map((l) => l.trim());
  const nameLine = lines.find(
    (line) =>
      line.length > 1 &&
      !line.includes("@") &&
      !line.match(PHONE_RE) &&
      !isLikelyOrganization(line) &&
      !SIGNATURE_SEPARATORS.some((sep) => line.startsWith(sep.trim())),
  );

  return emails.map((email) => ({
    id: generateId(),
    name: nameLine ?? null,
    email,
    phone: phones.length > 0 ? phones[0] : null,
    organization: orgs.length > 0 ? orgs[0] : null,
    source: "signature" as const,
  }));
}

function buildContactsFromBody(body: string): ExtractedContact[] {
  if (!body) return [];
  if (body.split("\n").length < 3) return [];

  const emails = extractEmails(body);
  return emails.map((email) => ({
    id: generateId(),
    name: null,
    email,
    phone: null,
    organization: null,
    source: "body" as const,
  }));
}

function normalize(contact: ExtractedContact): ExtractedContact {
  return {
    ...contact,
    email: contact.email ? contact.email.toLowerCase().trim() : null,
    name: contact.name?.replace(/^["']|["']$/g, "").trim() || null,
  };
}

function deduplicate(contacts: ExtractedContact[]): ExtractedContact[] {
  const map = new Map<string, ExtractedContact>();
  const noEmail: ExtractedContact[] = [];

  for (const c of contacts) {
    if (!c.email) {
      noEmail.push(c);
      continue;
    }
    const key = c.email.toLowerCase().trim();
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        id: existing.id,
        name: existing.name ?? c.name,
        email: key,
        phone: existing.phone ?? c.phone,
        organization: existing.organization ?? c.organization,
        source: existing.source,
      });
    } else {
      map.set(key, { ...c, email: key });
    }
  }

  return [...noEmail, ...map.values()];
}

export function createContactExtractorService(config: ContactExtractorServiceConfig = {}) {
  const { delayMs = 0 } = config;

  async function delay(): Promise<void> {
    if (delayMs > 0) return new Promise((r) => setTimeout(r, delayMs));
  }

  function extract(
    rawEmail: string,
    options: ExtractionOptions = { includeBody: true, dedupe: true },
  ): ContactExtractionResult {
    const contacts: ExtractedContact[] = [];
    const skipped: string[] = [];

    const trimmed = rawEmail.trim();
    if (!trimmed) {
      return { contacts: [], skipped: [] };
    }

    const headerContact = buildContactFromHeader(trimmed);
    if (headerContact) {
      contacts.push(normalize(headerContact));
    } else {
      skipped.push("No valid From header found");
    }

    const { body, signature } = splitBodyAndSignature(trimmed);

    if (signature) {
      const sigContacts = buildContactsFromSignature(signature);
      for (const c of sigContacts) {
        contacts.push(normalize(c));
      }
    }

    if (options.includeBody && body) {
      const bodyContacts = buildContactsFromBody(body);
      for (const c of bodyContacts) {
        contacts.push(normalize(c));
      }
    }

    if (options.dedupe) {
      const before = contacts.length;
      const unique = deduplicate(contacts);
      const duped = before - unique.length;
      if (duped > 0) {
        skipped.push(`Removed ${duped} duplicate(s)`);
      }
      return { contacts: unique, skipped };
    }

    return { contacts, skipped };
  }

  async function extractAsync(
    rawEmail: string,
    options?: ExtractionOptions,
  ): Promise<ContactExtractionResult> {
    await delay();
    return extract(rawEmail, options);
  }

  return { extract, extractAsync, deduplicate };
}
