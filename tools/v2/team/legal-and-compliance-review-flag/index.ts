/**
 * Public surface of the Legal & Compliance Review Flag tool's non-UI contract and isolated components.
 *
 * Import from here to avoid reaching into internal files. Everything exposed is
 * folder-isolated; no core app dependencies are used.
 */

export * from "./contract";
export * from "./types";
export { createReviewFlagService } from "./services/review-flag-service";
export type { ReviewFlagBackend, ReviewFlagService } from "./services/review-flag-service";
export { useReviewFlag } from "./hooks/useReviewFlag";
export type { UseReviewFlagReturn } from "./hooks/useReviewFlag";
export { LegalReviewFlagForm } from "./components/LegalReviewFlagForm";
export type { LegalReviewFlagFormProps } from "./components/LegalReviewFlagForm";
