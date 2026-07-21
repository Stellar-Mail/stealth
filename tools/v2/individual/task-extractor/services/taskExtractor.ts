// Task Extractor — core extraction engine.
//
// Rule-based extraction of action items from subject and body text. Pure and
// deterministic: no network calls, no mailbox access, no randomness, no clock
// reads, and no mutation of caller-supplied objects. Relative due phrases only
// resolve to dates when the caller supplies receivedAt.

import type {
  ExtractedTask,
  TaskConfidence,
  TaskExtractionInput,
  TaskExtractionOptions,
  TaskExtractionResult,
  TaskPriority,
  TaskSource,
  TaskTrigger,
} from "../types/taskExtractor";

export const DEFAULT_MAX_TASKS = 10;
export const MAX_TASKS_LIMIT = 50;
/** Task text longer than this is cut at the last word boundary. */
export const MAX_TASK_TEXT_CHARS = 200;

export const HIGH_PRIORITY_TERMS: ReadonlySet<string> = new Set([
  "urgent",
  "urgently",
  "asap",
  "immediately",
  "critical",
  "blocker",
  "blocking",
]);

export const LOW_PRIORITY_TERMS: readonly string[] = [
  "no rush",
  "no hurry",
  "whenever you can",
  "when you get a chance",
  "when you have time",
  "low priority",
];

export const ACTION_VERBS: ReadonlySet<string> = new Set([
  "add",
  "approve",
  "book",
  "call",
  "cancel",
  "check",
  "complete",
  "confirm",
  "deploy",
  "draft",
  "email",
  "finish",
  "fix",
  "follow",
  "order",
  "pay",
  "prepare",
  "renew",
  "reply",
  "review",
  "schedule",
  "send",
  "share",
  "sign",
  "submit",
  "test",
  "update",
  "upload",
  "verify",
]);

const CHECKBOX_PATTERN = /^[-*]\s*\[\s?\]\s*(.+)$/;
const BULLET_PATTERN = /^(?:[-*•]|\d+[.)])\s+(.+)$/;

const REQUEST_PATTERNS: readonly RegExp[] = [
  /\bplease\s+([a-z].+)/i,
  /\b(?:can|could|would)\s+you\s+(?:please\s+)?(.+)/i,
  /\b(?:make|be)\s+sure\s+(?:to\s+)?(.+)/i,
  /\b(?:remember|don't\s+forget|do\s+not\s+forget)\s+to\s+(.+)/i,
  /\baction\s+required:?\s+(.+)/i,
  /\b(?:we|you)\s+need\s+to\s+(.+)/i,
  /\bneeds?\s+you\s+to\s+(.+)/i,
];

const ISO_DATE_PATTERN = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const DUE_PHRASE_PATTERN =
  /\b(?:by|before|due(?:\s+on)?|until)\s+(end\s+of\s+(?:day|week)|eod|eow|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week)\b/i;

const CONFIDENCE_RANK: Record<TaskConfidence, number> = { low: 0, medium: 1, high: 2 };

const MILLISECONDS_PER_DAY = 86_400_000;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeTaskText(text: string): string {
  let cleaned = collapseWhitespace(text).replace(/[.,;:!?\s]+$/, "");
  if (cleaned.length > MAX_TASK_TEXT_CHARS) {
    const cut = cleaned.slice(0, MAX_TASK_TEXT_CHARS);
    const lastSpace = cut.lastIndexOf(" ");
    cleaned = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
  }
  return cleaned;
}

function firstWord(text: string): string {
  const match = /^[a-z']+/i.exec(text.trim());
  return match ? match[0].toLowerCase() : "";
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function toIsoDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface DueHints {
  dueAtHint?: string;
  dueTextHint?: string;
}

function detectDueHints(text: string, receivedAt: string | undefined): DueHints {
  const isoMatch = ISO_DATE_PATTERN.exec(text);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (isValidCalendarDate(Number(year), Number(month), Number(day))) {
      return { dueAtHint: `${year}-${month}-${day}` };
    }
  }
  const phraseMatch = DUE_PHRASE_PATTERN.exec(text);
  if (!phraseMatch) {
    return {};
  }
  const phrase = collapseWhitespace(phraseMatch[1].toLowerCase());
  if (
    receivedAt !== undefined &&
    (phrase === "today" || phrase === "end of day" || phrase === "eod")
  ) {
    return { dueAtHint: toIsoDate(new Date(receivedAt).getTime()) };
  }
  if (receivedAt !== undefined && phrase === "tomorrow") {
    return { dueAtHint: toIsoDate(new Date(receivedAt).getTime() + MILLISECONDS_PER_DAY) };
  }
  return { dueTextHint: phrase };
}

function detectPriority(taskText: string, contextLine: string): TaskPriority {
  const haystack = `${taskText} ${contextLine}`.toLowerCase();
  for (const phrase of LOW_PRIORITY_TERMS) {
    if (haystack.includes(phrase)) {
      return "low";
    }
  }
  if (haystack.includes("high priority")) {
    return "high";
  }
  for (const token of haystack.split(/[^a-z]+/)) {
    if (HIGH_PRIORITY_TERMS.has(token)) {
      return "high";
    }
  }
  return "normal";
}

interface Candidate {
  text: string;
  source: TaskSource;
  trigger: TaskTrigger;
  confidence: TaskConfidence;
  contextLine: string;
}

function matchLine(line: string, source: TaskSource): Candidate | undefined {
  const checkbox = CHECKBOX_PATTERN.exec(line);
  if (checkbox) {
    return {
      text: checkbox[1],
      source,
      trigger: "checkbox",
      confidence: "high",
      contextLine: line,
    };
  }
  for (const pattern of REQUEST_PATTERNS) {
    const request = pattern.exec(line);
    if (request) {
      return {
        text: request[1],
        source,
        trigger: "request-phrase",
        confidence: "high",
        contextLine: line,
      };
    }
  }
  const bullet = BULLET_PATTERN.exec(line);
  if (bullet && ACTION_VERBS.has(firstWord(bullet[1]))) {
    return {
      text: bullet[1],
      source,
      trigger: "bullet-action",
      confidence: "medium",
      contextLine: line,
    };
  }
  if (ACTION_VERBS.has(firstWord(line))) {
    return { text: line, source, trigger: "imperative-line", confidence: "low", contextLine: line };
  }
  return undefined;
}

/** Clamp caller-supplied maxTasks into the supported range. */
export function resolveMaxTasks(maxTasks: number | undefined): number {
  if (maxTasks === undefined) {
    return DEFAULT_MAX_TASKS;
  }
  return Math.min(Math.max(Math.trunc(maxTasks), 1), MAX_TASKS_LIMIT);
}

/**
 * Extract action items from a message.
 *
 * Assumes input has already been validated and sanitized — use
 * safeExtractTasks from services/guards for untrusted callers.
 */
export function extractTasks(
  input: TaskExtractionInput,
  options: TaskExtractionOptions = {},
): TaskExtractionResult {
  const lines: Array<{ text: string; source: TaskSource }> = [];
  if (input.subject.trim().length > 0) {
    lines.push({ text: collapseWhitespace(input.subject), source: "subject" });
  }
  for (const rawLine of input.body.split(/\r?\n/)) {
    const line = collapseWhitespace(rawLine);
    if (line.length > 0) {
      lines.push({ text: line, source: "body" });
    }
  }

  const candidates: Candidate[] = [];
  for (const line of lines) {
    const candidate = matchLine(line.text, line.source);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  const minConfidence = CONFIDENCE_RANK[options.minConfidence ?? "low"];
  const maxTasks = resolveMaxTasks(options.maxTasks);
  const seen = new Set<string>();
  const tasks: ExtractedTask[] = [];
  let truncated = false;
  for (const candidate of candidates) {
    if (CONFIDENCE_RANK[candidate.confidence] < minConfidence) {
      continue;
    }
    const text = normalizeTaskText(candidate.text);
    if (text.length === 0) {
      continue;
    }
    const dedupKey = text.toLowerCase();
    if (seen.has(dedupKey)) {
      continue;
    }
    if (tasks.length >= maxTasks) {
      truncated = true;
      break;
    }
    seen.add(dedupKey);
    const due = detectDueHints(candidate.contextLine, input.receivedAt);
    tasks.push({
      id: `${input.messageId}-task-${tasks.length + 1}`,
      text,
      source: candidate.source,
      trigger: candidate.trigger,
      priority: detectPriority(text, candidate.contextLine),
      confidence: candidate.confidence,
      ...(due.dueAtHint !== undefined ? { dueAtHint: due.dueAtHint } : {}),
      ...(due.dueTextHint !== undefined ? { dueTextHint: due.dueTextHint } : {}),
    });
  }

  return {
    messageId: input.messageId,
    tasks,
    stats: {
      lineCount: lines.length,
      candidateCount: candidates.length,
      extractedCount: tasks.length,
      truncated,
    },
  };
}
