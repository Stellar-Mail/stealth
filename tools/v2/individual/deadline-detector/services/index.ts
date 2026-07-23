import type {
  DeadlineDetectionResult,
  DeadlineDetectionSummary,
  DeadlineDetectorServiceOptions,
  DeadlineMessage,
  DeadlineStatus,
  DeadlineUrgency,
  DetectedDeadline,
} from "../types";

/** Confidence at or above which a detected deadline needs no manual review. */
const HIGH_CONFIDENCE = 0.8;

/** Default number of days ahead that still counts as "soon". */
const DEFAULT_SOON_WINDOW_DAYS = 3;

/** One calendar day expressed in milliseconds. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Message types that are treated as non-actionable and always ignored. */
const IGNORED_TYPES = new Set(["newsletter", "digest", "notification"]);

/** Case-insensitive phrases that signal an explicit deadline. */
const STRONG_KEYWORDS = ["deadline", "due", "expires", "expire", "no later than", "renew", "final"];

const ISO_DATE = /([0-9]{4})-([0-9]{2})-([0-9]{2})/;
const US_DATE = new RegExp("([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})");
const TIME_24H = /([01]?[0-9]|2[0-3]):([0-5][0-9])/;

function toDate(value: string | Date | undefined): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string") {
    return new Date(value);
  }
  return new Date();
}

/** Returns the UTC calendar day (midnight) for a date, for stable diffing. */
function toUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function pad2(value: number): string {
  return value < 10 ? "0" + value : String(value);
}

function formatDay(date: Date): string {
  return date.getUTCFullYear() + "-" + pad2(date.getUTCMonth() + 1) + "-" + pad2(date.getUTCDate());
}

/**
 * Extracts an ISO date, a US-style date, or a relative phrase from the text.
 * Relative phrases ("today", "tomorrow", "next week") resolve against the run
 * day so results stay deterministic.
 */
function extractDueDate(text: string, runDay: Date): string | null {
  const iso = text.match(ISO_DATE);
  if (iso) {
    return iso[1] + "-" + iso[2] + "-" + iso[3];
  }
  const us = text.match(US_DATE);
  if (us) {
    return Number(us[3]) + "-" + pad2(Number(us[1])) + "-" + pad2(Number(us[2]));
  }
  const lower = text.toLowerCase();
  if (lower.includes("tomorrow")) {
    return formatDay(new Date(runDay.getTime() + MS_PER_DAY));
  }
  if (lower.includes("next week")) {
    return formatDay(new Date(runDay.getTime() + 7 * MS_PER_DAY));
  }
  if (lower.includes("today")) {
    return formatDay(runDay);
  }
  return null;
}

function extractDueTime(text: string): string | null {
  const match = text.match(TIME_24H);
  if (!match) {
    return null;
  }
  return pad2(Number(match[1])) + ":" + match[2];
}

function hasStrongKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return STRONG_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function classifyUrgency(
  dueDay: Date | null,
  runDay: Date,
  soonWindowDays: number,
): DeadlineUrgency {
  if (!dueDay) {
    return "unknown";
  }
  const diffDays = Math.round((dueDay.getTime() - runDay.getTime()) / MS_PER_DAY);
  if (diffDays < 0) {
    return "overdue";
  }
  if (diffDays === 0) {
    return "today";
  }
  if (diffDays <= soonWindowDays) {
    return "soon";
  }
  return "later";
}

function roundConfidence(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * 100) / 100;
}

function detectOne(
  message: DeadlineMessage,
  runDay: Date,
  soonWindowDays: number,
): DetectedDeadline {
  const text = message.subject + " " + message.body;
  const base = {
    id: message.id + "-deadline",
    sourceMessageId: message.id,
    title: message.subject.trim() || message.body.trim().slice(0, 60),
    timezone: message.userTimezone,
  };

  if (IGNORED_TYPES.has(message.type)) {
    return {
      ...base,
      dueDate: null,
      dueTime: null,
      status: "ignored",
      urgency: "unknown",
      confidence: 0.1,
      reviewRequired: true,
    };
  }

  const dueDate = extractDueDate(text, runDay);
  const dueTime = extractDueTime(text);
  const strong = hasStrongKeyword(text);
  const dueDay = dueDate ? toUtcDay(new Date(dueDate + "T00:00:00Z")) : null;

  let status: DeadlineStatus;
  if (dueDate) {
    if (dueDay && dueDay.getTime() < runDay.getTime()) {
      status = "missed";
    } else if (strong) {
      status = "detected";
    } else {
      status = "needs-review";
    }
  } else if (strong) {
    status = "needs-review";
  } else {
    status = "ignored";
  }

  let confidence = 0;
  if (dueDate) {
    confidence += 0.5;
  }
  if (strong) {
    confidence += 0.3;
  }
  if (dueTime) {
    confidence += 0.1;
  }
  if (status === "ignored") {
    confidence = 0.1;
  }
  confidence = roundConfidence(confidence);

  const urgency = classifyUrgency(dueDay, runDay, soonWindowDays);
  const reviewRequired = !(status === "detected" && confidence >= HIGH_CONFIDENCE);

  return {
    ...base,
    dueDate,
    dueTime,
    status,
    urgency,
    confidence,
    reviewRequired,
  };
}

function summarize(deadlines: DetectedDeadline[]): DeadlineDetectionSummary {
  const summary: DeadlineDetectionSummary = {
    total: deadlines.length,
    detected: 0,
    needsReview: 0,
    missed: 0,
    ignored: 0,
  };
  for (const deadline of deadlines) {
    if (deadline.status === "detected") {
      summary.detected += 1;
    } else if (deadline.status === "needs-review") {
      summary.needsReview += 1;
    } else if (deadline.status === "missed") {
      summary.missed += 1;
    } else {
      summary.ignored += 1;
    }
  }
  return summary;
}

const URGENCY_ORDER: Record<DeadlineUrgency, number> = {
  overdue: 0,
  today: 1,
  soon: 2,
  later: 3,
  unknown: 4,
};

/**
 * Detects reviewable deadlines from a batch of synthetic messages. The result
 * is deterministic for a given set of messages and options, which keeps
 * fixture-based tests stable.
 */
export function detectDeadlines(
  messages: DeadlineMessage[],
  options: DeadlineDetectorServiceOptions = {},
): DeadlineDetectionResult {
  const runDay = toUtcDay(toDate(options.now));
  const soonWindowDays = options.soonWindowDays ?? DEFAULT_SOON_WINDOW_DAYS;
  const deadlines = messages.map((message) => detectOne(message, runDay, soonWindowDays));
  return { deadlines, summary: summarize(deadlines) };
}

/**
 * Returns a new array sorted by urgency, then earliest due date, then highest
 * confidence. The input array is not mutated.
 */
export function sortDetectedDeadlines(deadlines: DetectedDeadline[]): DetectedDeadline[] {
  return [...deadlines].sort((a, b) => {
    const urgencyDelta = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (urgencyDelta !== 0) {
      return urgencyDelta;
    }
    const aDate = a.dueDate ?? "9999-12-31";
    const bDate = b.dueDate ?? "9999-12-31";
    if (aDate !== bDate) {
      return aDate < bDate ? -1 : 1;
    }
    return b.confidence - a.confidence;
  });
}
