// Follow-up Sequence Builder -- core feature engine.
//
// Self-contained and deterministic. No imports from the main inbox, routing,
// wallet, Stellar, database, or design-system layers. The engine performs no
// IO: it never sends email, touches the mailbox, creates calendar events, or
// calls external services. It only turns a normalized email context into a
// follow-up sequence plan.

export type SequenceStage = "pending" | "active" | "completed" | "skipped";

export type SequenceConfidence = "high" | "medium" | "low";

export type UrgencyLevel = "low" | "normal" | "high" | "critical";

export interface FollowUpStep {
  order: number;
  delayDays: number;
  template: string;
  condition: string;
  stage: SequenceStage;
}

export interface SequenceBuildInput {
  messageId: string;
  subject: string;
  body: string;
  senderAddress: string;
  senderName?: string;
  receivedAt: string;
  timeZone?: string;
  threadHint?: string;
}

export interface SequenceBuildOptions {
  now?: string;
  maxSteps?: number;
  existingSequences?: ExistingSequenceKey[];
}

export interface ExistingSequenceKey {
  sourceMessageId: string;
  title: string;
}

export interface FollowUpSequence {
  id: string;
  title: string;
  sourceMessageId: string;
  confidence: SequenceConfidence;
  urgency: UrgencyLevel;
  steps: FollowUpStep[];
  warnings: string[];
}

export interface SequenceSignal {
  type:
    | "explicit_request"
    | "urgency_indicator"
    | "deadline_mention"
    | "sender_hint"
    | "low_priority_context";
  detail: string;
}

export const EXPLICIT_FOLLOW_UP_TERMS = [
  "follow up",
  "follow-up",
  "keep me posted",
  "keep me updated",
  "circle back",
  "check in",
  "touch base",
  "revisit",
];

export const URGENCY_TERMS: Record<string, UrgencyLevel> = {
  asap: "critical",
  urgent: "critical",
  immediately: "critical",
  "as soon as possible": "critical",
  "time sensitive": "high",
  "time-sensitive": "high",
  important: "high",
  priority: "high",
  soon: "normal",
  shortly: "normal",
};

export const LOW_PRIORITY_TERMS = [
  "fyi",
  "for your information",
  "no rush",
  "when you get a chance",
  "whenever",
  "no hurry",
  "not urgent",
  "just sharing",
  "thought you might like",
];

export const DEFAULT_SEQUENCE_TEMPLATES: Record<
  UrgencyLevel,
  { delayDays: number; template: string; condition: string }[]
> = {
  critical: [
    { delayDays: 1, template: "Follow up on urgent request", condition: "No response received" },
    { delayDays: 3, template: "Escalate urgent request", condition: "Still no response" },
    { delayDays: 7, template: "Final escalation", condition: "No response after two follow-ups" },
  ],
  high: [
    { delayDays: 2, template: "Gentle reminder", condition: "No response received" },
    { delayDays: 5, template: "Follow-up on pending item", condition: "Still no response" },
    {
      delayDays: 10,
      template: "Escalate if unresolved",
      condition: "No response after two follow-ups",
    },
  ],
  normal: [
    { delayDays: 3, template: "Friendly check-in", condition: "No response received" },
    { delayDays: 7, template: "Follow-up reminder", condition: "Still no response" },
    { delayDays: 14, template: "Final check-in", condition: "No response after two follow-ups" },
  ],
  low: [
    { delayDays: 7, template: "Casual check-in", condition: "No response received" },
    { delayDays: 14, template: "Gentle nudge", condition: "Still no response" },
    { delayDays: 30, template: "Final nudge", condition: "No response after two follow-ups" },
  ],
};

export const MAX_SCAN_LENGTH = 4000;

export const MILLISECONDS_PER_DAY = 86400000;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function boundedText(input: SequenceBuildInput): string {
  const combined = input.subject + "\n" + input.body;
  return combined.slice(0, MAX_SCAN_LENGTH).toLowerCase();
}

function detectExplicitRequests(text: string): SequenceSignal[] {
  const found: SequenceSignal[] = [];
  for (const term of EXPLICIT_FOLLOW_UP_TERMS) {
    if (text.includes(term)) {
      found.push({ type: "explicit_request", detail: term });
    }
  }
  return found;
}

function detectUrgency(text: string): { signals: SequenceSignal[]; urgency: UrgencyLevel } {
  const signals: SequenceSignal[] = [];
  let urgency: UrgencyLevel = "normal";

  for (const [term, level] of Object.entries(URGENCY_TERMS)) {
    if (text.includes(term)) {
      signals.push({ type: "urgency_indicator", detail: term });
      if (priorityLevel(level) > priorityLevel(urgency)) {
        urgency = level;
      }
    }
  }

  return { signals, urgency };
}

function priorityLevel(level: UrgencyLevel): number {
  switch (level) {
    case "low":
      return 0;
    case "normal":
      return 1;
    case "high":
      return 2;
    case "critical":
      return 3;
  }
}

function detectDeadlines(text: string): SequenceSignal[] {
  const signals: SequenceSignal[] = [];
  const deadlinePatterns = [
    /\bby\s+(\d{4}-\d{2}-\d{2})\b/g,
    /\bdue\s+(\d{4}-\d{2}-\d{2})\b/g,
    /\bdeadline\s+is\s+(\d{4}-\d{2}-\d{2})\b/gi,
    /\bdeadline\s*:\s*(\d{4}-\d{2}-\d{2})\b/gi,
    /\bbefore\s+(\d{4}-\d{2}-\d{2})\b/g,
  ];

  for (const pattern of deadlinePatterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      signals.push({ type: "deadline_mention", detail: match[0] });
    }
  }

  return signals;
}

function detectLowPriority(text: string): SequenceSignal[] {
  const found: SequenceSignal[] = [];
  for (const term of LOW_PRIORITY_TERMS) {
    if (text.includes(term)) {
      found.push({ type: "low_priority_context", detail: term });
    }
  }
  return found;
}

function buildTitle(input: SequenceBuildInput): string {
  const subject = normalizeWhitespace(input.subject);
  if (subject.length > 0) {
    return "Follow-up sequence: " + subject;
  }
  return "Follow-up sequence on email";
}

function generateSequenceId(input: SequenceBuildInput): string {
  const prefix = input.messageId.slice(0, 8);
  let hash = 0;
  const seed = input.messageId + input.subject;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return "seq-" + prefix + "-" + Math.abs(hash).toString(36);
}

function generateSteps(urgency: UrgencyLevel, maxSteps: number): FollowUpStep[] {
  const templates = DEFAULT_SEQUENCE_TEMPLATES[urgency];
  const count = Math.min(templates.length, maxSteps);

  return templates.slice(0, count).map((t, i) => ({
    order: i + 1,
    delayDays: t.delayDays,
    template: t.template,
    condition: t.condition,
    stage: "pending" as SequenceStage,
  }));
}

export function buildSequence(
  input: SequenceBuildInput,
  options: SequenceBuildOptions = {},
): FollowUpSequence {
  const text = boundedText(input);
  const maxSteps = options.maxSteps ?? 3;

  const explicitSignals = detectExplicitRequests(text);
  const urgencyResult = detectUrgency(text);
  const deadlineSignals = detectDeadlines(text);
  const lowPrioritySignals = detectLowPriority(text);

  const hasThreadHint = Boolean(
    input.threadHint && normalizeWhitespace(input.threadHint).length > 0,
  );

  const signals: SequenceSignal[] = [
    ...explicitSignals,
    ...urgencyResult.signals,
    ...deadlineSignals,
    ...lowPrioritySignals,
  ];
  if (hasThreadHint) {
    signals.push({ type: "sender_hint", detail: normalizeWhitespace(input.threadHint as string) });
  }

  const warnings: string[] = [];

  const hasExplicit = explicitSignals.length > 0;
  const hasUrgency = urgencyResult.signals.length > 0;
  const hasDeadline = deadlineSignals.length > 0;
  const isLowPriority = lowPrioritySignals.length > 0;

  let urgency: UrgencyLevel = urgencyResult.urgency;
  if (!hasUrgency && hasDeadline) {
    urgency = priorityLevel(urgency) < 2 ? "high" : urgency;
  }

  const title = buildTitle(input);
  const id = generateSequenceId(input);

  let confidence: SequenceConfidence;
  let steps: FollowUpStep[];

  if (hasExplicit && (hasUrgency || hasDeadline)) {
    confidence = "high";
    steps = generateSteps(urgency, maxSteps);
  } else if (hasExplicit || hasUrgency || hasDeadline) {
    confidence = "medium";
    steps = generateSteps(urgency, maxSteps);
    if (!hasExplicit) {
      warnings.push("No explicit follow-up request detected; confidence is reduced.");
    }
  } else if (isLowPriority) {
    confidence = "low";
    steps = [];
    warnings.push("Low-priority context detected; no follow-up sequence suggested.");
  } else if (!hasExplicit && !hasUrgency && !hasDeadline && !hasThreadHint) {
    confidence = "low";
    steps = [];
    warnings.push("No actionable follow-up signal detected.");
  } else {
    confidence = "low";
    steps = generateSteps("low", maxSteps);
    warnings.push("Weak signals; review suggested sequence carefully.");
  }

  if (steps.length > 0 && isLowPriority && hasExplicit) {
    warnings.push("Low-priority context may reduce response urgency.");
  }

  const existing = options.existingSequences ?? [];
  if (steps.length > 0 && existing.some((item) => item.sourceMessageId === input.messageId)) {
    warnings.push("A sequence for this message already exists.");
  }

  return {
    id,
    title,
    sourceMessageId: input.messageId,
    confidence,
    urgency,
    steps,
    warnings,
  };
}

export function summarizeSequence(sequence: FollowUpSequence): string {
  if (sequence.steps.length === 0) {
    return "No sequence suggested (" + sequence.confidence + " confidence).";
  }
  const stepCount = sequence.steps.length;
  const firstDelay = sequence.steps[0].delayDays;
  return (
    sequence.title +
    " -- " +
    stepCount +
    " steps, first in " +
    firstDelay +
    " days (" +
    sequence.confidence +
    " confidence, " +
    sequence.urgency +
    " urgency)."
  );
}

export function isSequenceDuplicate(
  sequence: FollowUpSequence,
  existing: ExistingSequenceKey[],
): boolean {
  return existing.some((item) => item.sourceMessageId === sequence.sourceMessageId);
}
