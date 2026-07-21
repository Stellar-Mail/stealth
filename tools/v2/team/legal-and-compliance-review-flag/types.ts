/**
 * Domain types and compliance policy definitions for Legal & Compliance Review Flag tool.
 */

import type { ReviewFlagSeverity, ReviewStatus } from "./contract";

export type ComplianceCategory =
  | "gdpr_privacy"
  | "financial_sec_finra"
  | "hipaa_health"
  | "ip_copyright"
  | "fraud_phishing"
  | "aml_sanctions"
  | "other";

export interface ExtendedReviewFlagInput {
  reviewer: string;
  targetResource: string;
  flagReason: string;
  severity: ReviewFlagSeverity;
  category: ComplianceCategory;
  evidenceRefs?: readonly string[];
  assignedReviewerGroup?: string;
}

export interface DetailedAuditRecord {
  recordId: string;
  flagId: string;
  action: string;
  actor: string;
  timestamp: number;
  metadata?: Record<string, string>;
}

export interface CompliancePolicyRule {
  ruleId: string;
  category: ComplianceCategory;
  minimumSeverity: ReviewFlagSeverity;
  requiresEvidence: boolean;
  autoEscalate: boolean;
}

export interface FlagState {
  isSubmitting: boolean;
  error: string | null;
  successResult: {
    flagId: string;
    status: ReviewStatus;
    timestamp: number;
  } | null;
}
