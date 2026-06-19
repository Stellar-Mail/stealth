import type { CampaignTag } from "../types/campaignTag";
import { normalizeCampaignTags } from "../utils/tagNormalization";

export const defaultCampaignTags: CampaignTag[] = normalizeCampaignTags([
  { id: "tag-onboarding", name: "onboarding", color: "onboarding" },
  { id: "tag-welcome", name: "welcome", color: "welcome" },
  { id: "tag-stellar", name: "stellar", color: "stellar" },
  { id: "tag-security", name: "security", color: "security" },
  { id: "tag-alert", name: "alert", color: "alert" },
  { id: "tag-newsletter", name: "newsletter", color: "newsletter" },
  { id: "tag-marketing", name: "marketing", color: "marketing" },
  { id: "tag-announcement", name: "announcement", color: "announcement" },
]);
