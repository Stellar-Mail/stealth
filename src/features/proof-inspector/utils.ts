export type ValidationResult =
  | { type: "success"; label: string }
  | { type: "warning"; label: string }
  | { type: "error"; label: string }
  | { type: null };

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
    return {
      text: "ⓘ Searching by sender name / subject keywords",
      type: "warning",
    };
  }
}
