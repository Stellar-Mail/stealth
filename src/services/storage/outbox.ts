/**
 * Outbox persistence.
 *
 * Stores outbound messages and their delivery state in localStorage so an
 * in-flight send survives a page refresh. Only the encrypted envelope and
 * delivery metadata are persisted; plaintext is never written here.
 */
import type { EnvelopePayload } from "@/services/crypto/envelope";

export type OutboxStatus =
  | "queued"
  | "encrypting"
  | "awaiting_signature"
  | "reserving_postage"
  | "submitting"
  | "delivered"
  | "failed";

export interface OutboxEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  subject: string;
  recipients: string[];
  status: OutboxStatus;
  attempts: number;
  errorCode?: string;
  errorMessage?: string;
  envelope?: EnvelopePayload;
  ciphertext?: string;
}

const STORAGE_KEY = "stealth.outbox.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readAll(): OutboxEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: OutboxEntry[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore quota / serialization failures; persistence is best-effort.
  }
}

export function listOutbox(): OutboxEntry[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getEntry(id: string): OutboxEntry | undefined {
  return readAll().find((entry) => entry.id === id);
}

export function upsertEntry(entry: OutboxEntry): OutboxEntry {
  const entries = readAll();
  const next = { ...entry, updatedAt: new Date().toISOString() };
  const index = entries.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    entries[index] = next;
  } else {
    entries.push(next);
  }
  writeAll(entries);
  return next;
}

export function patchEntry(
  id: string,
  patch: Partial<Omit<OutboxEntry, "id">>,
): OutboxEntry | undefined {
  const entries = readAll();
  const index = entries.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  const next = {
    ...entries[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  entries[index] = next;
  writeAll(entries);
  return next;
}

export function removeEntry(id: string): void {
  writeAll(readAll().filter((entry) => entry.id !== id));
}

export function createEntry(input: {
  id: string;
  subject: string;
  recipients: string[];
}): OutboxEntry {
  const now = new Date().toISOString();
  return upsertEntry({
    id: input.id,
    createdAt: now,
    updatedAt: now,
    subject: input.subject,
    recipients: input.recipients,
    status: "queued",
    attempts: 0,
  });
}
