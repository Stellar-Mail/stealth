import { CampaignSnapshot } from "./campaignSnapshot";

export interface AssignableMessage {
  id: string;
  subject: string;
  preview: string;
  body: string;
  recipients: string[];
  tags: string[];
  folderHint: string;
}

export interface AssignmentState {
  campaigns: CampaignSnapshot[];
  pool: AssignableMessage[];
}
