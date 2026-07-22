import type {
  ColdEmailTone,
  ColdEmailWriterInput,
  ColdEmailWriterOptions,
  ColdEmailWriterOutput,
} from "../types/coldEmailWriter";

export const DEFAULT_MAX_BODY_WORDS = 120;
export const MAX_BODY_WORDS_LIMIT = 300;

function words(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

function truncateWords(value: string, limit: number): string {
  const tokens = words(value);
  return tokens.length <= limit ? value : `${tokens.slice(0, limit).join(" ")}…`;
}

function resolveTone(tone: ColdEmailTone | undefined): ColdEmailTone {
  return tone ?? "professional";
}

function openingFor(input: ColdEmailWriterInput, tone: ColdEmailTone): string {
  const context = input.recipient.company
    ? ` at ${input.recipient.company}`
    : input.recipient.role
      ? ` in your role as ${input.recipient.role}`
      : "";
  if (tone === "friendly") {
    return `Hi ${input.recipient.name}, I thought this might be useful for you${context}.`;
  }
  if (tone === "direct") {
    return `Hi ${input.recipient.name}, I am reaching out about ${input.offer}${context}.`;
  }
  return `Hello ${input.recipient.name}, I am reaching out because ${input.offer} may be relevant to you${context}.`;
}

/** Pure execution engine for payloads that have already been validated. */
export function writeColdEmail(
  input: ColdEmailWriterInput,
  options: ColdEmailWriterOptions = {},
): ColdEmailWriterOutput {
  const tone = resolveTone(input.tone);
  const proof = (input.proofPoints ?? []).map((point) => point.trim()).filter(Boolean);
  const paragraphs = [
    openingFor(input, tone),
    input.valueProposition,
    proof.length > 0 ? `Relevant results: ${proof.join("; ")}.` : "",
    input.callToAction,
    `Best,\n${input.sender.name}`,
  ].filter(Boolean);
  const maxWords = Math.trunc(options.maxBodyWords ?? DEFAULT_MAX_BODY_WORDS);
  const body = truncateWords(paragraphs.join("\n\n"), maxWords);

  return {
    requestId: input.requestId,
    subject: options.includeSubject === false ? null : `${input.offer} for ${input.recipient.name}`,
    body,
    tone,
    metadata: {
      wordCount: words(body).length,
      proofPointsUsed: proof.length,
    },
  };
}
