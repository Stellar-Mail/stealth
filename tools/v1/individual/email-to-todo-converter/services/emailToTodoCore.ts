export type EmailToTodoPriority = "normal" | "high";
export type EmailToTodoStatus = "success" | "empty" | "error";

export interface EmailToTodoInput {
  id: string;
  subject: string;
  sender: string;
  receivedAt: string;
  bodyText: string;
  labels?: string[];
}

export interface EmailTodoSource {
  emailId: string;
  subject: string;
  sender: string;
  receivedAt: string;
  labels: string[];
}

export interface EmailTodoDraft {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null;
  priority: EmailToTodoPriority;
  completed: false;
  source: EmailTodoSource;
}

export interface EmailToTodoResult {
  status: EmailToTodoStatus;
  message: string;
  tasks: EmailTodoDraft[];
  errors?: string[];
}

interface ActionCandidate {
  text: string;
  source: "subject" | "body";
  score: number;
}

const ACTION_VERBS = [
  "approve",
  "book",
  "call",
  "check",
  "confirm",
  "draft",
  "follow up",
  "prepare",
  "reply",
  "review",
  "schedule",
  "send",
  "share",
  "sign",
  "submit",
  "update",
];

const DIRECT_REQUEST_PATTERNS = [
  /\bplease\b/i,
  /\bcan you\b/i,
  /\bcould you\b/i,
  /\bwould you\b/i,
  /\bneed you to\b/i,
  /\bplease\s+help\b/i,
];

const HIGH_PRIORITY_PATTERNS = [
  /\burgent\b/i,
  /\basap\b/i,
  /\bimmediately\b/i,
  /\bcritical\b/i,
  /\bblocking\b/i,
];

const WEEKDAY_TO_UTC_DAY: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sentenceCase(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isValidTimestamp(value: string): boolean {
  return normalizeWhitespace(value).length > 0 && !Number.isNaN(new Date(value).getTime());
}

function validateEmail(email: EmailToTodoInput): string[] {
  const errors: string[] = [];

  if (normalizeWhitespace(email.id).length === 0) {
    errors.push("Email id is required.");
  }
  if (normalizeWhitespace(email.sender).length === 0) {
    errors.push("Sender is required.");
  }
  if (!isValidTimestamp(email.receivedAt)) {
    errors.push("receivedAt must be a valid ISO-8601 timestamp.");
  }
  if (
    normalizeWhitespace(email.subject).length === 0 &&
    normalizeWhitespace(email.bodyText).length === 0
  ) {
    errors.push("Subject or bodyText is required.");
  }

  return errors;
}

function containsActionVerb(text: string): boolean {
  const normalized = text.toLowerCase();
  return ACTION_VERBS.some((verb) => {
    const escaped = verb.replace(/\s+/g, "\\s+");
    return new RegExp("\\b" + escaped + "\\b", "i").test(normalized);
  });
}

function requestScore(text: string): number {
  let score = 0;

  if (DIRECT_REQUEST_PATTERNS.some((pattern) => pattern.test(text))) {
    score += 3;
  }
  if (containsActionVerb(text)) {
    score += 2;
  }
  if (HIGH_PRIORITY_PATTERNS.some((pattern) => pattern.test(text))) {
    score += 1;
  }

  return score;
}

function splitBodySentences(bodyText: string): string[] {
  return normalizeWhitespace(bodyText)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function actionCandidates(email: EmailToTodoInput): ActionCandidate[] {
  const candidates: ActionCandidate[] = [];
  const subject = normalizeWhitespace(email.subject);

  if (subject.length > 0) {
    const score = requestScore(subject);
    if (score > 0) {
      candidates.push({ text: subject, source: "subject", score });
    }
  }

  for (const sentence of splitBodySentences(email.bodyText)) {
    const score = requestScore(sentence);
    if (score > 0) {
      candidates.push({ text: sentence, source: "body", score });
    }
  }

  return candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.source !== right.source) {
      return left.source === "subject" ? -1 : 1;
    }
    return left.text.length - right.text.length;
  });
}

function stripRequestPrefix(text: string): string {
  return text
    .replace(/^\s*urgent:\s*/i, "")
    .replace(/^\s*please\s+help\s+(?:me\s+)?(?:to\s+)?/i, "")
    .replace(/^\s*please\s+/i, "")
    .replace(/^\s*(?:can|could|would)\s+you\s+/i, "")
    .replace(/^\s*i\s+need\s+you\s+to\s+/i, "")
    .replace(/^\s*need\s+you\s+to\s+/i, "");
}

function stripDueDateLanguage(text: string): string {
  return text
    .replace(/\s+(?:by|before|due(?:\s+on)?|on)\s+\d{4}-\d{2}-\d{2}\b.*$/i, "")
    .replace(
      /\s+(?:by|before|due(?:\s+on)?|on)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*$/i,
      "",
    )
    .replace(/\s+(?:today|tomorrow)\b.*$/i, "")
    .replace(/\s+and\s+(?:let me know|reply|send|share|confirm)\b.*$/i, "");
}

function buildTitle(candidate: ActionCandidate): string {
  const withoutPrefix = stripRequestPrefix(candidate.text);
  const withoutDueDate = stripDueDateLanguage(withoutPrefix);
  const cleaned = normalizeWhitespace(withoutDueDate).replace(/[.!?]+$/g, "");
  return sentenceCase(cleaned);
}

function addUtcDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextWeekdayDate(receivedAt: Date, weekdayName: string): string {
  const targetDay = WEEKDAY_TO_UTC_DAY[weekdayName.toLowerCase()];
  const receivedDay = receivedAt.getUTCDay();
  let delta = targetDay - receivedDay;
  if (delta <= 0) {
    delta += 7;
  }
  return toIsoDate(addUtcDays(receivedAt, delta));
}

function extractDueDate(email: EmailToTodoInput, candidate: ActionCandidate): string | null {
  const haystack = normalizeWhitespace(candidate.text + " " + email.subject + " " + email.bodyText);
  const receivedAt = new Date(email.receivedAt);

  const explicitIso = haystack.match(/\b(?:by|before|due(?:\s+on)?|on)\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (explicitIso) {
    return explicitIso[1];
  }

  if (/\btoday\b/i.test(haystack)) {
    return toIsoDate(receivedAt);
  }
  if (/\btomorrow\b/i.test(haystack)) {
    return toIsoDate(addUtcDays(receivedAt, 1));
  }

  const weekday = haystack.match(
    /\b(?:by|before|due(?:\s+on)?|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );
  if (weekday) {
    return nextWeekdayDate(receivedAt, weekday[1]);
  }

  return null;
}

function detectPriority(email: EmailToTodoInput): EmailToTodoPriority {
  const haystack = email.subject + " " + email.bodyText + " " + (email.labels ?? []).join(" ");
  return HIGH_PRIORITY_PATTERNS.some((pattern) => pattern.test(haystack)) ? "high" : "normal";
}

function slugify(value: string): string {
  const slug = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "email";
}

function buildNotes(email: EmailToTodoInput, candidate: ActionCandidate): string {
  const source = candidate.source === "subject" ? "subject" : "body";
  return "Detected from email " + source + ': "' + normalizeWhitespace(candidate.text) + '"';
}

function buildTask(email: EmailToTodoInput, candidate: ActionCandidate): EmailTodoDraft {
  return {
    id: "todo-" + slugify(email.id) + "-1",
    title: buildTitle(candidate),
    notes: buildNotes(email, candidate),
    dueDate: extractDueDate(email, candidate),
    priority: detectPriority(email),
    completed: false,
    source: {
      emailId: normalizeWhitespace(email.id),
      subject: normalizeWhitespace(email.subject),
      sender: normalizeWhitespace(email.sender),
      receivedAt: email.receivedAt,
      labels: email.labels ?? [],
    },
  };
}

export function convertEmailToTodos(email: EmailToTodoInput): EmailToTodoResult {
  const errors = validateEmail(email);
  if (errors.length > 0) {
    return {
      status: "error",
      message: "Email could not be converted because required fields are missing or invalid.",
      tasks: [],
      errors,
    };
  }

  const [candidate] = actionCandidates(email);
  if (!candidate) {
    return {
      status: "empty",
      message: "No clear action item was detected in this email.",
      tasks: [],
    };
  }

  return {
    status: "success",
    message: "Task draft ready for user review. No mailbox or task data was mutated.",
    tasks: [buildTask(email, candidate)],
  };
}
