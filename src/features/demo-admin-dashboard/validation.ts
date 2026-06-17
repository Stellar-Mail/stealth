import type {
  ValidationGroup,
  ValidationIssue,
  ValidationNavigation,
  ValidationSeverity,
  ValidationSeveritySummary,
} from "./validation-types";

/** Display order for severities (errors first). */
export const SEVERITY_ORDER: ValidationSeverity[] = ["error", "warning", "info"];

const SEVERITY_RANK: Record<ValidationSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export const SEVERITY_LABEL: Record<ValidationSeverity, string> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info",
};

/** Count issues per severity (plus total). */
export function summarizeValidation(issues: ValidationIssue[]): ValidationSeveritySummary {
  const summary: ValidationSeveritySummary = {
    error: 0,
    warning: 0,
    info: 0,
    total: 0,
  };
  for (const issue of issues) {
    summary[issue.severity] += 1;
    summary.total += 1;
  }
  return summary;
}

/** Sort by severity (errors first), then field path for stable ordering. */
export function sortIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.fieldPath.localeCompare(b.fieldPath);
  });
}

/** Group issues by severity in display order; empty groups are omitted. */
export function groupBySeverity(issues: ValidationIssue[]): ValidationGroup[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    issues: sortIssues(issues.filter((issue) => issue.severity === severity)),
  })).filter((group) => group.issues.length > 0);
}

/** Extract the navigation metadata needed to jump to an issue's field. */
export function getIssueNavigation(issue: ValidationIssue): ValidationNavigation {
  return {
    datasetId: issue.datasetId,
    recordId: issue.recordId,
    fieldPath: issue.fieldPath,
  };
}

/** True when there are no blocking errors (warnings/info are allowed). */
export function isDatasetValid(issues: ValidationIssue[]): boolean {
  return issues.every((issue) => issue.severity !== "error");
}
