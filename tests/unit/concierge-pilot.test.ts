/**
 * Unit tests for Concierge Pilot Feature
 * Tests analytics, policy, and enrollment services
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PilotAnalyticsService } from "../analytics-service";
import { PolicyConfigurationService } from "../policy-service";
import { PilotEnrollmentService } from "../enrollment-service";
import { PrivacyAnalytics } from "@/services/analytics";

describe("PilotEnrollmentService", () => {
  let service: PilotEnrollmentService;

  beforeEach(() => {
    service = new PilotEnrollmentService(12);
  });

  it("should not enroll users when enrollment is closed", () => {
    const user = service.enrollUser("user1");
    expect(user).toBeNull();
  });

  it("should enroll users when enrollment is open", () => {
    service.openEnrollment();
    const user = service.enrollUser("user1");
    expect(user).not.toBeNull();
    expect(user?.id).toBe("user1");
    expect(user?.phase).toBe("enrollment");
    expect(user?.consentGiven).toBe(false);
  });

  it("should respect max cohort size", () => {
    service = new PilotEnrollmentService(2);
    service.openEnrollment();

    service.enrollUser("user1");
    service.enrollUser("user2");
    const user3 = service.enrollUser("user3");

    expect(user3).toBeNull();
    expect(service.getCohortSize()).toBe(2);
  });

  it("should confirm consent and transition to active phase", () => {
    service.openEnrollment();
    service.enrollUser("user1");

    const result = service.confirmConsent("user1");
    expect(result?.consentGiven).toBe(true);
    expect(result?.phase).toBe("active");
  });

  it("should track enrollment progress", () => {
    service.openEnrollment();
    service.enrollUser("user1");
    service.enrollUser("user2");

    const progress = service.getEnrollmentProgress();
    expect(progress.current).toBe(2);
    expect(progress.max).toBe(12);
  });

  it("should calculate consent rate", () => {
    service.openEnrollment();
    service.enrollUser("user1");
    service.enrollUser("user2");
    service.confirmConsent("user1");

    const rate = service.getConsentRate();
    expect(rate).toBe(50);
  });

  it("should transition user phases", () => {
    service.openEnrollment();
    service.enrollUser("user1");

    service.transitionPhase("user1", "analysis");
    const phase = service.getUserPhase("user1");
    expect(phase).toBe("analysis");
  });

  it("should get users by phase", () => {
    service.openEnrollment();
    service.enrollUser("user1");
    service.enrollUser("user2");
    service.confirmConsent("user1");

    const activeUsers = service.getUsersByPhase("active");
    expect(activeUsers).toHaveLength(1);
    expect(activeUsers[0].id).toBe("user1");
  });

  it("should remove users", () => {
    service.openEnrollment();
    service.enrollUser("user1");

    const removed = service.removeUser("user1");
    expect(removed).toBe(true);
    expect(service.getCohortSize()).toBe(0);
  });
});

describe("PolicyConfigurationService", () => {
  let service: PolicyConfigurationService;

  beforeEach(() => {
    service = new PolicyConfigurationService();
  });

  it("should initialize configuration for a user", () => {
    const config = service.initializeConfiguration("user1");
    expect(config.userId).toBe("user1");
    expect(config.rules).toHaveLength(0);
    expect(config.defaultCategory).toBe("request");
    expect(config.restrictivePolicyEnabled).toBe(false);
  });

  it("should add a policy rule", () => {
    service.initializeConfiguration("user1");
    const rule = service.addRule("user1", "alice@trusted.com", "allow");

    expect(rule.senderIdentifier).toBe("alice@trusted.com");
    expect(rule.category).toBe("allow");

    const rules = service.getRules("user1");
    expect(rules).toHaveLength(1);
  });

  it("should update a policy rule", () => {
    service.initializeConfiguration("user1");
    const rule = service.addRule("user1", "alice@trusted.com", "allow");

    const updated = service.updateRule("user1", rule.id, "block");
    expect(updated?.category).toBe("block");
  });

  it("should delete a policy rule", () => {
    service.initializeConfiguration("user1");
    const rule = service.addRule("user1", "alice@trusted.com", "allow");

    const deleted = service.deleteRule("user1", rule.id);
    expect(deleted).toBe(true);
    expect(service.getRules("user1")).toHaveLength(0);
  });

  it("should find applicable rule for exact match", () => {
    service.initializeConfiguration("user1");
    service.addRule("user1", "alice@trusted.com", "allow");

    const rule = service.findApplicableRule("user1", "alice@trusted.com");
    expect(rule?.category).toBe("allow");
  });

  it("should find applicable rule with wildcard pattern", () => {
    service.initializeConfiguration("user1");
    service.addRule("user1", "recruiting*", "paid-access");

    const rule1 = service.findApplicableRule("user1", "recruiting@example.com");
    expect(rule1?.category).toBe("paid-access");

    const rule2 = service.findApplicableRule("user1", "recruiting-team@company.io");
    expect(rule2?.category).toBe("paid-access");

    const rule3 = service.findApplicableRule("user1", "recruiting");
    expect(rule3?.category).toBe("paid-access");
  });

  it("should determine policy category (rule match)", () => {
    service.initializeConfiguration("user1");
    service.addRule("user1", "spam*", "block");

    const category = service.determinePolicyCategory("user1", "spam@evil.com");
    expect(category).toBe("block");
  });

  it("should determine policy category (default)", () => {
    service.initializeConfiguration("user1", "paid-access");

    const category = service.determinePolicyCategory("user1", "unknown@sender.com");
    expect(category).toBe("paid-access");
  });

  it("should enable and disable restrictive policy", () => {
    service.initializeConfiguration("user1");

    const enabled = service.enableRestrictivePolicy("user1");
    expect(enabled).toBe(true);
    expect(service.isRestrictivePolicyEnabled("user1")).toBe(true);

    const disabled = service.disableRestrictivePolicy("user1");
    expect(disabled).toBe(true);
    expect(service.isRestrictivePolicyEnabled("user1")).toBe(false);
  });
});

describe("PilotAnalyticsService", () => {
  let service: PilotAnalyticsService;
  let analytics: PrivacyAnalytics;

  beforeEach(() => {
    analytics = new PrivacyAnalytics({ enabled: true, maxPrivacyBudget: 50 });
    service = new PilotAnalyticsService(analytics);
  });

  it("should record policy decisions", () => {
    const measurement = service.recordPolicyDecision(
      "user1",
      "alice@sender.com",
      "allow",
      true,
    );

    expect(measurement.userId).toBe("user1");
    expect(measurement.appliedCategory).toBe("allow");
    expect(measurement.messageDelivered).toBe(true);
    expect(measurement.senderIdentifierHash).toMatch(/^hash_/);

    const measurements = service.getMeasurements();
    expect(measurements).toHaveLength(1);
  });

  it("should hash sender identifiers deterministically", () => {
    const measurement1 = service.recordPolicyDecision(
      "user1",
      "alice@sender.com",
      "allow",
      true,
    );

    const measurement2 = service.recordPolicyDecision(
      "user1",
      "alice@sender.com",
      "block",
      false,
    );

    expect(measurement1.senderIdentifierHash).toBe(measurement2.senderIdentifierHash);
  });

  it("should record manual overrides", () => {
    const record = service.recordManualOverride("user1", "block", "allow", "trusted_sender");

    expect(record.userId).toBe("user1");
    expect(record.originalCategory).toBe("block");
    expect(record.overrideCategory).toBe("allow");
    expect(record.reason).toBe("trusted_sender");

    const overrides = service.getOverrides();
    expect(overrides).toHaveLength(1);
  });

  it("should report false positives", () => {
    const report = service.reportFalsePositive(
      "user1",
      "meas123",
      "alice@trusted.com",
      "block",
      "important_request_missed",
    );

    expect(report.userId).toBe("user1");
    expect(report.reason).toBe("important_request_missed");

    const falsePositives = service.getFalsePositives();
    expect(falsePositives).toHaveLength(1);
  });

  it("should calculate user metrics", () => {
    const enrollmentStartMs = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
    const restrictivePolicyEnabledMs = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days ago

    // Record some decisions
    service.recordPolicyDecision("user1", "alice@a.com", "allow", true);
    service.recordPolicyDecision("user1", "bob@b.com", "block", false);
    service.recordPolicyDecision("user1", "charlie@c.com", "request", false);

    // Record overrides (less than decisions)
    service.recordManualOverride("user1", "block", "allow");

    const metrics = service.calculateUserMetrics(
      "user1",
      enrollmentStartMs,
      restrictivePolicyEnabledMs,
    );

    expect(metrics.userId).toBe("user1");
    expect(metrics.restrictivePolicyAdopted).toBe(true);
    expect(metrics.policyDecisionCount).toBe(3);
    expect(metrics.manualOverrideCount).toBe(1);
    expect(metrics.triageEffortReduction).toBeGreaterThan(0);
    expect(metrics.restrictivePolicyRetention).toBeGreaterThan(0);
  });

  it("should calculate success signal when criteria met", () => {
    const enrollmentStartMs = Date.now() - 14 * 24 * 60 * 60 * 1000; // 14 days ago
    const restrictivePolicyEnabledMs = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

    // Record many decisions with few overrides (high effort reduction)
    for (let i = 0; i < 20; i++) {
      service.recordPolicyDecision("user1", `sender${i}@example.com`, "allow", true);
    }

    // Only 1 override
    service.recordManualOverride("user1", "block", "allow");

    const metrics = service.calculateUserMetrics(
      "user1",
      enrollmentStartMs,
      restrictivePolicyEnabledMs,
    );

    expect(metrics.successSignalMet).toBe(true);
  });

  it("should clear all data", () => {
    service.recordPolicyDecision("user1", "alice@a.com", "allow", true);
    service.recordManualOverride("user1", "block", "allow");

    service.clearData();

    expect(service.getMeasurements()).toHaveLength(0);
    expect(service.getOverrides()).toHaveLength(0);
  });
});

describe("Integration: Full Pilot Workflow", () => {
  let enrollmentService: PilotEnrollmentService;
  let policyService: PolicyConfigurationService;
  let analyticsService: PilotAnalyticsService;
  let analytics: PrivacyAnalytics;

  beforeEach(() => {
    enrollmentService = new PilotEnrollmentService(5);
    policyService = new PolicyConfigurationService();
    analytics = new PrivacyAnalytics({ enabled: true, maxPrivacyBudget: 50 });
    analyticsService = new PilotAnalyticsService(analytics);
  });

  it("should handle complete pilot workflow", () => {
    // 1. Open enrollment
    enrollmentService.openEnrollment();
    expect(enrollmentService.isEnrollmentOpen()).toBe(true);

    // 2. Enroll users
    const user1 = enrollmentService.enrollUser("user1");
    expect(user1?.phase).toBe("enrollment");

    // 3. Confirm consent
    enrollmentService.confirmConsent("user1");
    const activeUser = enrollmentService.getUser("user1");
    expect(activeUser?.phase).toBe("active");

    // 4. Initialize policy configuration
    policyService.initializeConfiguration("user1", "request");

    // 5. Add policy rules
    policyService.addRule("user1", "trusted*", "allow");
    policyService.addRule("user1", "spam*", "block");

    const rules = policyService.getRules("user1");
    expect(rules).toHaveLength(2);

    // 6. Enable restrictive policy
    policyService.enableRestrictivePolicy("user1");
    expect(policyService.isRestrictivePolicyEnabled("user1")).toBe(true);

    // 7. Process incoming mail with policy decisions
    analyticsService.recordPolicyDecision("user1", "trusted@company.com", "allow", true);
    analyticsService.recordPolicyDecision("user1", "spam@evil.com", "block", false);

    // 8. User overrides a decision
    analyticsService.recordManualOverride("user1", "block", "allow", "false_positive");

    // 9. Calculate metrics
    const enrollmentStartMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const restrictivePolicyEnabledMs = Date.now() - 5 * 24 * 60 * 60 * 1000;

    const metrics = analyticsService.calculateUserMetrics(
      "user1",
      enrollmentStartMs,
      restrictivePolicyEnabledMs,
    );

    expect(metrics.userId).toBe("user1");
    expect(metrics.restrictivePolicyAdopted).toBe(true);
    expect(metrics.policyDecisionCount).toBe(2);
    expect(metrics.manualOverrideCount).toBe(1);

    // 10. Transition to analysis phase
    enrollmentService.transitionPhase("user1", "analysis");
    const analyzedUser = enrollmentService.getUser("user1");
    expect(analyzedUser?.phase).toBe("analysis");
  });
});
