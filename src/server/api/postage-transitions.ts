/**
 * Allowed postage state-transition rules (#1496).
 *
 * The repository already exposes atomic compare-and-swap transitions
 * (`transitionPostage` / `insertPostage` in memory-repository.ts and
 * kv-repository.ts), but it permits ANY expected->next pair as long as the
 * current status matches `expected`. That is insufficient: a `settled` record
 * must never move back to `pending`, and a `refunded` record is terminal. This
 * module is the single source of truth for which transitions are legal, so the
 * "only allowed transitions succeed" criterion is enforced consistently and is
 * unit-testable without a database.
 *
 * Terminal retries MUST be deterministic: re-applying a transition whose
 * `next` equals the current status is a no-op success (idempotent), not an
 * error, so callers can safely retry without producing spurious conflicts.
 *
 * Self-contained: imports only the domain `PostageStatus` type.
 */

import type { PostageStatus } from "./domain";

/** Stable, non-secret error code (no postage/record data is leaked). */
export class PostageTransitionError extends Error {
  readonly code = "postage_transition_invalid" as const;
  constructor(message: string) {
    super(message);
    this.name = "PostageTransitionError";
  }
}

/**
 * Allowed forward transitions for each status. `pending` may become
 * `settled` (payment captured) or `refunded` (reversed). `settled` may only go
 * to `refunded` (a refund after settlement). `refunded` is terminal: no
 * outgoing transitions are permitted.
 */
export const ALLOWED_POSTAGE_TRANSITIONS: Record<PostageStatus, readonly PostageStatus[]> = {
  pending: ["settled", "refunded"],
  settled: ["refunded"],
  refunded: [],
};

/** True iff `from -> to` is a permitted transition (including the idempotent no-op `from -> from`). */
export function isAllowedTransition(from: PostageStatus, to: PostageStatus): boolean {
  if (from === to) return true; // terminal/retry idempotency is always allowed
  return (ALLOWED_POSTAGE_TRANSITIONS[from] as readonly PostageStatus[]).includes(to);
}

/**
 * Validate a desired transition, throwing {@link PostageTransitionError} when
 * the move is not permitted. Callers should run this BEFORE invoking
 * `transitionPostage` so illegal moves fail fast and deterministically rather
 * than relying on the repository's looser CAS semantics.
 */
export function validatePostageTransition(from: PostageStatus, to: PostageStatus): void {
  if (!isAllowedTransition(from, to)) {
    throw new PostageTransitionError(`Illegal postage transition: ${from} -> ${to}`);
  }
}
