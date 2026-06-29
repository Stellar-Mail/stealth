import { parseImportCsv, validateImportAddress } from "./import";
import type { ImportedContact } from "./types";

export function blankContact(): ImportedContact {
  return {
    id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    address: "",
    trust: "default",
    error: null,
  };
}

export function revalidate(contact: ImportedContact): ImportedContact {
  return {
    ...contact,
    error: validateImportAddress(contact.address),
  };
}

export function parseCsv(raw: string): ImportedContact[] {
  return parseImportCsv(raw).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    trust: row.trust,
    error: row.error,
  }));
}

export function findDuplicateAddresses(contacts: ImportedContact[]): Set<string> {
  const counts = new Map<string, number>();

  for (const contact of contacts) {
    const key = contact.address.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}
