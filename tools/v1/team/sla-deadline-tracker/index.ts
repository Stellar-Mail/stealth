/**
 * SLA Deadline Tracker — folder-local public API surface (#450).
 *
 * Future UI/integration work should import from this index only, keeping the
 * core engine decoupled from the main application.
 */

export type { SlaTrackedItem, SlaPolicy, SlaEvaluation, SlaSummary, SlaStatus } from "./types";

export { evaluateSla, summarizeSla, computeDeadline } from "./services/slaTracker";
