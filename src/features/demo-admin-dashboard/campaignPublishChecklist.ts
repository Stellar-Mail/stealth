import type { CampaignSnapshot } from "./types/campaignSnapshot";

export type CampaignPublishChecklistSeverity = "blocker" | "warning" | "ready";

export interface CampaignPublishChecklistItem {
  id: string;
  label: string;
  description: string;
  severity: CampaignPublishChecklistSeverity;
  passed: boolean;
}

export interface CampaignPublishChecklistResult {
  campaignId: string;
  campaignName: string;
  items: CampaignPublishChecklistItem[];
  blockerCount: number;
  warningCount: number;
  readyCount: number;
  canPublish: boolean;
}

const SAFE_RECIPIENT_PATTERN = /(@example\.(com|org)$)|(@stealth\.demo$)/i;

export function buildCampaignPublishChecklist(
  campaign: CampaignSnapshot,
): CampaignPublishChecklistResult {
  const items: CampaignPublishChecklistItem[] = [
    {
      id: "identity",
      label: "Campaign identity",
      description: "Name, description, and target audience are ready for review.",
      severity: "blocker",
      passed:
        campaign.name.trim().length > 0 &&
        campaign.description.trim().length > 0 &&
        campaign.targetAudience.trim().length > 0,
    },
    {
      id: "drafts",
      label: "Draft inventory",
      description: "At least one draft message exists before mock publishing.",
      severity: "blocker",
      passed: campaign.drafts.length > 0,
    },
    {
      id: "draft-content",
      label: "Draft content",
      description: "Every draft has a subject and body.",
      severity: "blocker",
      passed: campaign.drafts.every(
        (draft) => draft.subject.trim().length > 0 && draft.body.trim().length > 0,
      ),
    },
    {
      id: "safe-recipients",
      label: "Safe demo recipients",
      description: "Recipients use example.com, example.org, or stealth.demo addresses only.",
      severity: "blocker",
      passed: campaign.drafts.every(
        (draft) =>
          draft.recipients.length > 0 &&
          draft.recipients.every((recipient) => SAFE_RECIPIENT_PATTERN.test(recipient)),
      ),
    },
    {
      id: "tags",
      label: "Campaign tags",
      description: "Campaign has at least one local tag for filtering and review.",
      severity: "warning",
      passed: campaign.tags.length > 0,
    },
    {
      id: "status",
      label: "Review status",
      description: "Campaign is not archived before mock publish.",
      severity: "warning",
      passed: campaign.status !== "archived",
    },
  ];

  const blockerCount = items.filter((item) => item.severity === "blocker" && !item.passed).length;
  const warningCount = items.filter((item) => item.severity === "warning" && !item.passed).length;
  const readyCount = items.filter((item) => item.passed).length;

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    items,
    blockerCount,
    warningCount,
    readyCount,
    canPublish: blockerCount === 0,
  };
}

export function summarizeCampaignPublishChecklist(result: CampaignPublishChecklistResult): string {
  if (!result.canPublish) {
    const blockerWord = result.blockerCount === 1 ? "blocker" : "blockers";
    return `${result.campaignName} has ${result.blockerCount} publish ${blockerWord}.`;
  }

  if (result.warningCount > 0) {
    const warningWord = result.warningCount === 1 ? "warning" : "warnings";
    return `${result.campaignName} is publishable with ${result.warningCount} ${warningWord}.`;
  }

  return `${result.campaignName} is ready for mock publish.`;
}

export function getCampaignPublishBlockers(
  result: CampaignPublishChecklistResult,
): CampaignPublishChecklistItem[] {
  return result.items.filter((item) => item.severity === "blocker" && !item.passed);
}

export function getCampaignPublishWarnings(
  result: CampaignPublishChecklistResult,
): CampaignPublishChecklistItem[] {
  return result.items.filter((item) => item.severity === "warning" && !item.passed);
}
