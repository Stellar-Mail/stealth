/**
 * SLA Deadline Tracker — core feature engine (#450).
 *
 * Pure, deterministic, folder-local logic for evaluating response-SLA status
 * across a set of tracked items. No network, no I/O, no main-app imports.
 * Time is injected (`now`) so evaluations are reproducible in tests.
 */

import type { SlaEvaluation, SlaPolicy, SlaStatus, SlaSummary, SlaTrackedItem } from "../types";

// (re-export for convenience; kept local to this folder)
export type { SlaTrackedItem, SlaPolicy, SlaEvaluation, SlaSummary, SlaStatus };

/** Clamp helper — keeps numeric math from producing NaN/Infinity surprises. */
function finiteOrZero(ms: number): number {
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Evaluate a single tracked item against a policy at time `now` (epoch ms).
 *
 * Rules:
 * - If `responded`, status is "responded" (SLA met) regardless of deadline.
 * - If no deadline applies (`deadlineAt === null`), status is "on-track"
 *   (nothing to breach) unless already responded.
 * - Otherwise compare remaining time to the policy windows:
 *     remaining < 0            -> "breached"
 *     0 <= remaining < warn    -> "due-soon"
 *     remaining >= warn        -> "on-track"
 */
export function evaluateSla(item: SlaTrackedItem, policy: SlaPolicy, now: number): SlaEvaluation {
  if (item.responded) {
    return {
      itemId: item.id,
      status: "responded",
      remainingMs: item.deadlineAt ? finiteOrZero(Date.parse(item.deadlineAt) - now) : 0,
      breached: false,
      responded: true,
    };
  }

  if (item.deadlineAt === null) {
    return {
      itemId: item.id,
      status: "on-track",
      remainingMs: 0,
      breached: false,
      responded: false,
    };
  }

  const deadline = Date.parse(item.deadlineAt);
  const remainingMs = finiteOrZero(deadline - now);

  let status: SlaStatus;
  if (remainingMs < 0) {
    status = "breached";
  } else if (remainingMs < policy.warnWindowMs) {
    status = "due-soon";
  } else {
    status = "on-track";
  }

  return {
    itemId: item.id,
    status,
    remainingMs,
    breached: status === "breached",
    responded: false,
  };
}

/**
 * Aggregate SLA status across many items at time `now`.
 * Pure and deterministic; safe for large arrays (single pass, no sorting
 * unless the caller needs ordering).
 */
export function summarizeSla(
  items: readonly SlaTrackedItem[],
  policy: SlaPolicy,
  now: number,
): SlaSummary {
  const summary: SlaSummary = {
    total: items.length,
    responded: 0,
    onTrack: 0,
    dueSoon: 0,
    breached: 0,
  };

  for (const item of items) {
    const ev = evaluateSla(item, policy, now);
    switch (ev.status) {
      case "responded":
        summary.responded += 1;
        break;
      case "on-track":
        summary.onTrack += 1;
        break;
      case "due-soon":
        summary.dueSoon += 1;
        break;
      case "breached":
        summary.breached += 1;
        break;
    }
  }

  return summary;
}

/**
 * Compute the deadline for a newly started item given a start time and policy.
 * Exposed so future UI work can preview deadlines consistently with the engine.
 */
export function computeDeadline(startedAt: string, policy: SlaPolicy): string {
  return new Date(Date.parse(startedAt) + policy.responseBudgetMs).toISOString();
}
