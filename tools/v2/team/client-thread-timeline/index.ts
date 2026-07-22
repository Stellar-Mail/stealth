/**
 * index.ts — Client Thread Timeline
 *
 * Folder-local API surface. Exports the non-UI execution contract, its types,
 * and the underlying helpers. Nothing in this file imports from the main app.
 */

// Types
export type {
  TimelineMessage,
  TimelineThread,
  ClientTimeline,
  BuildTimelineInput,
  GetThreadInput,
  TimelineOrder,
} from "./types";

// Contract + service
export { createTimelineContract } from "./services/timeline.service";
export { TimelineErrorCode, buildClientTimeline, getClientThread, ok, fail } from "./contract";
export type {
  TimelineContract,
  TimelineOperation,
  TimelineContractOutput,
  TimelineResult,
} from "./contract";

// Fixtures
export { TIMELINE_FIXTURES, ACME_MESSAGES, EMPTY_MESSAGES } from "./fixtures";
