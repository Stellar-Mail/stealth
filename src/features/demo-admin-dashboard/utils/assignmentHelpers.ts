import { CampaignSnapshot } from "../types/campaignSnapshot";
import { AssignableMessage } from "../types/assignment";
import { Draft } from "../types/draft";

function messageToDraft(msg: AssignableMessage): Draft {
  return { id: msg.id, subject: msg.subject, body: msg.body, recipients: msg.recipients };
}

export function isMessageAssigned(campaign: CampaignSnapshot, messageId: string): boolean {
  return campaign.drafts.some((d) => d.id === messageId);
}

export function getAssignedMessages(
  campaign: CampaignSnapshot,
  pool: AssignableMessage[],
): AssignableMessage[] {
  return campaign.drafts
    .map((d) => pool.find((m) => m.id === d.id))
    .filter((m): m is AssignableMessage => m !== undefined);
}

export function assignMessage(
  campaign: CampaignSnapshot,
  msg: AssignableMessage,
): CampaignSnapshot {
  if (isMessageAssigned(campaign, msg.id)) return campaign;
  return { ...campaign, drafts: [...campaign.drafts, messageToDraft(msg)] };
}

export function unassignMessage(campaign: CampaignSnapshot, messageId: string): CampaignSnapshot {
  return { ...campaign, drafts: campaign.drafts.filter((d) => d.id !== messageId) };
}

export function getCampaignsForMessage(
  campaigns: CampaignSnapshot[],
  messageId: string,
): CampaignSnapshot[] {
  return campaigns.filter((c) => isMessageAssigned(c, messageId));
}

export function assignToManyCampaigns(
  campaigns: CampaignSnapshot[],
  msg: AssignableMessage,
  campaignIds: string[],
): CampaignSnapshot[] {
  return campaigns.map((c) => (campaignIds.includes(c.id) ? assignMessage(c, msg) : c));
}
