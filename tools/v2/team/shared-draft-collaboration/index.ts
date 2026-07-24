// Types
export type {
  SharedDraftData,
  CreateDraftInput,
  UpdateDraftInput,
  DraftFilter,
  DraftMetrics,
  DraftId,
  ServiceConfig,
} from "./types";

// Errors
export { DraftValidationError, DraftNotFoundError, DraftLimitError } from "./errors";
export type { DraftError } from "./errors";

// Guards
export {
  validateDraftId,
  validateDraftTitle,
  validateDraftSubject,
  validateCollaboratorCount,
  validateSearchQuery,
  guardDraftsCount,
  validateDraftInput,
  sanitizeText,
  LIMITS,
} from "./guards/draft-guards.mjs";

// Service
export { createDraftService, computeMetrics, applyFilter } from "./services/draft.service.mjs";

// Fixtures
export { DRAFT_FIXTURES, ACTIVE_DRAFTS, INACTIVE_DRAFTS } from "./fixtures/drafts.fixtures.mjs";
