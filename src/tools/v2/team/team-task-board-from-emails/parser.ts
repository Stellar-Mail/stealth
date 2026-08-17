import { EmailFixture, Task, ParseResult, ParseError } from "./types";

const DATE_PATTERN = /\b(\d{4}-\d{2}-\d{2})\b/g;

const ACTION_PATTERNS = [
  /\b(needs? to|should|must|please|will handle|assigning to|assign)\b/i,
  /\b(fix|finish|review|update|deploy|write|handle|complete)\b/i,
];

const NOISE_PATTERNS = [
  /^(hi|hey|hello|thanks|regards|cheers|dear)\b/i,
  /^you have been invited/i,
  /^re:/i,
];

function isActionable(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 10) return false;
  if (NOISE_PATTERNS.some((p) => p.test(trimmed))) return false;
  return ACTION_PATTERNS.some((p) => p.test(trimmed));
}

function extractDate(text: string): string | null {
  const match = text.match(DATE_PATTERN);
  return match ? match[0] : null;
}

function extractAssignee(text: string, knownNames: string[]): string | null {
  for (const name of knownNames) {
    const pattern = new RegExp(
      `\\b${name}\\b.{0,40}(needs? to|should|will|handle)|(assigning to\\s+${name})`,
      "i",
    );
    if (pattern.test(text)) return name;
  }
  return null;
}

function extractNames(emails: EmailFixture[]): string[] {
  const raw = emails.flatMap((e) => [e.from, ...e.to]);
  return [
    ...new Set(
      raw.map((addr) => addr.split("@")[0]).map((n) => n.charAt(0).toUpperCase() + n.slice(1)),
    ),
  ];
}

function parseEmail(
  email: EmailFixture,
  knownNames: string[],
): { tasks: Task[]; error: ParseError | null } {
  const lines = email.body
    .split("\n")
    .map((l) => l.replace(/^[-\d.)\s]+/, "").trim())
    .filter(isActionable);

  if (lines.length === 0) {
    return { tasks: [], error: { emailId: email.id, reason: "no actionable lines found" } };
  }

  const tasks: Task[] = lines.map((line, i) => ({
    id: `${email.id}-task-${i}`,
    title: line.length > 80 ? line.slice(0, 77) + "..." : line,
    assignee: extractAssignee(line, knownNames),
    dueDate: extractDate(line),
    status: "todo",
    sourceEmailId: email.id,
    raw: line,
  }));

  return { tasks, error: null };
}

export function parseEmailsToTasks(emails: EmailFixture[]): ParseResult {
  const knownNames = extractNames(emails);
  const allTasks: Task[] = [];
  let skipped = 0;

  for (const email of emails) {
    const { tasks, error } = parseEmail(email, knownNames);
    if (error || tasks.length === 0) {
      skipped++;
    } else {
      allTasks.push(...tasks);
    }
  }

  return { tasks: allTasks, skipped };
}

export function groupByAssignee(tasks: Task[]): Record<string, Task[]> {
  return tasks.reduce<Record<string, Task[]>>((acc, task) => {
    const key = task.assignee ?? "unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});
}

export function groupByStatus(tasks: Task[]): Record<string, Task[]> {
  return tasks.reduce<Record<string, Task[]>>((acc, task) => {
    if (!acc[task.status]) acc[task.status] = [];
    acc[task.status].push(task);
    return acc;
  }, {});
}
