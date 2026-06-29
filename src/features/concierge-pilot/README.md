# Concierge Pilot Feature

Two-week pilot program to validate inbox access policy controls with 8-12
users in a real communication workflow.

## Overview

The concierge pilot tests the core promise: **users can control who enters
their inbox**, and this control measurably improves their email triage effort.

### Success Signal
- **70%+ of participants** keep a restrictive policy enabled throughout the pilot
- **Participants report** measurable reduction in email triage effort

## What This Implements

### Services

#### `PilotAnalyticsService`
Privacy-first analytics for tracking policy decisions without storing message bodies.

```typescript
import { pilotAnalytics } from "@/features/concierge-pilot";

// Record a policy decision
pilotAnalytics.recordPolicyDecision(
  userId,
  senderIdentifier,
  "block", // applied category
  false // was message delivered
);

// Record user override
pilotAnalytics.recordManualOverride(
  userId,
  "block",
  "allow",
  "trusted_sender"
);

// Report false positive
pilotAnalytics.reportFalsePositive(
  userId,
  measurementId,
  senderIdentifier,
  "block",
  "important_request_missed"
);

// Calculate user metrics
const metrics = pilotAnalytics.calculateUserMetrics(
  userId,
  enrollmentStartMs,
  restrictivePolicyEnabledMs
);
```

**Privacy Properties:**
- Sender identifiers are hashed (deterministic, one-way)
- Message bodies never stored or accessible
- Privacy budget enforcement prevents inference attacks
- 2-week retention, then automatic deletion

#### `PolicyConfigurationService`
CRUD operations for policy rules and configurations.

```typescript
import { policyService } from "@/features/concierge-pilot";

// Initialize configuration
const config = policyService.initializeConfiguration(userId);

// Add rules
policyService.addRule(userId, "alice@trusted.com", "allow");
policyService.addRule(userId, "spam*", "block");
policyService.addRule(userId, "recruiter*", "paid-access");

// Determine policy for a sender
const category = policyService.determinePolicyCategory(userId, sender);

// Enable restrictive policy mode
policyService.enableRestrictivePolicy(userId);

// Get all rules
const rules = policyService.getRules(userId);
```

#### `PilotEnrollmentService`
User enrollment, consent tracking, and phase transitions.

```typescript
import { enrollmentService } from "@/features/concierge-pilot";

// Open enrollment
enrollmentService.openEnrollment();

// Enroll user (returns null if full or closed)
const user = enrollmentService.enrollUser(userId);

// Confirm consent
enrollmentService.confirmConsent(userId);

// Track phase progression
enrollmentService.transitionPhase(userId, "active");

// Get cohort metrics
const progress = enrollmentService.getEnrollmentProgress();
const consentRate = enrollmentService.getConsentRate();
```

### Components

#### `PilotEnrollmentForm`
Enrollment form with informed consent display.

```typescript
import { PilotEnrollmentForm } from "@/features/concierge-pilot";

<PilotEnrollmentForm
  onEnroll={(consented) => {
    if (consented) {
      // Handle enrollment
    }
  }}
  isLoading={false}
/>
```

#### `PolicyConfiguration`
UI for configuring policy rules (allow, request, block, paid-access).

```typescript
import { PolicyConfiguration } from "@/features/concierge-pilot";

<PolicyConfiguration
  userId={userId}
  rules={rules}
  defaultCategory="request"
  onAddRule={(sender, category) => {
    // Handle add
  }}
  onUpdateRule={(ruleId, category) => {
    // Handle update
  }}
  onDeleteRule={(ruleId) => {
    // Handle delete
  }}
/>
```

#### `PilotMetricsDashboard`
Metrics display showing individual and cohort progress.

```typescript
import { PilotMetricsDashboard } from "@/features/concierge-pilot";

<PilotMetricsDashboard
  userMetrics={userMetrics}
  cohortAnalysis={cohortAnalysis}
/>
```

## Types

All types are exported from the feature:

```typescript
import type {
  PilotPolicyCategory,
  PilotPhase,
  PilotUser,
  PolicyRule,
  PolicyConfiguration,
  PolicyDecisionMeasurement,
  FalsePositiveReport,
  ManualOverrideRecord,
  PilotMetrics,
  PilotCohortAnalysis,
} from "@/features/concierge-pilot";
```

## Documentation

See related documentation:
- [Pilot Protocol](../docs/PILOT_PROTOCOL.md) - Full pilot structure, phases, and requirements
- [Consent Language](../docs/PILOT_CONSENT_LANGUAGE.md) - Participant informed consent document

## Implementation Notes

### Privacy by Design
- Sender identifiers are deterministically hashed (SHA-256 equivalent)
- Message bodies are never accessed or stored
- Privacy budget prevents inference attacks
- Personal identifiers (names, emails) deleted at pilot end
- 2-week retention for analysis, then auto-deletion

### Measurement Accuracy
- Policy decisions counted at delivery time
- Overrides tracked when user changes automatic decision
- False positives self-reported by user
- Triage reduction calculated as: (1 - overrides/decisions) × 100

### Analytics Integration
Services integrate with existing `PrivacyAnalytics` system:
- Events consume privacy budget epsilon values
- Forbidden fields (body, subject, email) validated
- Retention dates enforced automatically

## Testing

Clear data for testing:
```typescript
pilotAnalytics.clearData();
policyService.clearData();
enrollmentService.clearData();
```

## Success Metrics

The pilot succeeds if both are true:
1. **Retention:** ≥70% of users keep restrictive policy enabled ≥70% of time
2. **Effort:** Users show measured triage reduction (fewer overrides)

## Roadmap After Pilot

If successful, invest in:
- Advanced policy storage and versioning
- Postage payment integration and settlement
- Per-sender policy granularity and scheduling
- Exception handling and policy templates
- Larger cohort pilot (50-100 users)
- Production rollout with compliance infrastructure
