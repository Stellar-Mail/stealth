export type TaskStatus = "todo" | "in-progress" | "done";

export interface EmailFixture {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  receivedAt: string;
}

export interface Task {
  id: string;
  title: string;
  assignee: string | null;
  dueDate: string | null;
  status: TaskStatus;
  sourceEmailId: string;
  raw: string;
}

export interface ParseResult {
  tasks: Task[];
  skipped: number;
}

export type LoadingState = "idle" | "parsing" | "done" | "error";

export interface ParseError {
  emailId: string;
  reason: string;
}
