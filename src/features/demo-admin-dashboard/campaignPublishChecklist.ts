/**
 * Campaign publish readiness checklist.
 *
 * Pure, deterministic helpers that evaluate whether a demo campaign is ready
 * for the mock publish flow. The checklist reports blocking problems that must
 * be resolved before publishing and non-blocking warnings reviewers should be
 * aware of. Nothing is mutated and no external services are contacted, so the
 * helpers are safe to run repeatedly against demo fixtures.
 */

export type ChecklistSeverity = "blocker" | "warning";

export type ChecklistStatus = "pass" | "fail";

export interface ChecklistDraft {
  subject: string;
  body: string;
  recipients: string[];
}

export interface CampaignPublishChecklistInput {
  name: string;
  tags: string[];
  drafts: ChecklistDraft[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  severity: ChecklistSeverity;
  status: ChecklistStatus;
  message: string;
}

export interface CampaignPublishChecklistReport {
  ready: boolean;
  items: ChecklistItem[];
  blockers: ChecklistItem[];
  warnings: ChecklistItem[];
  summary: string;
}

export const LARGE_BATCH_THRESHOLD = 50;

export const MAX_SUBJECT_LENGTH = 120;

const STELLAR_SECRET_KEY_PATTERN = /\bS[A-Z2-7]{55}\b/;

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function hasDuplicateRecipients(recipients: string[]): boolean {
  const seen = new Set<string>();
  for (const recipient of recipients) {
    const normalized = recipient.trim().toLowerCase();
    if (normalized.length === 0) {
      continue;
    }
    if (seen.has(normalized)) {
      return true;
    }
    seen.add(normalized);
  }
  return false;
}

function containsSecretKey(value: string): boolean {
  return STELLAR_SECRET_KEY_PATTERN.test(value);
}

function buildSummary(ready: boolean, blockerCount: number, warningCount: number): string {
  if (ready && warningCount === 0) {
    return "Campaign is ready for mock publish.";
  }
  if (ready) {
    return `Campaign is ready for mock publish with ${warningCount} ${pluralize(
      warningCount,
      "warning",
      "warnings",
    )}.`;
  }
  return `Campaign is not ready: resolve ${blockerCount} ${pluralize(
    blockerCount,
    "blocker",
    "blockers",
  )} before publishing.`;
}

export function buildCampaignPublishChecklist(
  input: CampaignPublishChecklistInput,
): CampaignPublishChecklistReport {
  const name = input.name ?? "";
  const tags = input.tags ?? [];
  const drafts = input.drafts ?? [];

  const draftsMissingSubject = drafts.filter((draft) => !isNonEmpty(draft.subject ?? "")).length;
  const draftsMissingBody = drafts.filter((draft) => !isNonEmpty(draft.body ?? "")).length;
  const draftsWithoutRecipients = drafts.filter(
    (draft) => (draft.recipients ?? []).filter((recipient) => isNonEmpty(recipient)).length === 0,
  ).length;
  const draftsWithSecretKeys = drafts.filter((draft) => {
    const recipientText = (draft.recipients ?? []).join(" ");
    return containsSecretKey(draft.body ?? "") || containsSecretKey(recipientText);
  }).length;
  const draftsWithDuplicateRecipients = drafts.filter((draft) =>
    hasDuplicateRecipients(draft.recipients ?? []),
  ).length;
  const draftsWithLongSubject = drafts.filter(
    (draft) => (draft.subject ?? "").trim().length > MAX_SUBJECT_LENGTH,
  ).length;

  const items: ChecklistItem[] = [
    {
      id: "campaign-name",
      label: "Campaign has a name",
      severity: "blocker",
      status: isNonEmpty(name) ? "pass" : "fail",
      message: isNonEmpty(name)
        ? "Campaign name is set."
        : "Add a campaign name before publishing.",
    },
    {
      id: "has-drafts",
      label: "Campaign has at least one draft",
      severity: "blocker",
      status: drafts.length > 0 ? "pass" : "fail",
      message:
        drafts.length > 0
          ? `Campaign contains ${drafts.length} ${pluralize(drafts.length, "draft", "drafts")}.`
          : "Add at least one demo draft before publishing.",
    },
    {
      id: "draft-subjects",
      label: "Every draft has a subject",
      severity: "blocker",
      status: draftsMissingSubject === 0 ? "pass" : "fail",
      message:
        draftsMissingSubject === 0
          ? "All drafts have a subject."
          : `${draftsMissingSubject} ${pluralize(
              draftsMissingSubject,
              "draft is",
              "drafts are",
            )} missing a subject.`,
    },
    {
      id: "draft-bodies",
      label: "Every draft has a body",
      severity: "blocker",
      status: draftsMissingBody === 0 ? "pass" : "fail",
      message:
        draftsMissingBody === 0
          ? "All drafts have body content."
          : `${draftsMissingBody} ${pluralize(
              draftsMissingBody,
              "draft is",
              "drafts are",
            )} missing body content.`,
    },
    {
      id: "draft-recipients",
      label: "Every draft has at least one recipient",
      severity: "blocker",
      status: draftsWithoutRecipients === 0 ? "pass" : "fail",
      message:
        draftsWithoutRecipients === 0
          ? "All drafts have at least one recipient."
          : `${draftsWithoutRecipients} ${pluralize(
              draftsWithoutRecipients,
              "draft has",
              "drafts have",
            )} no recipients.`,
    },
    {
      id: "no-secret-keys",
      label: "No draft exposes a Stellar secret key",
      severity: "blocker",
      status: draftsWithSecretKeys === 0 ? "pass" : "fail",
      message:
        draftsWithSecretKeys === 0
          ? "No Stellar secret keys detected in demo drafts."
          : `${draftsWithSecretKeys} ${pluralize(
              draftsWithSecretKeys,
              "draft appears",
              "drafts appear",
            )} to contain a Stellar secret key.`,
    },
    {
      id: "has-tags",
      label: "Campaign has at least one tag",
      severity: "warning",
      status: tags.filter((tag) => isNonEmpty(tag)).length > 0 ? "pass" : "fail",
      message:
        tags.filter((tag) => isNonEmpty(tag)).length > 0
          ? "Campaign tags are set."
          : "Add campaign tags so the dataset is easier to filter.",
    },
    {
      id: "unique-recipients",
      label: "Drafts have no duplicate recipients",
      severity: "warning",
      status: draftsWithDuplicateRecipients === 0 ? "pass" : "fail",
      message:
        draftsWithDuplicateRecipients === 0
          ? "No duplicate recipients detected."
          : `${draftsWithDuplicateRecipients} ${pluralize(
              draftsWithDuplicateRecipients,
              "draft has",
              "drafts have",
            )} duplicate recipients.`,
    },
    {
      id: "batch-size",
      label: "Draft batch size is within the preview limit",
      severity: "warning",
      status: drafts.length <= LARGE_BATCH_THRESHOLD ? "pass" : "fail",
      message:
        drafts.length <= LARGE_BATCH_THRESHOLD
          ? "Draft batch size is within the preview limit."
          : `Campaign has ${drafts.length} drafts, above the ${LARGE_BATCH_THRESHOLD} draft preview limit.`,
    },
    {
      id: "subject-length",
      label: "Draft subjects are within the recommended length",
      severity: "warning",
      status: draftsWithLongSubject === 0 ? "pass" : "fail",
      message:
        draftsWithLongSubject === 0
          ? "All draft subjects are within the recommended length."
          : `${draftsWithLongSubject} ${pluralize(
              draftsWithLongSubject,
              "draft subject exceeds",
              "draft subjects exceed",
            )} ${MAX_SUBJECT_LENGTH} characters.`,
    },
  ];

  const blockers = items.filter((item) => item.severity === "blocker" && item.status === "fail");
  const warnings = items.filter((item) => item.severity === "warning" && item.status === "fail");
  const ready = blockers.length === 0;

  return {
    ready,
    items,
    blockers,
    warnings,
    summary: buildSummary(ready, blockers.length, warnings.length),
  };
}

export function isCampaignReadyToPublish(input: CampaignPublishChecklistInput): boolean {
  return buildCampaignPublishChecklist(input).ready;
}

export function summarizeCampaignPublishChecklist(report: CampaignPublishChecklistReport): string {
  return report.summary;
}
