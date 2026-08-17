import type {
  ValidationGroup,
  ValidationIssue,
  ValidationNavigation,
  ValidationSeverity,
  ValidationSeveritySummary,
} from "./validation-types";
import type { Draft } from "./types/draft";

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

const SAFE_DOMAIN_PATTERN = /(@example\.(com|org)|@([\w.-]+\.)?stealth\.demo)$/i;

/** Validate campaign drafts and return any validation issues. */
export function validateCampaignDrafts(drafts: Draft[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (drafts.length === 0) {
    issues.push({
      id: "campaign-empty",
      severity: "info",
      fieldPath: "drafts",
      message: "The campaign currently contains no message drafts.",
      datasetId: "campaign-drafts",
      hint: "Go to the Templates tab to insert draft templates.",
    });
    return issues;
  }

  drafts.forEach((draft, index) => {
    const draftId = draft.id;

    // Subject validation
    if (!draft.subject || draft.subject.trim() === "") {
      issues.push({
        id: `draft-${draftId}-subject-empty`,
        severity: "error",
        fieldPath: `drafts[${index}].subject`,
        message: "Subject is required for draft message.",
        datasetId: "campaign-drafts",
        recordId: draftId,
        hint: "Enter a subject line for this draft.",
      });
    }

    // Body validation
    if (!draft.body || draft.body.trim() === "") {
      issues.push({
        id: `draft-${draftId}-body-empty`,
        severity: "error",
        fieldPath: `drafts[${index}].body`,
        message: "Message body is empty.",
        datasetId: "campaign-drafts",
        recordId: draftId,
        hint: "Enter a body text for this draft.",
      });
    }

    // Recipients validation
    if (!draft.recipients || draft.recipients.length === 0) {
      issues.push({
        id: `draft-${draftId}-recipients-empty`,
        severity: "error",
        fieldPath: `drafts[${index}].recipients`,
        message: "Recipient list is empty.",
        datasetId: "campaign-drafts",
        recordId: draftId,
        hint: "Add at least one recipient federated address or email.",
      });
    } else {
      draft.recipients.forEach((recipient, rIdx) => {
        const hasAt = recipient.includes("@");
        const hasAsterisk = recipient.includes("*");

        if (!hasAt && !hasAsterisk) {
          issues.push({
            id: `draft-${draftId}-recipient-${rIdx}-invalid-format`,
            severity: "error",
            fieldPath: `drafts[${index}].recipients[${rIdx}]`,
            message: `Recipient "${recipient}" format is invalid. Must be an email address or federated handle.`,
            datasetId: "campaign-drafts",
            recordId: draftId,
            hint: "Use a format like name@domain.com or name*federation.",
          });
          return;
        }

        // Check for safe domain
        const normalized = recipient.replace("*", "@");
        const isSafe = SAFE_DOMAIN_PATTERN.test(normalized);
        if (!isSafe) {
          issues.push({
            id: `draft-${draftId}-recipient-${rIdx}-unsafe-domain`,
            severity: "warning",
            fieldPath: `drafts[${index}].recipients[${rIdx}]`,
            message: `Recipient "${recipient}" uses an external or unverified domain for a demo campaign.`,
            datasetId: "campaign-drafts",
            recordId: draftId,
            hint: "For safety, stick to example.com, example.org, or *.stealth.demo.",
          });
        }
      });
    }
  });

  return issues;
}
