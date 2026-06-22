export type ValidationSeverity = "error" | "warning" | "info";

export type ValidationIssue = {
  id: string;
  severity: ValidationSeverity;
  /** Dot/bracket path to the offending field, e.g. "records[3].email". */
  fieldPath: string;
  message: string;
  /** Identifier of the dataset the issue belongs to. */
  datasetId: string;
  /** Optional record identifier within the dataset. */
  recordId?: string;
  /** Optional short, non-technical hint on how to fix it. */
  hint?: string;
};

/** Metadata used to navigate from an issue to its source field. */
export type ValidationNavigation = {
  datasetId: string;
  recordId?: string;
  fieldPath: string;
};

export type ValidationSeveritySummary = {
  error: number;
  warning: number;
  info: number;
  total: number;
};

export type ValidationGroup = {
  severity: ValidationSeverity;
  issues: ValidationIssue[];
};
