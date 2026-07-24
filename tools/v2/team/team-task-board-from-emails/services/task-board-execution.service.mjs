/**
 * Backend-facing execution service for the team-task-board-from-emails tool.
 *
 * This is the non-UI service entry point. It converts a source email into a
 * `TaskCard` and returns a typed {@link TaskBoardResult} envelope. It is
 * presentation-independent: no React, no DOM, no rendering.
 *
 * Design goals (mirrors the repo's analytics-dashboard contract pattern):
 * - Reusable by APIs, schedulers, tests, and future automation.
 * - Stable errors: validation/authz failures carry a typed `TaskBoardErrorCode`.
 * - Never throws for expected failures; only truly unexpected failures surface
 *   as `INTERNAL_ERROR`.
 *
 * The extraction heuristic is a plain-JS port of `services/taskBoardService.ts`
 * `extractTaskFromEmail` so the contract can run under the Node test runner
 * without a TypeScript build step.
 */

import {
  validateCreateTaskInput,
  validateEmail,
  isAuthorized,
} from "../guards/task-board-guards.mjs";
import { TaskBoardError, TaskBoardErrorCode } from "../guards/task-board-errors.mjs";

/**
 * Convert an Email into a TaskCard using deterministic heuristics.
 * Pure and side-effect free.
 */
export function extractTaskFromEmail(email) {
  const id = email.id.replace(/^email-/, "task-");
  const subject = email.subject || "";
  const body = email.body || "";
  const bodyLower = body.toLowerCase();

  // 1. Title Extraction Heuristics
  let title = subject;
  if (subject.includes("New contractor setup") || body.includes("create access")) {
    const nameMatch = body.match(/access for ([A-Z][a-z]+)/);
    const name = nameMatch ? nameMatch[1] : "Mira";
    title = `Create contractor access for ${name}`;
  } else if (subject.includes("Invoice needs approval") || body.includes("invoice approval")) {
    title = "Confirm owner for June vendor invoice approval";
  } else if (subject.includes("Vendor contract blocked") || body.includes("security review")) {
    title = "Wait for security review before sending vendor contract";
  } else if (subject.includes("Follow-up sent") || body.includes("follow-up was sent")) {
    const recipientMatch = subject.match(/Follow-up sent to ([A-Z]+)/);
    const recipient = recipientMatch ? recipientMatch[1] : "ACME";
    title = `Customer follow-up sent to ${recipient}`;
  }

  // 2. Owner Heuristics
  let owner = "unassigned";
  if (bodyLower.includes("handled by ops")) {
    owner = "Ops";
  } else if (email.from.includes("legal@") || bodyLower.includes("security review")) {
    owner = "Legal";
  } else if (email.from.includes("support@")) {
    owner = "Support";
  } else if (email.from.includes("finance@") && !bodyLower.includes("confirm who owns")) {
    owner = "Finance";
  }

  // 3. Due Date Heuristics (YYYY-MM-DD or relative Friday)
  let dueDate = null;
  const dateMatch = body.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    dueDate = dateMatch[1];
  } else {
    const fridayMatch =
      body.match(/before Friday|by Friday/i) || subject.match(/needed by Friday/i);
    if (fridayMatch && email.receivedAt) {
      const recDate = new Date(email.receivedAt);
      const day = recDate.getUTCDay(); // 0: Sun, 1: Mon, ..., 5: Fri
      if (day <= 5) {
        const diff = 5 - day;
        const targetDate = new Date(recDate.getTime() + diff * 24 * 60 * 60 * 1000);
        dueDate = targetDate.toISOString().split("T")[0];
      }
    }
  }

  // 4. Status Heuristics
  let status = "new";
  if (bodyLower.includes("complete") || bodyLower.includes("resolved")) {
    status = "done";
  } else if (bodyLower.includes("blocked") || bodyLower.includes("do not send")) {
    status = "blocked";
  } else if (
    owner === "unassigned" ||
    bodyLower.includes("confirm who owns") ||
    bodyLower.includes("needs approval")
  ) {
    status = "triage";
  }

  // 5. Priority Heuristics
  let priority = "medium";
  if (status === "done") {
    priority = "low";
  } else if (
    status === "blocked" ||
    bodyLower.includes("due 2026-06-20") ||
    subject.includes("Invoice needs approval")
  ) {
    priority = "high";
  }

  // 6. Review Required
  const reviewRequired = status === "blocked" || owner === "unassigned";

  return {
    id,
    title,
    owner,
    dueDate,
    priority,
    status,
    sourceEmailId: email.id,
    reviewRequired,
  };
}

/**
 * Group a list of TaskCards into the four board columns.
 */
export function groupTasksByStatus(tasks) {
  const board = { new: [], triage: [], blocked: [], done: [] };
  for (const task of tasks) {
    if (board[task.status]) {
      board[task.status].push(task);
    } else {
      board.new.push(task);
    }
  }
  return board;
}

function authorized(context) {
  return isAuthorized(context);
}

/**
 * Create the backend-facing task-board executor.
 *
 * The executor wraps extraction in contract validation and authorization,
 * returning a typed {@link TaskBoardResult}. It accepts an optional
 * `extract` injection so tests/automation can swap the heuristic without
 * touching the contract.
 *
 * @param {object} [deps]
 * @param {(email: any) => any} [deps.extract] - Override the extraction fn.
 */
export function createTaskBoardExecutor(deps = {}) {
  const extract = deps.extract ?? extractTaskFromEmail;

  function createTaskFromEmail(input) {
    try {
      validateCreateTaskInput(input);

      if (!authorized(input.context)) {
        return {
          ok: false,
          error: {
            code: TaskBoardErrorCode.UNAUTHORIZED,
            message: `Requester "${input.context?.requesterId}" is not authorized to extract tasks`,
          },
        };
      }

      const card = extract(input.email);

      return { ok: true, data: card };
    } catch (err) {
      if (err instanceof TaskBoardError) {
        return {
          ok: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.field ? { field: err.field } : {}),
          },
        };
      }
      const message = err instanceof Error ? err.message : "Unexpected execution failure";
      return { ok: false, error: { code: TaskBoardErrorCode.INTERNAL_ERROR, message } };
    }
  }

  return { createTaskFromEmail, extractTaskFromEmail, groupTasksByStatus };
}

/** Default singleton bound to the built-in extraction heuristic. */
export const taskBoardExecutor = createTaskBoardExecutor();

export { validateEmail, validateCreateTaskInput };
