import type { CampaignSnapshot } from "./types/campaignSnapshot";

/**
 * Mock campaign publish flow for the demo admin dashboard.
 *
 * Simulates publishing a campaign snapshot into the demo dataset without any
 * network calls or production side effects. Everything here is pure and
 * deterministic: the same snapshot and options always produce the same result,
 * which keeps demo data stable and safe for public review.
 */

export type PublishStageId = "validate" | "stage-drafts" | "publish" | "finalize";

export type PublishStageStatus = "pending" | "running" | "complete";

export type MockPublishStatus = "published" | "in-progress" | "blocked";

export interface PublishStage {
  id: PublishStageId;
  label: string;
  description: string;
}

export interface PublishStageProgress {
  id: PublishStageId;
  label: string;
  status: PublishStageStatus;
  progress: number;
  detail: string;
}

export interface MockPublishOptions {
  /** Stop the simulated run after this stage to preview in-progress states. */
  stopAfter?: PublishStageId;
  /** Deterministic timestamp recorded when the publish completes. */
  publishedAt?: string;
}

export interface MockPublishResult {
  campaignId: string;
  publishId: string;
  publishedAt: string;
  status: MockPublishStatus;
  stages: PublishStageProgress[];
  publishedDraftCount: number;
  overallProgress: number;
  canRollback: boolean;
  blockers: string[];
}

export interface RollbackStep {
  id: PublishStageId;
  label: string;
  detail: string;
}

export interface RollbackPlan {
  campaignId: string;
  publishId: string;
  steps: RollbackStep[];
  restoresDraftCount: number;
  summary: string;
}

export const PUBLISH_STAGES: PublishStage[] = [
  {
    id: "validate",
    label: "Validate campaign",
    description: "Check campaign metadata and drafts before publishing.",
  },
  {
    id: "stage-drafts",
    label: "Stage drafts",
    description: "Copy campaign drafts into the demo staging area.",
  },
  {
    id: "publish",
    label: "Publish to demo dataset",
    description: "Write the staged campaign into the demo dataset.",
  },
  {
    id: "finalize",
    label: "Finalize",
    description: "Record the mock publish receipt and mark the campaign published.",
  },
];

function getCampaignDrafts(snapshot: CampaignSnapshot) {
  return snapshot.drafts ?? snapshot.data ?? [];
}

/** Returns the blockers that prevent a campaign from being published. */
export function collectPublishBlockers(snapshot: CampaignSnapshot): string[] {
  const blockers: string[] = [];
  if (snapshot.name.trim().length === 0) {
    blockers.push("Campaign name is required before publishing.");
  }
  if (snapshot.status === "archived") {
    blockers.push("Archived campaigns cannot be published.");
  }
  if (getCampaignDrafts(snapshot).length === 0) {
    blockers.push("Campaign has no drafts to publish.");
  }
  return blockers;
}

/** Returns the ordered stages used by the mock publish flow. */
export function planCampaignPublish(): PublishStage[] {
  return PUBLISH_STAGES.map((stage) => ({ ...stage }));
}

/**
 * Runs the deterministic mock publish flow for a campaign snapshot. No network
 * calls are made; the result is derived entirely from the snapshot and options.
 */
export function runMockCampaignPublish(
  snapshot: CampaignSnapshot,
  options: MockPublishOptions = {},
): MockPublishResult {
  const drafts = getCampaignDrafts(snapshot);
  const blockers = collectPublishBlockers(snapshot);
  const lastIndex = PUBLISH_STAGES.length - 1;
  const stopIndex =
    options.stopAfter === undefined
      ? lastIndex
      : PUBLISH_STAGES.findIndex((stage) => stage.id === options.stopAfter);

  const stages: PublishStageProgress[] = PUBLISH_STAGES.map((stage, index) => {
    if (blockers.length > 0) {
      return {
        id: stage.id,
        label: stage.label,
        status: "pending",
        progress: 0,
        detail: "Waiting: resolve blockers before publishing.",
      };
    }
    if (index <= stopIndex) {
      return {
        id: stage.id,
        label: stage.label,
        status: "complete",
        progress: 100,
        detail: describeCompletedStage(stage.id, drafts.length),
      };
    }
    if (index === stopIndex + 1) {
      return {
        id: stage.id,
        label: stage.label,
        status: "running",
        progress: 50,
        detail: "In progress.",
      };
    }
    return {
      id: stage.id,
      label: stage.label,
      status: "pending",
      progress: 0,
      detail: "Not started.",
    };
  });

  const overallProgress = Math.round(
    stages.reduce((total, stage) => total + stage.progress, 0) / stages.length,
  );
  const completedAll = blockers.length === 0 && stopIndex === lastIndex;
  const status: MockPublishStatus =
    blockers.length > 0 ? "blocked" : completedAll ? "published" : "in-progress";

  return {
    campaignId: snapshot.id,
    publishId: `publish-${snapshot.id}`,
    publishedAt: completedAll ? (options.publishedAt ?? snapshot.timestamp) : "",
    status,
    stages,
    publishedDraftCount: completedAll ? drafts.length : 0,
    overallProgress,
    canRollback: stages.some((stage) => stage.status === "complete"),
    blockers,
  };
}

/**
 * Builds a rollback plan that reverses every completed stage of a publish run.
 * The rollback hook is a pure description of the work; it performs no mutations.
 */
export function rollbackCampaignPublish(result: MockPublishResult): RollbackPlan {
  const steps: RollbackStep[] = result.stages
    .filter((stage) => stage.status === "complete")
    .reverse()
    .map((stage) => ({
      id: stage.id,
      label: `Roll back: ${stage.label}`,
      detail: describeRollbackStage(stage.id),
    }));

  return {
    campaignId: result.campaignId,
    publishId: result.publishId,
    steps,
    restoresDraftCount: result.publishedDraftCount,
    summary:
      steps.length === 0
        ? "Nothing to roll back; no stages completed."
        : `Roll back ${steps.length} completed stage${steps.length === 1 ? "" : "s"} for campaign ${result.campaignId}.`,
  };
}

/** Human-readable one-line summary of a publish run. */
export function summarizePublishResult(result: MockPublishResult): string {
  if (result.status === "blocked") {
    return `Publish blocked: ${result.blockers.join(" ")}`;
  }
  if (result.status === "in-progress") {
    return `Publishing campaign ${result.campaignId} (${result.overallProgress}% complete).`;
  }
  return `Published ${result.publishedDraftCount} draft${result.publishedDraftCount === 1 ? "" : "s"} for campaign ${result.campaignId}.`;
}

function describeCompletedStage(id: PublishStageId, draftCount: number): string {
  switch (id) {
    case "validate":
      return "Campaign metadata and drafts passed validation.";
    case "stage-drafts":
      return `Staged ${draftCount} draft${draftCount === 1 ? "" : "s"} for publishing.`;
    case "publish":
      return `Published ${draftCount} draft${draftCount === 1 ? "" : "s"} into the demo dataset.`;
    case "finalize":
      return "Recorded the mock publish receipt and marked the campaign published.";
    default:
      return "Stage complete.";
  }
}

function describeRollbackStage(id: PublishStageId): string {
  switch (id) {
    case "validate":
      return "Clear validation results for the campaign.";
    case "stage-drafts":
      return "Remove staged drafts from the demo staging area.";
    case "publish":
      return "Remove the published campaign from the demo dataset.";
    case "finalize":
      return "Delete the mock publish receipt and restore the previous status.";
    default:
      return "Reverse stage.";
  }
}
