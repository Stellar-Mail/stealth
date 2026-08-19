import type { SenderRule } from "@/server/api/domain";

// Live client for the /api/v1/contacts endpoints (BETA-066 / Issue #1973).
// The server routes derive the owner from the x-stealth-address actor header,
// so every call forwards the authenticated actor address.

export class ContactsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ContactsApiError";
  }
}

function isGAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim().toUpperCase());
}

async function contactsFetch<T>(path: string, actor: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "x-stealth-address": actor,
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const response = await fetch(`/api/v1/contacts${path}`, { ...init, headers });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string; code?: string };
  } | null;
  if (!response.ok) {
    throw new ContactsApiError(
      body?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      body?.error?.code,
    );
  }
  return body?.data as T;
}

export type ContactResolutionIdentity = {
  identifier?: string;
  canonicalAddress?: string;
  resolved?: boolean;
  status?: string;
} | null;

export type ContactWithResolution = {
  contact: {
    contactId: string;
    name: string;
    address: string;
    canonicalAddress: string | null;
    trust: SenderRule;
    source: string;
    createdAt: string;
    updatedAt: string;
    version: number;
  };
  resolution: {
    identity: ContactResolutionIdentity;
    senderRule: SenderRule;
    senderRuleConfigured: boolean;
  };
};

export type ContactListResult = {
  items: ContactWithResolution[];
  nextContinuationKey: string | null;
};

export type ImportPreviewResult = {
  format: "csv" | "vcard";
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  truncated: boolean;
  limit: { maxRows: number };
  rows: Array<{
    rowNumber: number;
    name: string;
    address: string;
    status: "valid" | "duplicate" | "error";
    error: string | null;
    canonicalAddress: string | null;
    existing: { contactId: string; trust: SenderRule } | null;
  }>;
};

export type ImportCommitResult = {
  created: number;
  updated: number;
  unchanged: number;
  rejected: number;
  total: number;
  appliedRules: number;
  contacts: ContactWithResolution["contact"][];
};

export async function listContacts(
  actor: string,
  options: { query?: string; cursor?: string; limit?: number } = {},
): Promise<ContactListResult> {
  const params = new URLSearchParams();
  if (options.query) params.set("query", options.query);
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  const qs = params.toString();
  return contactsFetch<ContactListResult>(`?${qs}`, actor);
}

export async function createContact(
  actor: string,
  input: { name: string; address: string; trust?: SenderRule },
): Promise<ContactWithResolution> {
  return contactsFetch<ContactWithResolution>("/", actor, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getContact(actor: string, contactId: string): Promise<ContactWithResolution> {
  return contactsFetch<ContactWithResolution>(`/${encodeURIComponent(contactId)}`, actor);
}

export async function updateContact(
  actor: string,
  contactId: string,
  input: { name?: string; address?: string; trust?: SenderRule; expectedVersion?: number },
): Promise<ContactWithResolution> {
  return contactsFetch<ContactWithResolution>(`/${encodeURIComponent(contactId)}`, actor, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteContact(actor: string, contactId: string): Promise<void> {
  await contactsFetch<unknown>(`/${encodeURIComponent(contactId)}`, actor, {
    method: "DELETE",
  });
}

export async function mergeContacts(
  actor: string,
  input: { keepContactId: string; mergeContactIds: string[] },
): Promise<ContactWithResolution> {
  return contactsFetch<ContactWithResolution>("/merge", actor, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function previewContactImport(
  actor: string,
  input: { format: "csv" | "vcard"; content: string },
): Promise<ImportPreviewResult> {
  return contactsFetch<ImportPreviewResult>("/import/preview", actor, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function commitContactImport(
  actor: string,
  input: {
    rows: Array<{ name: string; address: string; trust?: SenderRule; source?: "csv" | "vcard" }>;
    applyTrust?: boolean;
  },
): Promise<ImportCommitResult> {
  return contactsFetch<ImportCommitResult>("/import/commit", actor, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export { isGAddress };
