import type { Email } from "@/components/mail/data";

export interface MockProofRecord {
  emailId: string;
  messageHash: string;
  paymentHash: string;
  diagnosticId: string;
  contractAddress: string;
  relayNode: string;
  latency: string;
  signature: string;
  deliveredAt: string;
  readAt: string | null;
  postageAmount: string;
  postageStatus: "pending" | "settled" | "refunded";
  senderRule: "allow" | "block" | "default";
  email: Email;
}

export type ValidationResult =
  | { type: "success"; label: string }
  | { type: "warning"; label: string }
  | { type: "error"; label: string }
  | { type: null };

export function generateMockProofRecords(emails: Email[]): MockProofRecord[] {
  return emails.map((email) => {
    const messageHash = `0x${email.id.repeat(16).padEnd(64, "a")}d8c7e9`;
    const paymentHash = `0x${(email.id + "pay").repeat(12).padEnd(64, "b")}f12a3d`;
    const diagnosticId = `d1f038c7-4b1d-44a6-8968-3e5f492305${email.id.padStart(2, "0")}`;
    const contractAddress = `CB${email.id.repeat(10).toUpperCase().padEnd(54, "9")}`;

    return {
      emailId: email.id,
      messageHash,
      paymentHash,
      diagnosticId,
      contractAddress,
      relayNode: "relay-us-east-1.stealth.network",
      latency: `${20 + (email.from.length % 5) * 6}ms`,
      signature: `Ed25519 [0x${email.id.repeat(8).padEnd(32, "7")}f31b]`,
      deliveredAt:
        email.time.includes("AM") || email.time.includes("PM")
          ? "Today, " + email.time
          : email.time,
      readAt: email.unread ? null : "Delivered + Read",
      postageAmount: email.postageAmount ?? "10000000",
      postageStatus:
        email.folder === "requests" ? "pending" : email.folder === "spam" ? "refunded" : "settled",
      senderRule: email.senderPolicy === "verify" ? "default" : (email.senderPolicy ?? "default"),
      email,
    };
  });
}

export function validateProofQuery(query: string): {
  text: string;
  type: "success" | "warning" | "error" | null;
} {
  const trimmed = query.trim();
  if (!trimmed) {
    return { text: "", type: null };
  }

  const addressRegex = /^[GC][A-Z2-7]{55}$/i;
  const hashRegex = /^(0x)?[a-f0-9]{64}$/i;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (addressRegex.test(trimmed)) {
    return { text: "✓ Valid Stellar address format", type: "success" };
  } else if (hashRegex.test(trimmed)) {
    return { text: "✓ Valid 32-byte hash format", type: "success" };
  } else if (uuidRegex.test(trimmed)) {
    return { text: "✓ Valid Relay diagnostic ID format", type: "success" };
  } else if (
    trimmed.length > 5 &&
    (trimmed.startsWith("G") || trimmed.startsWith("C")) &&
    trimmed.length !== 56
  ) {
    return {
      text: `✗ Invalid address length (${trimmed.length}/56 characters)`,
      type: "error",
    };
  } else if (
    trimmed.length > 10 &&
    trimmed.match(/^[0-9a-f]+$/i) &&
    trimmed.length !== 64 &&
    !trimmed.startsWith("0x")
  ) {
    return {
      text: `✗ Invalid hash length (${trimmed.length}/64 hex characters)`,
      type: "error",
    };
  } else {
    return { text: "ⓘ Searching by sender name / subject keywords", type: "warning" };
  }
}

export function searchProofRecords(records: MockProofRecord[], query: string): MockProofRecord[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  return records.filter((record) => {
    if (record.messageHash.toLowerCase().includes(trimmed)) return true;
    if (record.paymentHash.toLowerCase().includes(trimmed)) return true;
    if (record.diagnosticId.toLowerCase().includes(trimmed)) return true;
    if (record.contractAddress.toLowerCase().includes(trimmed)) return true;
    if (record.email.email.toLowerCase().includes(trimmed)) return true;
    if (record.email.from.toLowerCase().includes(trimmed)) return true;
    if (record.email.subject.toLowerCase().includes(trimmed)) return true;
    return false;
  });
}
