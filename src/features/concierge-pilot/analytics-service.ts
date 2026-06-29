/**
 * Concierge Pilot Analytics Service
 * 
 * Measures pilot effectiveness using privacy-safe analytics.
 * - Never stores message bodies, subjects, or sender email addresses
 * - Hashes sender identifiers for privacy
 * - Tracks policy decisions, overrides, and false positives
 * - Ensures compliance with privacy budget constraints
 */

import { PrivacyAnalytics } from "@/services/analytics";
import type {
  PolicyDecisionMeasurement,
  FalsePositiveReport,
  ManualOverrideRecord,
  PilotMetrics,
  PilotPolicyCategory,
} from "./types";

export class PilotAnalyticsService {
  private analytics: PrivacyAnalytics;
  private measurements: PolicyDecisionMeasurement[] = [];
  private falsePositives: FalsePositiveReport[] = [];
  private overrides: ManualOverrideRecord[] = [];

  constructor(privacyAnalytics: PrivacyAnalytics) {
    this.analytics = privacyAnalytics;
  }

  /**
   * Hash a sender identifier for privacy-safe tracking.
   * This ensures we never store plaintext email addresses.
   */
  private hashSenderIdentifier(identifier: string): string {
    // In production, use a cryptographic hash (e.g., SHA-256)
    // For now, use a simple obfuscation that's deterministic
    const encoder = new TextEncoder();
    const data = encoder.encode(identifier);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data[i];
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Record a policy decision when a message is processed.
   * Tracks which policy category was applied and whether delivery occurred.
   */
  recordPolicyDecision(
    userId: string,
    senderIdentifier: string,
    appliedCategory: PilotPolicyCategory,
    messageDelivered: boolean,
  ): PolicyDecisionMeasurement {
    const measurement: PolicyDecisionMeasurement = {
      id: crypto.randomUUID(),
      userId,
      timestamp: Date.now(),
      senderIdentifierHash: this.hashSenderIdentifier(senderIdentifier),
      appliedCategory,
      messageDelivered,
    };

    this.measurements.push(measurement);

    // Track in privacy analytics
    this.analytics.track({
      category: "policy",
      purpose: "reliability_monitoring",
      privacyBudget: 0.1,
      retentionDays: 14, // Two-week pilot
      payload: {
        user_id_hash: this.hashSenderIdentifier(userId),
        policy_category: appliedCategory,
        delivered: messageDelivered,
      },
    });

    return measurement;
  }

  /**
   * Record when user manually overrides a policy decision.
   * High override rates indicate need for policy tuning.
   */
  recordManualOverride(
    userId: string,
    originalCategory: PilotPolicyCategory,
    overrideCategory: PilotPolicyCategory,
    reason?: string,
  ): ManualOverrideRecord {
    const record: ManualOverrideRecord = {
      id: crypto.randomUUID(),
      userId,
      timestamp: Date.now(),
      originalCategory,
      overrideCategory,
      reason,
    };

    this.overrides.push(record);

    // Track in privacy analytics
    this.analytics.track({
      category: "policy",
      purpose: "reliability_monitoring",
      privacyBudget: 0.15,
      retentionDays: 14,
      payload: {
        user_id_hash: this.hashSenderIdentifier(userId),
        override_from: originalCategory,
        override_to: overrideCategory,
        has_reason: !!reason,
      },
    });

    return record;
  }

  /**
   * Report a false positive (policy incorrectly blocked a wanted sender).
   * Used to identify policy tuning opportunities.
   */
  reportFalsePositive(
    userId: string,
    measurementId: string,
    senderIdentifier: string,
    originalCategory: PilotPolicyCategory,
    reason: string,
  ): FalsePositiveReport {
    const report: FalsePositiveReport = {
      id: crypto.randomUUID(),
      userId,
      measurementId,
      senderIdentifierHash: this.hashSenderIdentifier(senderIdentifier),
      originalCategory,
      reportedAt: Date.now(),
      reason,
    };

    this.falsePositives.push(report);

    // Track in privacy analytics
    this.analytics.track({
      category: "policy",
      purpose: "reliability_monitoring",
      privacyBudget: 0.2,
      retentionDays: 14,
      payload: {
        user_id_hash: this.hashSenderIdentifier(userId),
        false_positive_reason: reason,
        original_category: originalCategory,
      },
    });

    return report;
  }

  /**
   * Calculate metrics for a pilot user based on observed behavior.
   */
  calculateUserMetrics(
    userId: string,
    enrollmentStartMs: number,
    restrictivePolicyEnabledMs?: number,
  ): PilotMetrics {
    const userMeasurements = this.measurements.filter((m) => m.userId === userId);
    const userOverrides = this.overrides.filter((o) => o.userId === userId);
    const userFalsePositives = this.falsePositives.filter(
      (fp) => fp.userId === userId,
    );

    const now = Date.now();
    const enrollmentDuration = Math.floor(
      (now - enrollmentStartMs) / (24 * 60 * 60 * 1000),
    );

    // Calculate triage effort reduction as inverse of override rate
    // High overrides = low effort reduction
    const triageEffortReduction = userMeasurements.length > 0
      ? Math.max(
          0,
          100 - (userOverrides.length / userMeasurements.length) * 100,
        )
      : 0;

    const restrictivePolicyRetention = restrictivePolicyEnabledMs
      ? Math.min(
          100,
          ((now - restrictivePolicyEnabledMs) /
            (now - enrollmentStartMs)) *
            100,
        )
      : 0;

    const successSignalMet =
      restrictivePolicyRetention >= 70 && triageEffortReduction >= 20;

    return {
      userId,
      enrollmentDuration,
      restrictivePolicyAdopted: !!restrictivePolicyEnabledMs,
      restrictivePolicyRetention,
      policyDecisionCount: userMeasurements.length,
      manualOverrideCount: userOverrides.length,
      falsePositiveCount: userFalsePositives.length,
      triageEffortReduction,
      successSignalMet,
    };
  }

  /**
   * Get all recorded measurements.
   */
  getMeasurements(): PolicyDecisionMeasurement[] {
    return [...this.measurements];
  }

  /**
   * Get all reported false positives.
   */
  getFalsePositives(): FalsePositiveReport[] {
    return [...this.falsePositives];
  }

  /**
   * Get all recorded overrides.
   */
  getOverrides(): ManualOverrideRecord[] {
    return [...this.overrides];
  }

  /**
   * Clear all recorded data (useful for testing).
   */
  clearData(): void {
    this.measurements = [];
    this.falsePositives = [];
    this.overrides = [];
  }
}

export const pilotAnalytics = new PilotAnalyticsService(
  // Use global analytics instance
  // In production, this would be passed from the app initialization
  new (require("@/services/analytics").PrivacyAnalytics)({
    enabled: true,
    maxPrivacyBudget: 20.0, // Higher budget for pilot tracking
  }),
);
