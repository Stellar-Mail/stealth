export type SecurityFlagSeverity = "critical" | "high" | "medium" | "low";

export type SecurityFlagCategory =
  | "phishing"
  | "credential-theft"
  | "malware"
  | "data-breach"
  | "suspicious-sender"
  | "unauthorized-access"
  | "social-engineering"
  | "other";

export type SecurityFlagStatus = "new" | "under-review" | "escalated" | "resolved" | "dismissed";

export type SecurityFlag = {
  id: string;
  emailId: string;
  threadId: string;
  reportedBy: string;
  assignedTo?: string;
  severity: SecurityFlagSeverity;
  category: SecurityFlagCategory;
  status: SecurityFlagStatus;
  subject: string;
  senderEmail: string;
  description: string;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolution?: string;
};

/** Minimal email signal used for auto-classification. */
export type EmailSecuritySignal = {
  emailId: string;
  threadId: string;
  subject: string;
  senderEmail: string;
  senderName?: string;
  snippet: string;
  bodyPreview: string;
  hasAttachments: boolean;
  links: string[];
};

export type CreateFlagInput = {
  emailId: string;
  threadId: string;
  reportedBy: string;
  severity: SecurityFlagSeverity;
  category: SecurityFlagCategory;
  subject: string;
  senderEmail: string;
  description: string;
  evidence?: string[];
};

export type UpdateFlagInput = {
  assignedTo?: string;
  severity?: SecurityFlagSeverity;
  status?: SecurityFlagStatus;
  description?: string;
  resolution?: string;
};

export type ClassificationResult = {
  severity: SecurityFlagSeverity;
  category: SecurityFlagCategory;
  confidence: "high" | "medium" | "low";
  matchedSignals: string[];
};

export type ServiceLimits = {
  MAX_DESCRIPTION_LENGTH: number;
  MAX_EVIDENCE_ITEMS: number;
  MAX_EVIDENCE_LENGTH: number;
  MAX_EMAIL_LENGTH: number;
  MAX_THREAD_ID_LENGTH: number;
  MAX_EMAIL_ID_LENGTH: number;
  ALLOWED_SEVERITIES: readonly SecurityFlagSeverity[];
  ALLOWED_CATEGORIES: readonly SecurityFlagCategory[];
  ALLOWED_STATUSES: readonly SecurityFlagStatus[];
};
