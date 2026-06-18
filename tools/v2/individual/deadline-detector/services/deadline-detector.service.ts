import type {
  DeadlineDetectionResult,
  DeadlineDetectorServiceOptions,
  DeadlineMessage,
  DeadlineStatus,
  DeadlineUrgency,
  DetectedDeadline,
} from "../types";

const ISO_DATE_PATTERN = /\b(20\d{2})-(\d{2})-(\d{2})\b/;
const US_DATE_PATTERN = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/;
const TIME_PATTERN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
const DEADLINE_WORDS = ["deadline", "due", "submit", "expires", "renewal", "by "];
const IGNORE_WORDS = ["newsletter", "digest", "no action required", "for your records"];

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeDateFromText(text: string, now: Date): string | null {
  const isoMatch = text.match(ISO_DATE_PATTERN);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const usMatch = text.match(US_DATE_PATTERN);
  if (usMatch) {
    const month = usMatch[1].padStart(2, "0");
    const day = usMatch[2].padStart(2, "0");
    return `${usMatch[3]}-${month}-${day}`;
  }

  const lowered = text.toLowerCase();
  if (lowered.includes("today")) {
    return toDateOnly(now);
  }
  if (lowered.includes("tomorrow")) {
    return toDateOnly(addDays(now, 1));
  }
  if (lowered.includes("next week")) {
    return toDateOnly(addDays(now, 7));
  }

  return null;
}

function normalizeTimeFromText(text: string): string | null {
  const match = text.match(TIME_PATTERN);
  if (!match) {
    return null;
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function containsDeadlineSignal(text: string): boolean {
  const lowered = text.toLowerCase();
  return DEADLINE_WORDS.some((word) => lowered.includes(word));
}

function shouldIgnore(text: string): boolean {
  const lowered = text.toLowerCase();
  return IGNORE_WORDS.some((word) => lowered.includes(word));
}

function getUrgency(dueDate: string | null, now: Date): DeadlineUrgency {
  if (!dueDate) {
    return "unknown";
  }

  const due = new Date(`${dueDate}T00:00:00Z`);
  const today = new Date(`${toDateOnly(now)}T00:00:00Z`);
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (daysUntilDue < 0) {
    return "overdue";
  }
  if (daysUntilDue === 0) {
    return "today";
  }
  if (daysUntilDue <= 7) {
    return "soon";
  }
  return "later";
}

function getStatus(text: string, dueDate: string | null, now: Date): DeadlineStatus {
  if (shouldIgnore(text)) {
    return "ignored";
  }

  if (!dueDate) {
    return "needs-review";
  }

  const urgency = getUrgency(dueDate, now);
  if (urgency === "overdue") {
    return "missed";
  }

  return containsDeadlineSignal(text) ? "detected" : "needs-review";
}

function getConfidence(status: DeadlineStatus, dueDate: string | null, hasTime: boolean): number {
  if (status === "ignored") {
    return 0.1;
  }
  if (status === "missed") {
    return 0.95;
  }
  if (status === "detected" && dueDate && hasTime) {
    return 0.96;
  }
  if (status === "detected" && dueDate) {
    return 0.9;
  }
  return 0.58;
}

function titleFromMessage(message: DeadlineMessage): string {
  const cleaned = message.subject.replace(/^(re|fw):\s*/i, "").trim();
  return cleaned || "Untitled deadline";
}

export function detectDeadlines(
  messages: DeadlineMessage[],
  options: DeadlineDetectorServiceOptions = {},
): DeadlineDetectionResult {
  const now = new Date(options.now ?? new Date().toISOString());
  const defaultTimezone = options.defaultTimezone ?? "UTC";

  const deadlines = messages.map((message): DetectedDeadline => {
    const combinedText = `${message.subject}\n${message.body}`;
    const dueDate = normalizeDateFromText(combinedText, now);
    const dueTime = normalizeTimeFromText(combinedText);
    const status = getStatus(combinedText, dueDate, now);
    const urgency = status === "ignored" ? "unknown" : getUrgency(dueDate, now);

    return {
      id: `deadline-${message.id}`,
      sourceMessageId: message.id,
      title: titleFromMessage(message),
      dueDate,
      dueTime,
      timezone: message.userTimezone || defaultTimezone,
      status,
      urgency,
      confidence: getConfidence(status, dueDate, Boolean(dueTime)),
      evidence: combinedText.slice(0, 180),
      suggestedAction:
        status === "ignored"
          ? "No deadline action is suggested."
          : status === "needs-review"
            ? "Review the message before creating a reminder."
            : status === "missed"
              ? "Review the overdue item and decide whether to follow up."
              : "Create a reminder and confirm the detected due date.",
      reviewRequired: status !== "detected",
    };
  });

  const summary = deadlines.reduce(
    (acc, deadline) => {
      acc.totalDeadlines += 1;
      if (deadline.status === "detected") {
        acc.detected += 1;
      }
      if (deadline.status === "needs-review") {
        acc.needsReview += 1;
      }
      if (deadline.status === "missed") {
        acc.missed += 1;
      }
      if (deadline.status === "ignored") {
        acc.ignored += 1;
      }
      return acc;
    },
    {
      totalMessages: messages.length,
      totalDeadlines: 0,
      detected: 0,
      needsReview: 0,
      missed: 0,
      ignored: 0,
    },
  );

  return {
    deadlines: sortDetectedDeadlines(deadlines),
    summary,
  };
}

export function sortDetectedDeadlines(deadlines: DetectedDeadline[]): DetectedDeadline[] {
  const urgencyRank: Record<DeadlineUrgency, number> = {
    overdue: 0,
    today: 1,
    soon: 2,
    later: 3,
    unknown: 4,
  };

  return [...deadlines].sort((a, b) => {
    const urgencyDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (urgencyDiff !== 0) {
      return urgencyDiff;
    }

    const aDate = a.dueDate ?? "9999-12-31";
    const bDate = b.dueDate ?? "9999-12-31";
    return aDate.localeCompare(bDate);
  });
}
