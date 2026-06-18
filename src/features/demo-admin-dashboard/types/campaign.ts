export interface CampaignChecklistItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
  completed: boolean;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  checklist: CampaignChecklistItem[];
}
