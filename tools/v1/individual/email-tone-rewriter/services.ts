export const SUPPORTED_TONES = ["concise", "friendly", "formal", "apologetic"] as const;

export type SupportedTone = (typeof SUPPORTED_TONES)[number];

export type RewriteStatus = "idle" | "loading" | "success" | "error";

export interface ToneRewriteDraft {
  subject?: string;
  bodyText: string;
  tone: SupportedTone;
  maxSentences?: number;
}

export interface ToneRewriteResult {
  status: RewriteStatus;
  subject: string;
  tone: SupportedTone;
  rewrittenBody: string;
  preservedKeyPoints: string[];
  sendDisabled: true;
  saveDisabled: true;
  validationErrors: string[];
}

export interface ToneRewriteErrorResult {
  status: "error";
  rewrittenBody: "";
  preservedKeyPoints: string[];
  sendDisabled: true;
  saveDisabled: true;
  validationErrors: string[];
}

export const DEFAULT_MAX_SENTENCES = 4;

const toneOpeners: Record<SupportedTone, string> = {
  concise: "Hi,",
  friendly: "Hi there,",
  formal: "Hello,",
  apologetic: "Hi, and thank you for your patience.",
};

const toneClosers: Record<SupportedTone, string> = {
  concise: "Thanks.",
  friendly: "Thanks so much!",
  formal: "Thank you for your time.",
  apologetic: "Sorry again for the inconvenience, and thank you for understanding.",
};

const factPattern =
  /(?:https?:\/\/\S+|\$\d+(?:\.\d{1,2})?|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?\b|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b)/g;

export function validateRewriteInput(input: Partial<ToneRewriteDraft>): string[] {
  const errors: string[] = [];

  if (!input.bodyText || input.bodyText.trim().length === 0) {
    errors.push("Draft body is required.");
  }

  if (!input.tone || !SUPPORTED_TONES.includes(input.tone as SupportedTone)) {
    errors.push(`Tone must be one of: ${SUPPORTED_TONES.join(", ")}.`);
  }

  if (
    input.maxSentences !== undefined &&
    (!Number.isInteger(input.maxSentences) || input.maxSentences < 1)
  ) {
    errors.push("maxSentences must be a positive integer when provided.");
  }

  return errors;
}

export function extractPreservedKeyPoints(bodyText: string): string[] {
  const facts = new Set<string>();
  for (const match of bodyText.matchAll(factPattern)) {
    const value = match[0].replace(/[.,;:!?)]$/, "");
    if (value.length > 1 && !["Hi", "Hello", "Thanks", "Thank"].includes(value)) {
      facts.add(value);
    }
  }

  const actionSentences = splitSentences(bodyText).filter((sentence) =>
    /\b(please|need|needs|review|send|confirm|schedule|approve|update|reply|call)\b/i.test(
      sentence,
    ),
  );

  return [...facts, ...actionSentences.map((sentence) => sentence.trim())]
    .filter(Boolean)
    .slice(0, 8);
}

export function rewriteEmailTone(
  input: ToneRewriteDraft,
): ToneRewriteResult | ToneRewriteErrorResult {
  const validationErrors = validateRewriteInput(input);
  const preservedKeyPoints = input.bodyText ? extractPreservedKeyPoints(input.bodyText) : [];

  if (validationErrors.length > 0) {
    return {
      status: "error",
      rewrittenBody: "",
      preservedKeyPoints,
      sendDisabled: true,
      saveDisabled: true,
      validationErrors,
    };
  }

  const subject = normalizeWhitespace(input.subject || "");
  const sentences = splitSentences(input.bodyText);
  const maxSentences = input.maxSentences ?? DEFAULT_MAX_SENTENCES;
  const body = sentences.slice(0, maxSentences).map((sentence) => applyTone(sentence, input.tone));

  const rewrittenBody = [toneOpeners[input.tone], ...body, toneClosers[input.tone]]
    .filter(Boolean)
    .join("\n\n");

  return {
    status: "success",
    subject,
    tone: input.tone,
    rewrittenBody,
    preservedKeyPoints,
    sendDisabled: true,
    saveDisabled: true,
    validationErrors: [],
  };
}

function splitSentences(text: string): string[] {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function applyTone(sentence: string, tone: SupportedTone): string {
  const clean = normalizeWhitespace(sentence).replace(/!+/g, ".");

  if (tone === "concise") {
    return clean.replace(/\b(just|really|very|actually|basically)\b\s*/gi, "");
  }

  if (tone === "formal") {
    return clean
      .replace(/\bcan't\b/gi, "cannot")
      .replace(/\bwon't\b/gi, "will not")
      .replace(/\bASAP\b/g, "as soon as possible");
  }

  if (tone === "apologetic") {
    return /\b(sorry|apologize|apology)\b/i.test(clean)
      ? clean
      : `I apologize for the friction here. ${clean}`;
  }

  return clean.replace(/\.$/, "") + ".";
}
