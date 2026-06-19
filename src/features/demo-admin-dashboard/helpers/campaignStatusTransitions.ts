import type {
  CampaignStatus,
  CampaignStatusTransition,
} from "../types/campaignStatus";
import { TERMINAL_STATUSES, INITIAL_CAMPAIGN_STATUS } from "../types/campaignStatus";

const TRANSITION_MAP: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["ready", "archived"],
  ready: ["active", "draft", "archived"],
  active: ["paused", "archived", "failed"],
  paused: ["active", "archived", "failed"],
  archived: [],
  failed: ["draft", "archived"],
};

const TRANSITION_METADATA: Record<string, CampaignStatusTransition> = {
  "draft→ready": {
    from: "draft",
    to: "ready",
    label: "Mark Ready",
    description: "Campaign is complete and ready for review.",
  },
  "draft→archived": {
    from: "draft",
    to: "archived",
    label: "Archive Draft",
    description: "Discard the draft campaign.",
  },
  "ready→active": {
    from: "ready",
    to: "active",
    label: "Launch",
    description: "Start the campaign and begin sending.",
  },
  "ready→draft": {
    from: "ready",
    to: "draft",
    label: "Send Back to Draft",
    description: "Return campaign for further edits.",
  },
  "ready→archived": {
    from: "ready",
    to: "archived",
    label: "Cancel",
    description: "Cancel the campaign before launch.",
  },
  "active→paused": {
    from: "active",
    to: "paused",
    label: "Pause",
    description: "Temporarily stop the campaign.",
  },
  "active→archived": {
    from: "active",
    to: "archived",
    label: "End Campaign",
    description: "Finish the campaign successfully.",
  },
  "active→failed": {
    from: "active",
    to: "failed",
    label: "Mark Failed",
    description: "Campaign encountered an error.",
  },
  "paused→active": {
    from: "paused",
    to: "active",
    label: "Resume",
    description: "Resume the paused campaign.",
  },
  "paused→archived": {
    from: "paused",
    to: "archived",
    label: "End Campaign",
    description: "End the campaign while paused.",
  },
  "paused→failed": {
    from: "paused",
    to: "failed",
    label: "Mark Failed",
    description: "Fail the campaign while paused.",
  },
  "failed→draft": {
    from: "failed",
    to: "draft",
    label: "Retry",
    description: "Reset failed campaign for revision.",
  },
  "failed→archived": {
    from: "failed",
    to: "archived",
    label: "Archive Failed",
    description: "Archive a failed campaign.",
  },
};

export function getAllowedTransitions(
  status: CampaignStatus,
): CampaignStatusTransition[] {
  const next = TRANSITION_MAP[status];
  if (!next || next.length === 0) return [];
  return next.map((to) => {
    const key = `${status}→${to}`;
    return (
      TRANSITION_METADATA[key] ?? {
        from: status,
        to,
        label: `Move to ${to}`,
        description: `Transition from ${status} to ${to}.`,
      }
    );
  });
}

export function canTransitionTo(
  from: CampaignStatus,
  to: CampaignStatus,
): boolean {
  const allowed = TRANSITION_MAP[from];
  return allowed ? allowed.includes(to) : false;
}

export function validateCampaignStatusTransition(
  from: CampaignStatus,
  to: CampaignStatus,
): { valid: boolean; reason?: string } {
  if (from === to) {
    return { valid: false, reason: "Status is already set to " + to };
  }
  if (TERMINAL_STATUSES.includes(from)) {
    return {
      valid: false,
      reason: `Cannot transition from terminal status "${from}".`,
    };
  }
  if (canTransitionTo(from, to)) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: `Transition from "${from}" to "${to}" is not allowed.`,
  };
}

export function isTerminal(status: CampaignStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isInitial(status: CampaignStatus): boolean {
  return status === INITIAL_CAMPAIGN_STATUS;
}
