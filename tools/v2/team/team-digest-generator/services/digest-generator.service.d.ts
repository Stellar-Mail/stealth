export interface ActivityItem {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  signals?: string[];
}

export interface ActivityDigestItem {
  id: string;
  type: string;
  title: string;
  sourceEmailId: string;
  teamMember: string;
  priority: string;
  timestamp: string;
  requiresAttention: boolean;
}

export interface ActivityDigestSummary {
  totalItems: number;
  requiresAttention: number;
  teamMembers: string[];
}

export interface GeneratedActivityDigest {
  date: string;
  generatedAt: string;
  team: string;
  items: ActivityDigestItem[];
  summary: ActivityDigestSummary;
}

export function generateDigest(
  activity: ActivityItem[],
  date: string,
  generatedAt?: string,
): GeneratedActivityDigest;
