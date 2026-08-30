const SECRET_PATTERNS: RegExp[] = [
  /Password123![ab]?/gi,
  /\bS[A-Z2-7]{55}\b/g,
  /stealth_session=[^;\s]+/g,
  /[0-9a-f]{64}/gi,
];

/** Strip high-entropy and credential-like substrings from free-text feedback notes. */
export function redactFeedbackNote(note: string): string {
  let out = note.slice(0, 500);
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out.trim();
}
