import type { ImportedContact } from "./types";

/**
 * Validate an address field.
 * Accepts Stellar G-addresses (56 chars, starts with G) or federation addresses (contains *).
 */
function validateAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) return "Address is required.";
  if (trimmed.includes("*")) return null; // federation address
  if (/^G[A-Z2-7]{55}$/.test(trimmed)) return null; // Stellar public key
  return "Not a valid Stellar address or federation address (name*domain).";
}

/**
 * Parse pasted/uploaded CSV text into ImportedContact rows.
 * Accepts two column formats (with or without a header row):
 *   name,address   OR   address  (name defaults to empty)
 */
export function parseCsv(raw: string): ImportedContact[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Skip an obvious header row
  const dataLines =
    lines[0]?.toLowerCase().replace(/\s/g, "") === "name,address" ||
    lines[0]?.toLowerCase() === "address"
      ? lines.slice(1)
      : lines;

  return dataLines.map((line, i) => {
    const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    const [first, second] = parts;
    const name = second !== undefined ? first : "";
    const address = second !== undefined ? second : first;
    return {
      id: `import-${i}-${Date.now()}`,
      name,
      address,
      trust: "default",
      error: validateAddress(address),
    };
  });
}

/**
 * Build a single blank contact for manual entry.
 */
export function blankContact(): ImportedContact {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    address: "",
    trust: "default",
    error: "Address is required.",
  };
}

/**
 * Re-validate a contact after the user edits it.
 */
export function revalidate(contact: ImportedContact): ImportedContact {
  return { ...contact, error: validateAddress(contact.address) };
}

/**
 * Detect duplicate addresses among a list (case-insensitive).
 * Returns a Set of addresses that appear more than once.
 */
export function findDuplicateAddresses(contacts: ImportedContact[]): Set<string> {
  const seen = new Map<string, number>();
  for (const c of contacts) {
    const key = c.address.trim().toLowerCase();
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
}
