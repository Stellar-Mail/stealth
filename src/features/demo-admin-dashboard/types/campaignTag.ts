export type TagColorKey =
  | "onboarding"
  | "welcome"
  | "stellar"
  | "security"
  | "alert"
  | "newsletter"
  | "marketing"
  | "announcement"
  | "default";

export interface CampaignTag {
  id: string;
  name: string;
  color: TagColorKey;
}
