/** Outcome of a single pre-publish readiness check. */
export type PublishChecklistStatus = "pass" | "warning" | "blocked";

/** One row in the publish checklist shown to maintainers. */
export type PublishChecklistItem = {
  id: string;
  label: string;
  status: PublishChecklistStatus;
  /** Human-readable detail when the check did not pass. */
  detail?: string;
  /** Optional short hint on how to resolve a failure. */
  hint?: string;
};

/** Aggregate result returned by `buildPublishChecklist`. */
export type PublishChecklistResult = {
  items: PublishChecklistItem[];
  /** True when no item is blocked — the dataset may be published. */
  readyToPublish: boolean;
};

export type PublishChecklistSummary = {
  pass: number;
  warning: number;
  blocked: number;
  total: number;
};
