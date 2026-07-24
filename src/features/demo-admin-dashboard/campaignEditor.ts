import type { CampaignSnapshot } from "./types/campaignSnapshot";
import type { Draft } from "./types/draft";
import { deterministicSnapshotId, normalizeLabels } from "./utils/normalizeDemoData";

export type CampaignEditorStatus = NonNullable<CampaignSnapshot["status"]>;

export interface CampaignEditorState {
  id?: string;
  name: string;
  description: string;
  targetAudience: string;
  tagsInput: string;
  status: CampaignEditorStatus;
  drafts: Draft[];
}

export interface CampaignEditorValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  previewAvailable: boolean;
}

export interface CampaignEditorEmptyState {
  title: string;
  description: string;
  actionLabel: string;
}

export const emptyCampaignEditorState: CampaignEditorState = {
  name: "",
  description: "",
  targetAudience: "",
  tagsInput: "",
  status: "draft",
  drafts: [],
};

export function campaignToEditorState(campaign: CampaignSnapshot): CampaignEditorState {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    targetAudience: campaign.targetAudience,
    tagsInput: campaign.tags.join(", "),
    status: campaign.status ?? "draft",
    drafts: campaign.drafts,
  };
}

export function validateCampaignEditorState(
  state: CampaignEditorState,
): CampaignEditorValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tags = normalizeCampaignEditorTags(state.tagsInput);

  if (!state.name.trim()) {
    errors.push("Campaign name is required.");
  }
  if (!state.description.trim()) {
    errors.push("Description is required.");
  }
  if (!state.targetAudience.trim()) {
    errors.push("Target audience is required.");
  }
  if (state.drafts.length === 0) {
    warnings.push("No demo drafts are attached yet.");
  }
  if (tags.length === 0) {
    warnings.push("Add at least one campaign tag for easier filtering.");
  }
  if (state.status === "archived") {
    warnings.push("Archived campaigns are visible for review but should not be the default save.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    previewAvailable: errors.length === 0 || hasAnyCampaignEditorContent(state),
  };
}

export function campaignEditorStateToSnapshot(
  state: CampaignEditorState,
  existingIds: Set<string>,
  now: string,
): CampaignSnapshot {
  const name = state.name.trim();
  return {
    id: state.id ?? deterministicSnapshotId("snap", name, existingIds),
    name,
    description: state.description.trim(),
    targetAudience: state.targetAudience.trim(),
    tags: normalizeCampaignEditorTags(state.tagsInput),
    timestamp: now,
    status: state.status,
    drafts: state.drafts.map((draft) => ({ ...draft, recipients: [...draft.recipients] })),
  };
}

export function hasAnyCampaignEditorContent(state: CampaignEditorState): boolean {
  return Boolean(
    state.name.trim() ||
    state.description.trim() ||
    state.targetAudience.trim() ||
    state.tagsInput.trim() ||
    state.drafts.length > 0,
  );
}

export function getCampaignEditorEmptyState(
  state: CampaignEditorState,
): CampaignEditorEmptyState | null {
  if (!hasAnyCampaignEditorContent(state)) {
    return {
      title: "Start a campaign draft",
      description:
        "Add campaign metadata, tags, and fake demo drafts before saving a reviewable snapshot.",
      actionLabel: "Fill campaign metadata",
    };
  }

  if (state.drafts.length === 0) {
    return {
      title: "No demo drafts attached",
      description:
        "This editor shell can save metadata now and attach deterministic demo drafts later.",
      actionLabel: "Add demo drafts later",
    };
  }

  return null;
}

export function normalizeCampaignEditorTags(tagsInput: string): string[] {
  return Array.from(new Set(normalizeLabels(tagsInput.split(","))));
}
