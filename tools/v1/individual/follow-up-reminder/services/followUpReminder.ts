// Follow-up Reminder -- core feature engine.
//
// Self-contained and deterministic. No imports from the main inbox, routing,
// wallet, Stellar, database, or design-system layers, as required by the tool
// spec. The engine performs no IO: it never sends email, touches the mailbox,
// creates calendar events, or calls external services. It only turns a
// normalized email into a single reminder review model.

export type ReminderState = "draft" | "no_action";

export type ReminderConfidence = "high" | "medium" | "low";

export type SignalType =
  "explicit_request" | "absolute_date" | "relative_date" | "sender_hint" | "low_confidence_context";

export interface ReminderSignal {
  type: SignalType;
  detail: string;
}

export interface NormalizedEmailInput {
  messageId: string;
  subject: string;
  body: string;
  senderAddress: string;
  senderName?: string;
  receivedAt: string; // ISO-8601 timestamp
  timeZone?: string; // IANA timezone, optional
  threadHint?: string;
}

export interface ReminderReviewModel {
  state: ReminderState;
  confidence: ReminderConfidence;
  title: string;
  dueAt: string | null; // ISO-8601 date or datetime; null when ambiguous or no action
  sourceMessageId: string;
  signals: ReminderSignal[];
  warnings: string[];
}

export interface ExistingReminderKey {
  sourceMessageId: string;
  dueAt: string | null;
}

export interface BuildReminderOptions {
  now?: string; // base timestamp for relative-date resolution; defaults to receivedAt
  existingReminders?: ExistingReminderKey[];
}

export const EXPLICIT_REQUEST_TERMS = [
  "follow up",
  "follow-up",
  "remind me",
  "check back",
  "reply by",
  "respond by",
  "due",
  "deadline",
  "waiting on response",
  "waiting for response",
];

export const LOW_CONFIDENCE_TERMS = [
  "newsletter",
  "unsubscribe",
  "receipt",
  "order confirmation",
  "do not reply",
  "fyi",
  "no action needed",
  "no action required",
];

export const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

export const MAX_SCAN_LENGTH = 4000;
export const MILLISECONDS_PER_DAY = 86400000;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function boundedText(input: NormalizedEmailInput): string {
  const combined = input.subject + "\n" + input.body;
  return combined.slice(0, MAX_SCAN_LENGTH).toLowerCase();
}

function addDaysIso(baseIso: string, days: number): string | null {
  const base = new Date(baseIso);
  if (Number.isNaN(base.getTime())) {
    return null;
  }
  const next = new Date(base.getTime() + days * MILLISECONDS_PER_DAY);
  return next.toISOString().slice(0, 10);
}

function detectExplicitRequests(text: string): ReminderSignal[] {
  const found: ReminderSignal[] = [];
  for (const term of EXPLICIT_REQUEST_TERMS) {
    if (text.includes(term)) {
      found.push({ type: "explicit_request", detail: term });
    }
  }
  return found;
}

function detectLowConfidence(text: string): ReminderSignal[] {
  const found: ReminderSignal[] = [];
  for (const term of LOW_CONFIDENCE_TERMS) {
    if (text.includes(term)) {
      found.push({ type: "low_confidence_context", detail: term });
    }
  }
  return found;
}

function detectDateCandidates(text: string): {
  signals: ReminderSignal[];
  candidates: string[];
} {
  const signals: ReminderSignal[] = [];
  const candidates: string[] = [];

  const datetimeMatches = Array.from(text.matchAll(/\b(\d{4}-\d{2}-\d{2})[t ](\d{2}:\d{2})\b/g));
  for (const match of datetimeMatches) {
    const value = match[1] + "T" + match[2];
    signals.push({ type: "absolute_date", detail: value });
    candidates.push(value);
  }

  const withoutDatetimes = text.replace(/\b(\d{4}-\d{2}-\d{2})[t ](\d{2}:\d{2})\b/g, " ");
  const dateMatches = Array.from(withoutDatetimes.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g));
  for (const match of dateMatches) {
    signals.push({ type: "absolute_date", detail: match[1] });
    candidates.push(match[1]);
  }

  return { signals, candidates };
}

function detectRelativeDates(
  text: string,
  baseIso: string,
): { signals: ReminderSignal[]; candidates: string[] } {
  const signals: ReminderSignal[] = [];
  const candidates: string[] = [];

  if (/\btomorrow\b/.test(text)) {
    signals.push({ type: "relative_date", detail: "tomorrow" });
    const resolved = addDaysIso(baseIso, 1);
    if (resolved) {
      candidates.push(resolved);
    }
  }
  if (/\bnext week\b/.test(text)) {
    signals.push({ type: "relative_date", detail: "next week" });
    const resolved = addDaysIso(baseIso, 7);
    if (resolved) {
      candidates.push(resolved);
    }
  }
  const inDays = text.match(
    /\bin (\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten) days?\b/,
  );
  if (inDays) {
    const raw = inDays[1];
    const amount = /^\d+$/.test(raw) ? parseInt(raw, 10) : (NUMBER_WORDS[raw] ?? 0);
    if (amount > 0) {
      signals.push({ type: "relative_date", detail: inDays[0] });
      const resolved = addDaysIso(baseIso, amount);
      if (resolved) {
        candidates.push(resolved);
      }
    }
  }

  return { signals, candidates };
}

function buildTitle(input: NormalizedEmailInput): string {
  const subject = normalizeWhitespace(input.subject);
  if (subject.length > 0) {
    return "Follow up: " + subject;
  }
  return "Follow up on email";
}

export function buildFollowUpReminder(
  input: NormalizedEmailInput,
  options: BuildReminderOptions = {},
): ReminderReviewModel {
  const baseIso = options.now ?? input.receivedAt;
  const text = boundedText(input);

  const explicitSignals = detectExplicitRequests(text);
  const lowConfidenceSignals = detectLowConfidence(text);
  const absolute = detectDateCandidates(text);
  const relative = detectRelativeDates(text, baseIso);

  const hasThreadHint = Boolean(
    input.threadHint && normalizeWhitespace(input.threadHint).length > 0,
  );

  const signals: ReminderSignal[] = [
    ...explicitSignals,
    ...absolute.signals,
    ...relative.signals,
    ...lowConfidenceSignals,
  ];
  if (hasThreadHint) {
    signals.push({ type: "sender_hint", detail: normalizeWhitespace(input.threadHint as string) });
  }

  const warnings: string[] = [];
  const uniqueCandidates = Array.from(new Set([...absolute.candidates, ...relative.candidates]));

  const hasExplicit = explicitSignals.length > 0;
  const isLowContext = lowConfidenceSignals.length > 0;

  let dueAt: string | null = null;
  if (uniqueCandidates.length === 1) {
    dueAt = uniqueCandidates[0];
  } else if (uniqueCandidates.length > 1) {
    warnings.push(
      "Ambiguous due date: found " +
        uniqueCandidates.join(", ") +
        ". Confirm one before scheduling.",
    );
  }

  if (relative.signals.length > 0 && !input.timeZone && dueAt !== null) {
    warnings.push("Relative date resolved without a timezone; confirm the due time.");
  }

  const title = buildTitle(input);

  let state: ReminderState;
  if (!hasExplicit && isLowContext) {
    state = "no_action";
    warnings.push("Low-confidence context detected; no reminder suggested.");
  } else if (!hasExplicit && uniqueCandidates.length === 0 && !hasThreadHint) {
    state = "no_action";
    warnings.push("No actionable follow-up signal detected.");
  } else {
    state = "draft";
    if (dueAt === null && uniqueCandidates.length === 0) {
      warnings.push("No due date detected; add one before scheduling.");
    }
  }

  const hasUnambiguousDate = uniqueCandidates.length === 1;
  let confidence: ReminderConfidence;
  if (state === "no_action") {
    confidence = "low";
  } else if (hasExplicit && hasUnambiguousDate && !isLowContext) {
    confidence = "high";
  } else if ((hasExplicit || hasUnambiguousDate) && !isLowContext) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  const existing = options.existingReminders ?? [];
  if (
    state === "draft" &&
    dueAt !== null &&
    existing.some((item) => item.sourceMessageId === input.messageId && item.dueAt === dueAt)
  ) {
    state = "no_action";
    confidence = "low";
    warnings.push("A reminder for this message and due date already exists.");
  }

  return {
    state,
    confidence,
    title,
    dueAt,
    sourceMessageId: input.messageId,
    signals,
    warnings,
  };
}

export function isReminderDuplicate(
  model: ReminderReviewModel,
  existing: ExistingReminderKey[],
): boolean {
  if (model.dueAt === null) {
    return false;
  }
  return existing.some(
    (item) => item.sourceMessageId === model.sourceMessageId && item.dueAt === model.dueAt,
  );
}

export function summarizeReminder(model: ReminderReviewModel): string {
  if (model.state === "no_action") {
    return "No reminder suggested (" + model.confidence + " confidence).";
  }
  const due = model.dueAt ?? "no due date yet";
  return model.title + " -- due " + due + " (" + model.confidence + " confidence).";
}
