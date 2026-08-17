/**
 * Folder-local UI state types for the Legal & Compliance Review Flag surface.
 *
 * These describe the form submit lifecycle only and reuse the backend
 * contract types (ReviewFlagResult / ReviewFlagError) so the UI and the pure
 * contract never drift. Nothing here touches the DOM, network, or database.
 */

import type { ReviewFlagResult, ReviewFlagError, ReviewFlagSeverity } from "./contract";

export interface ReviewFlagFormValues {
  reviewer: string;
  targetResource: string;
  flagReason: string;
  severity: ReviewFlagSeverity;
  evidenceRefs: string;
}

export type ReviewFlagSubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; result: ReviewFlagResult }
  | { status: "error"; error: ReviewFlagError };

export const INITIAL_FORM_VALUES: ReviewFlagFormValues = {
  reviewer: "",
  targetResource: "",
  flagReason: "",
  severity: "medium",
  evidenceRefs: "",
};

export const SEVERITY_OPTIONS: readonly ReviewFlagSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];
