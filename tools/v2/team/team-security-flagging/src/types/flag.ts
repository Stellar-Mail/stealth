export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORIES = [
  "phishing",
  "malware",
  "data-exposure",
  "policy-violation",
  "social-engineering",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["open", "investigating", "escalated", "resolved"] as const;
export type Status = (typeof STATUSES)[number];

export type ISOString = string;

export type ReviewNote = {
  authorId: string;
  authorName: string;
  createdAt: ISOString;
  note: string;
};

export type FlagRecord = {
  id: string;
  sourceMessageId: string;
  sourceThreadId: string | null;
  reporterId: string;
  reporterName: string;
  createdAt: ISOString;
  severity: Severity;
  category: Category;
  description: string;
  status: Status;
  assignedTeam: string | null;
  triageRequired: boolean;
  reviewNotes: ReviewNote[];
  resolvedAt: ISOString | null;
};

export type FlagFilters = {
  status?: Status;
  severity?: Severity;
  category?: Category;
  assignedTeam?: string;
  triageRequired?: boolean;
};

export type CreateFlagPayload = {
  id: string;
  sourceMessageId: string;
  sourceThreadId?: string | null;
  reporterId: string;
  reporterName: string;
  createdAt: ISOString;
  severity: Severity;
  category: Category;
  description: string;
  status?: Status;
  assignedTeam?: string | null;
};

export type UpdateFlagPayload = Partial<{
  severity: Severity;
  category: Category;
  description: string;
  status: Status;
  assignedTeam: string | null;
  triageRequired: boolean;
}>;

export type ReviewNotePayload = {
  authorId: string;
  authorName: string;
  createdAt: ISOString;
  note: string;
};

export type ResolveFlagPayload = {
  resolvedAt: ISOString;
  resolutionNote: ReviewNotePayload;
};

