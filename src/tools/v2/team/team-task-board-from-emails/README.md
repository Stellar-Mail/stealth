# team-task-board-from-emails

Parses email threads into structured tasks for a team kanban board.
Self-contained. No network calls, no external dependencies, no app integration.

## Public API

### parseEmailsToTasks(emails: EmailFixture[]): ParseResult

Takes an array of email objects and returns extracted tasks.

### groupByAssignee(tasks: Task[]): Record<string, Task[]>

Groups tasks by assignee. Unassigned tasks are keyed as "unassigned".

### groupByStatus(tasks: Task[]): Record<string, Task[]>

Groups tasks by status for board column rendering.

## States

idle: no parse started
parsing: parseEmailsToTasks running
done: parse complete
error: individual email failed (non-fatal)

## Usage

import { parseEmailsToTasks, groupByAssignee, mockEmails } from "./index";

const { tasks, skipped } = parseEmailsToTasks(mockEmails);
const board = groupByAssignee(tasks);
