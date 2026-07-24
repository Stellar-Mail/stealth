/**
 * Shared Team Inbox — folder-local public API surface (#445).
 *
 * Future UI/integration work should import only from this index.
 */
export {
  createTeamInbox,
  isAllowedTransition,
  TriageTransitionError,
} from "./services/inboxEngine";
export type { TeamInbox } from "./services/inboxEngine";
export type { Annotation, TeamMessage, TeamReply, TriageRecord, TriageStatus } from "./types";
