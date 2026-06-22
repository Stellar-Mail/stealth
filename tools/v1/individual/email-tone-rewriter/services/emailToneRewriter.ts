/**
 * Email Tone Rewriter — core feature engine.
 *
 * Pure, deterministic, rule-based rewriting of a single email draft into a
 * requested tone. No network calls, no mailbox mutations, and no external AI
 * providers: every transformation rephrases text the user already wrote and
 * preserves the factual key points for review before any action is taken.
 */

export type ToneId = "concise" | "friendly" | "formal" | "apologetic";

export const SUPPORTED_TONES: ToneId[] = ["concise", "friendly", "formal", "apologetic"];

export interface RewriteRequest {
  /** Optional fixture/correlation id; ignored by the engine. */
  id?: string;
  subject: string;
  bodyText: string;
  tone: ToneId;
  /** Optional soft word cap. Filler-only sentences are trimmed first. */
  maxWords?: number;
}

/** The engine never sends, saves, or mutates anything. */
export interface RewriteActionFlags {
  canSend: false;
  canSave: false;
  canMutate: false;
}

export interface ToneRewrite {
  tone: ToneId;
  rewrittenBody: string;
  preservedKeyPoints: string[];
  wordCount: number;
  truncated: boolean;
  changed: boolean;
  actions: RewriteActionFlags;
  source: {
    subject: string;
    bodyText: string;
  };
}

export type RewriterErrorCode = "empty-body" | "unsupported-tone" | "unsupported-input";

export type RewriterResult =
  | { status: "ok"; rewrite: ToneRewrite }
  | { status: "error"; code: RewriterErrorCode; message: string };

/** Lifecycle states a reviewing UI can render around a rewrite call. */
export type RewriterState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; rewrite: ToneRewrite }
  | { status: "error"; code: RewriterErrorCode; message: string };

const DISABLED_ACTIONS: RewriteActionFlags = {
  canSend: false,
  canSave: false,
  canMutate: false,
};

type ReplacementRule = [RegExp, string];

const CONTRACTIONS: ReplacementRule[] = [
  [/\bdon't\b/gi, "do not"],
  [/\bdoesn't\b/gi, "does not"],
  [/\bdidn't\b/gi, "did not"],
  [/\bcan't\b/gi, "cannot"],
  [/\bwon't\b/gi, "will not"],
  [/\bI'm\b/gi, "I am"],
  [/\bit's\b/gi, "it is"],
  [/\bwe're\b/gi, "we are"],
  [/\byou're\b/gi, "you are"],
  [/\bI'll\b/gi, "I will"],
  [/\bwe'll\b/gi, "we will"],
];

const CASUAL_GREETINGS: ReplacementRule[] = [
  [/\bhey\b/gi, "Hello"],
  [/\bhi\b/gi, "Hello"],
  [/\byeah\b/gi, "yes"],
  [/\bthanks\b/gi, "thank you"],
];

const FORMAL_PHRASES: ReplacementRule[] = [
  [/\bcan you\b/gi, "could you please"],
  [/\bwanna\b/gi, "would like to"],
  [/\bgonna\b/gi, "going to"],
];

const FRIENDLY_REPLACEMENTS: ReplacementRule[] = [
  [/\bhey\b/gi, "Hi"],
  [/\bis late\b/gi, "is running a little behind"],
  [/\bregards\b/gi, "thanks so much"],
];

const FILLERS: RegExp[] = [
  /\bjust\b/gi,
  /\breally\b/gi,
  /\bbasically\b/gi,
  /\bactually\b/gi,
  /\bvery\b/gi,
];

/** Deterministic sentence splitter. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** Collapses whitespace and removes spaces left before punctuation. */
export function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

/** Capitalizes the first letter of every sentence. */
export function capitalizeSentences(text: string): string {
  return splitSentences(text)
    .map((sentence) => sentence.charAt(0).toUpperCase() + sentence.slice(1))
    .join(" ");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function applyReplacements(text: string, rules: ReplacementRule[]): string {
  return rules.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

function removeFillers(text: string): string {
  return FILLERS.reduce((acc, pattern) => acc.replace(pattern, ""), text);
}

function toConcise(body: string): string {
  return capitalizeSentences(tidy(removeFillers(body)));
}

function toFriendly(body: string): string {
  return capitalizeSentences(tidy(applyReplacements(body, FRIENDLY_REPLACEMENTS)));
}

function toFormal(body: string): string {
  let text = applyReplacements(body, CONTRACTIONS);
  text = applyReplacements(text, CASUAL_GREETINGS);
  text = applyReplacements(text, FORMAL_PHRASES);
  return capitalizeSentences(tidy(text));
}

function toApologetic(body: string): string {
  const text = applyReplacements(body, CONTRACTIONS);
  return capitalizeSentences(tidy("I apologize for any inconvenience. " + text));
}

const TONE_TRANSFORMS: Record<ToneId, (body: string) => string> = {
  concise: toConcise,
  friendly: toFriendly,
  formal: toFormal,
  apologetic: toApologetic,
};

function isRewriteRequest(value: unknown): value is RewriteRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.subject === "string" &&
    typeof candidate.bodyText === "string" &&
    typeof candidate.tone === "string"
  );
}

/**
 * Extracts factual anchors that must survive a rewrite: links, emails,
 * quarters, money amounts, weekdays, calendar dates, relative times, and
 * proper names.
 */
export function extractKeyPoints(text: string): string[] {
  const points = new Set<string>();
  const patterns: RegExp[] = [
    /\bhttps?:\/\/[^\s)]+/gi,
    /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi,
    /\bQ[1-4]\b/g,
    /\$\d[\d,]*(?:\.\d+)?\b/g,
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    /\b(?:today|tonight|tomorrow|yesterday)(?:\s+(?:morning|afternoon|evening|night))?\b/gi,
  ];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        points.add(match.trim());
      }
    }
  }
  for (const sentence of splitSentences(text)) {
    const words = sentence.split(/\s+/);
    words.forEach((word, index) => {
      const clean = word.replace(/[^A-Za-z]/g, "");
      if (index > 0 && /^[A-Z][a-z]+$/.test(clean)) {
        points.add(clean);
      }
    });
  }
  return Array.from(points);
}

function enforceMaxWords(
  sentences: string[],
  keyPoints: string[],
  maxWords?: number,
): { body: string; truncated: boolean } {
  const kept = [...sentences];
  if (!maxWords || countWords(kept.join(" ")) <= maxWords) {
    return { body: kept.join(" "), truncated: false };
  }
  let truncated = false;
  while (countWords(kept.join(" ")) > maxWords && kept.length > 1) {
    const last = kept[kept.length - 1];
    const carriesKeyPoint = keyPoints.some((point) => last.includes(point));
    if (carriesKeyPoint) {
      break;
    }
    kept.pop();
    truncated = true;
  }
  return { body: kept.join(" "), truncated };
}

/**
 * Rewrites a single draft into the requested tone. Never throws: invalid input
 * and unsupported tones are reported through a typed error result.
 */
export function rewriteEmailTone(request: RewriteRequest): RewriterResult {
  if (!isRewriteRequest(request)) {
    return {
      status: "error",
      code: "unsupported-input",
      message: "Expected a draft with subject, bodyText, and tone string fields.",
    };
  }

  if (!SUPPORTED_TONES.includes(request.tone)) {
    return {
      status: "error",
      code: "unsupported-tone",
      message: `Unsupported tone: ${String(request.tone)}.`,
    };
  }

  const body = request.bodyText.trim();
  if (body.length === 0) {
    return {
      status: "error",
      code: "empty-body",
      message: "Cannot rewrite a draft with an empty body.",
    };
  }

  const keyPoints = extractKeyPoints(body);
  const transformed = TONE_TRANSFORMS[request.tone](body);
  const { body: limited, truncated } = enforceMaxWords(
    splitSentences(transformed),
    keyPoints,
    request.maxWords,
  );
  const rewrittenBody = tidy(limited);

  return {
    status: "ok",
    rewrite: {
      tone: request.tone,
      rewrittenBody,
      preservedKeyPoints: keyPoints,
      wordCount: countWords(rewrittenBody),
      truncated,
      changed: rewrittenBody !== body,
      actions: DISABLED_ACTIONS,
      source: {
        subject: request.subject,
        bodyText: request.bodyText,
      },
    },
  };
}

/** Maps a rewriter result into a UI-friendly ready/error state. */
export function toReadyState(result: RewriterResult): RewriterState {
  if (result.status === "error") {
    return { status: "error", code: result.code, message: result.message };
  }
  return { status: "ready", rewrite: result.rewrite };
}
