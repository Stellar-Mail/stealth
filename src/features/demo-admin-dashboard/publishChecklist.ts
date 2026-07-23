import type { Draft } from "./types/draft";
import type {
  PublishChecklistItem,
  PublishChecklistResult,
  PublishChecklistStatus,
  PublishChecklistSummary,
} from "./publishChecklist-types";
import { isDatasetValid } from "./validation";
import type { ValidationIssue } from "./validation-types";

/** Allowed recipient domains for demo data (matches QA checklist). */
export const SAFE_RECIPIENT_DOMAIN_PATTERN = /(@example\.(com|org)|@[\w.-]+\.stealth\.demo)$/i;

const STATUS_RANK: Record<PublishChecklistStatus, number> = {
  blocked: 0,
  warning: 1,
  pass: 2,
};

function item(
  id: string,
  label: string,
  status: PublishChecklistStatus,
  detail?: string,
  hint?: string,
): PublishChecklistItem {
  return { id, label, status, detail, hint };
}

function isSafeRecipient(address: string): boolean {
  return SAFE_RECIPIENT_DOMAIN_PATTERN.test(address.trim());
}

function hasRequiredDraftFields(draft: Draft): boolean {
  return Boolean(
    draft.id?.trim() &&
    draft.subject?.trim() &&
    draft.body?.trim() &&
    Array.isArray(draft.recipients),
  );
}

/** Count checklist items by status. */
export function summarizePublishChecklist(items: PublishChecklistItem[]): PublishChecklistSummary {
  const summary: PublishChecklistSummary = {
    pass: 0,
    warning: 0,
    blocked: 0,
    total: items.length,
  };
  for (const entry of items) {
    summary[entry.status] += 1;
  }
  return summary;
}

/** Sort blocked first, then warnings, then passes (stable by label). */
export function sortPublishChecklistItems(items: PublishChecklistItem[]): PublishChecklistItem[] {
  return [...items].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;
    return a.label.localeCompare(b.label);
  });
}

/** True when every item is pass or warning (no blockers). */
export function isReadyToPublish(items: PublishChecklistItem[]): boolean {
  return items.every((entry) => entry.status !== "blocked");
}

/**
 * Build the pre-publish checklist for a draft dataset.
 * Optional validation issues from field-level validators are folded in.
 */
export function buildPublishChecklist(
  drafts: Draft[],
  validationIssues: ValidationIssue[] = [],
): PublishChecklistResult {
  const items: PublishChecklistItem[] = [];

  if (drafts.length === 0) {
    items.push(
      item(
        "drafts-present",
        "Draft dataset is not empty",
        "blocked",
        "Add at least one draft before publishing.",
        "Insert a template or create a draft in the Templates tab.",
      ),
    );
  } else {
    items.push(item("drafts-present", "Draft dataset is not empty", "pass"));
  }

  const incompleteDrafts = drafts.filter((draft) => !hasRequiredDraftFields(draft));
  if (incompleteDrafts.length > 0) {
    items.push(
      item(
        "draft-fields",
        "Each draft has required fields",
        "blocked",
        `${incompleteDrafts.length} draft(s) are missing id, subject, body, or recipients.`,
        "Fill in every required field on each draft row.",
      ),
    );
  } else if (drafts.length > 0) {
    items.push(item("draft-fields", "Each draft has required fields", "pass"));
  }

  const draftsWithoutRecipients = drafts.filter((draft) => draft.recipients.length === 0);
  if (draftsWithoutRecipients.length > 0) {
    items.push(
      item(
        "recipients-present",
        "Each draft has at least one recipient",
        "blocked",
        `${draftsWithoutRecipients.length} draft(s) have no recipients.`,
        "Add one or more demo addresses per draft.",
      ),
    );
  } else if (drafts.length > 0) {
    items.push(item("recipients-present", "Each draft has at least one recipient", "pass"));
  }

  const unsafeRecipients: string[] = [];
  for (const draft of drafts) {
    for (const recipient of draft.recipients) {
      if (!isSafeRecipient(recipient)) {
        unsafeRecipients.push(recipient);
      }
    }
  }
  if (unsafeRecipients.length > 0) {
    items.push(
      item(
        "safe-domains",
        "Recipients use safe demo domains only",
        "blocked",
        `Unsafe addresses: ${unsafeRecipients.slice(0, 3).join(", ")}${
          unsafeRecipients.length > 3 ? "…" : ""
        }`,
        "Use example.com, example.org, or a *.stealth.demo handle.",
      ),
    );
  } else if (drafts.length > 0) {
    items.push(item("safe-domains", "Recipients use safe demo domains only", "pass"));
  }

  const errorCount = validationIssues.filter((issue) => issue.severity === "error").length;
  if (!isDatasetValid(validationIssues)) {
    items.push(
      item(
        "validation-errors",
        "No blocking validation errors",
        "blocked",
        `${errorCount} validation error(s) must be resolved.`,
        "Open the validation panel and fix each error before publishing.",
      ),
    );
  } else {
    items.push(item("validation-errors", "No blocking validation errors", "pass"));
  }

  const warningCount = validationIssues.filter((issue) => issue.severity === "warning").length;
  if (warningCount > 0) {
    items.push(
      item(
        "validation-warnings",
        "Validation warnings reviewed",
        "warning",
        `${warningCount} warning(s) remain — review before publishing.`,
        "Warnings do not block publish but may affect the demo preview.",
      ),
    );
  } else {
    items.push(item("validation-warnings", "Validation warnings reviewed", "pass"));
  }

  const sorted = sortPublishChecklistItems(items);
  return {
    items: sorted,
    readyToPublish: isReadyToPublish(sorted),
  };
}
