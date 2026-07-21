/**
 * Public surface of the Legal & Compliance Review Flag tool's non-UI contract.
 *
 * Import from here to avoid reaching into internal files. Everything exposed is
 * backend-facing; there are no React/DOM exports in this folder.
 */

export * from "./contract";
export { createReviewFlagService } from "./services/review-flag-service";
export type { ReviewFlagBackend, ReviewFlagService } from "./services/review-flag-service";
