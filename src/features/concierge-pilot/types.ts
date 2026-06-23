/**
 * Concierge Pilot Feature Types
 * 
 * This module defines types for the two-week pilot program that measures
 * the effectiveness of inbox access policy controls with 8-12 users.
 * 
 * Policy categories:
 * - allow: Trusted senders reach the inbox immediately
 * - request: Unknown senders trigger a review request
 * - block: Senders are blocked with no notification
 * - paid-access: Senders must attach postage to reach the inbox
 */

export type PilotPolicyCategory = "allow" | "request" | "block" | "paid-access";

export type PilotPhase = "enrollment" | "active" | "analysis" | "complete";

export interface PilotUser {
  id: string;
  enrolledAt: number; // Unix timestamp
  consentGiven: boolean;
  consentGivenAt?: number;
  phase: PilotPhase;
}

export interface PolicyRule {
  id: string;
  senderIdentifier: string; // Stealth address or pattern (never plaintext email)
  category: PilotPolicyCategory;
  createdAt: number;
  lastModifiedAt: number;
}

export interface PolicyConfiguration {
  userId: string;
  rules: PolicyRule[];
  defaultCategory: PilotPolicyCategory;
  restrictivePolicyEnabled: boolean;
  enabledAt?: number;
}

/**
 * Policy decision measurement captures decisions made without storing message bodies.
 * Measurements track patterns to identify false positives and user overrides.
 */
export interface PolicyDecisionMeasurement {
  id: string;
  userId: string;
  timestamp: number;
  senderIdentifierHash: string; // Hash of sender identifier (privacy-safe)
  appliedCategory: PilotPolicyCategory;
  messageDelivered: boolean;
  manualOverride?: {
    from: PilotPolicyCategory;
    to: PilotPolicyCategory;
    reason?: string; // "false_positive" | "spam" | "other"
  };
}

/**
 * False positive tracking identifies policy decisions that caused user friction.
 */
export interface FalsePositiveReport {
  id: string;
  userId: string;
  measurementId: string;
  senderIdentifierHash: string;
  originalCategory: PilotPolicyCategory;
  reportedAt: number;
  reason: string; // "trusted_sender_blocked" | "important_request_missed" | "other"
  resolutionAction?: PilotPolicyCategory; // How user corrected it
}

/**
 * Manual override tracking captures when users override automatic decisions.
 * High override rates indicate policy tuning needs.
 */
export interface ManualOverrideRecord {
  id: string;
  userId: string;
  timestamp: number;
  originalCategory: PilotPolicyCategory;
  overrideCategory: PilotPolicyCategory;
  reason?: string;
}

/**
 * Pilot metrics aggregated from observed behavior.
 * Used to measure success signals and identify requirements updates.
 */
export interface PilotMetrics {
  userId: string;
  enrollmentDuration: number; // Days in pilot
  restrictivePolicyAdopted: boolean;
  restrictivePolicyRetention: number; // Percentage of time enabled
  policyDecisionCount: number;
  manualOverrideCount: number;
  falsePositiveCount: number;
  triageEffortReduction: number; // Percentage reduction in manual triage
  successSignalMet: boolean; // 70% retention + lower triage effort
}

/**
 * Pilot cohort summary for analysis.
 */
export interface PilotCohortAnalysis {
  cohortSize: number;
  enrollmentStartDate: number;
  enrollmentEndDate: number;
  restrictivePolicyAdoptionRate: number; // Percentage of users with restrictive policy
  retentionRate: number; // Percentage keeping policy enabled
  avgTriageEffortReduction: number;
  successSignalAchieved: boolean;
  requirementsUpdates: string[];
}
