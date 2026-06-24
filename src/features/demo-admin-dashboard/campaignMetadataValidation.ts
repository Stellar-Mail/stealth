import type { ValidationIssue } from "./validation-types";

export type CampaignStatus = "draft" | "ready-for-review" | "scheduled" | "published";

export type CampaignChannel = "email" | "in-app" | "push";

export interface CampaignMetadataInput {
  name: string;
  description: string;
  status: string;
  channel: string;
  owner: string;
  startDate: string;
  endDate: string;
  tags: string[];
}

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "draft",
  "ready-for-review",
  "scheduled",
  "published",
];

export const CAMPAIGN_CHANNELS: CampaignChannel[] = ["email", "in-app", "push"];

const NAME_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 280;
const MAX_TAGS = 10;
const SAFE_OWNER_PATTERN = /(@example\.(com|org)|@([\w.-]+)?\.stealth\.demo)$/i;

const DATASET_ID = "campaign-metadata";

export function validateCampaignMetadata(input: CampaignMetadataInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  validateName(input.name, issues);
  validateDescription(input.description, issues);
  validateStatus(input.status, issues);
  validateChannel(input.channel, issues);
  validateOwner(input.owner, issues);
  validateDateWindow(input.startDate, input.endDate, issues);
  validateTags(input.tags, issues);

  return issues;
}

export function hasBlockingCampaignMetadataIssues(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

function validateName(name: string, issues: ValidationIssue[]): void {
  const trimmed = name.trim();
  if (!trimmed) {
    issues.push({
      id: "campaign-name-empty",
      severity: "error",
      fieldPath: "name",
      message: "Campaign name is required.",
      datasetId: DATASET_ID,
      hint: "Enter a short, descriptive campaign name.",
    });
    return;
  }
  if (trimmed.length > NAME_MAX_LENGTH) {
    issues.push({
      id: "campaign-name-too-long",
      severity: "error",
      fieldPath: "name",
      message: `Campaign name must be ${NAME_MAX_LENGTH} characters or fewer.`,
      datasetId: DATASET_ID,
      hint: "Shorten the campaign name.",
    });
  }
}

function validateDescription(description: string, issues: ValidationIssue[]): void {
  const trimmed = description.trim();
  if (!trimmed) {
    issues.push({
      id: "campaign-description-empty",
      severity: "warning",
      fieldPath: "description",
      message: "Campaign description is empty.",
      datasetId: DATASET_ID,
      hint: "Add a short description so reviewers understand the campaign.",
    });
    return;
  }
  if (trimmed.length > DESCRIPTION_MAX_LENGTH) {
    issues.push({
      id: "campaign-description-too-long",
      severity: "error",
      fieldPath: "description",
      message: `Campaign description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`,
      datasetId: DATASET_ID,
      hint: "Trim the description to keep it concise.",
    });
  }
}

function validateStatus(status: string, issues: ValidationIssue[]): void {
  const trimmed = status.trim();
  if (!trimmed) {
    issues.push({
      id: "campaign-status-empty",
      severity: "error",
      fieldPath: "status",
      message: "Campaign status is required.",
      datasetId: DATASET_ID,
      hint: `Choose one of: ${CAMPAIGN_STATUSES.join(", ")}.`,
    });
    return;
  }
  if (!CAMPAIGN_STATUSES.includes(trimmed as CampaignStatus)) {
    issues.push({
      id: "campaign-status-invalid",
      severity: "error",
      fieldPath: "status",
      message: `Status "${status}" is not a recognized campaign status.`,
      datasetId: DATASET_ID,
      hint: `Choose one of: ${CAMPAIGN_STATUSES.join(", ")}.`,
    });
  }
}

function validateChannel(channel: string, issues: ValidationIssue[]): void {
  const trimmed = channel.trim();
  if (!trimmed) {
    issues.push({
      id: "campaign-channel-empty",
      severity: "error",
      fieldPath: "channel",
      message: "Campaign channel is required.",
      datasetId: DATASET_ID,
      hint: `Choose one of: ${CAMPAIGN_CHANNELS.join(", ")}.`,
    });
    return;
  }
  if (!CAMPAIGN_CHANNELS.includes(trimmed as CampaignChannel)) {
    issues.push({
      id: "campaign-channel-invalid",
      severity: "error",
      fieldPath: "channel",
      message: `Channel "${channel}" is not a recognized campaign channel.`,
      datasetId: DATASET_ID,
      hint: `Choose one of: ${CAMPAIGN_CHANNELS.join(", ")}.`,
    });
  }
}

function validateOwner(owner: string, issues: ValidationIssue[]): void {
  const trimmed = owner.trim();
  if (!trimmed) {
    issues.push({
      id: "campaign-owner-empty",
      severity: "error",
      fieldPath: "owner",
      message: "Campaign owner is required.",
      datasetId: DATASET_ID,
      hint: "Set an owner email such as owner@example.com.",
    });
    return;
  }
  if (!trimmed.includes("@")) {
    issues.push({
      id: "campaign-owner-invalid",
      severity: "error",
      fieldPath: "owner",
      message: `Owner "${owner}" is not a valid email address.`,
      datasetId: DATASET_ID,
      hint: "Use a format like owner@example.com.",
    });
    return;
  }
  if (!SAFE_OWNER_PATTERN.test(trimmed)) {
    issues.push({
      id: "campaign-owner-unsafe-domain",
      severity: "warning",
      fieldPath: "owner",
      message: `Owner "${owner}" uses an external or unverified domain for demo data.`,
      datasetId: DATASET_ID,
      hint: "Stick to example.com, example.org, or *.stealth.demo.",
    });
  }
}

function validateDateWindow(startDate: string, endDate: string, issues: ValidationIssue[]): void {
  const start = startDate.trim();
  const end = endDate.trim();

  if (!start) {
    issues.push({
      id: "campaign-start-date-empty",
      severity: "error",
      fieldPath: "startDate",
      message: "Campaign start date is required.",
      datasetId: DATASET_ID,
      hint: "Pick a start date.",
    });
  }

  if (!end) {
    issues.push({
      id: "campaign-end-date-empty",
      severity: "error",
      fieldPath: "endDate",
      message: "Campaign end date is required.",
      datasetId: DATASET_ID,
      hint: "Pick an end date.",
    });
  }

  if (!start || !end) {
    return;
  }

  const startValue = new Date(start);
  const endValue = new Date(end);

  if (isNaN(startValue.getTime())) {
    issues.push({
      id: "campaign-start-date-invalid",
      severity: "error",
      fieldPath: "startDate",
      message: "Start date is not a valid date.",
      datasetId: DATASET_ID,
      hint: "Enter a date in yyyy-MM-dd format.",
    });
  }

  if (isNaN(endValue.getTime())) {
    issues.push({
      id: "campaign-end-date-invalid",
      severity: "error",
      fieldPath: "endDate",
      message: "End date is not a valid date.",
      datasetId: DATASET_ID,
      hint: "Enter a date in yyyy-MM-dd format.",
    });
  }

  if (!isNaN(startValue.getTime()) && !isNaN(endValue.getTime()) && endValue <= startValue) {
    issues.push({
      id: "campaign-end-before-start",
      severity: "error",
      fieldPath: "endDate",
      message: "End date must be after the start date.",
      datasetId: DATASET_ID,
      hint: "Choose an end date that is later than the start date.",
    });
  }
}

function validateTags(tags: string[], issues: ValidationIssue[]): void {
  if (tags.length > MAX_TAGS) {
    issues.push({
      id: "campaign-tags-too-many",
      severity: "error",
      fieldPath: "tags",
      message: `A campaign can have at most ${MAX_TAGS} tags.`,
      datasetId: DATASET_ID,
      hint: "Remove some tags.",
    });
  }

  const seen = new Set<string>();
  tags.forEach((tag, index) => {
    const trimmed = tag.trim();
    if (!trimmed) {
      issues.push({
        id: `campaign-tag-${index}-empty`,
        severity: "error",
        fieldPath: `tags[${index}]`,
        message: "Tags cannot be empty.",
        datasetId: DATASET_ID,
        hint: "Remove the empty tag or give it a value.",
      });
      return;
    }
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) {
      issues.push({
        id: `campaign-tag-${index}-duplicate`,
        severity: "warning",
        fieldPath: `tags[${index}]`,
        message: `Tag "${tag}" is a duplicate.`,
        datasetId: DATASET_ID,
        hint: "Remove duplicate tags.",
      });
      return;
    }
    seen.add(normalized);
  });
}
