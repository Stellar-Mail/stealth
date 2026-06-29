# Stealth Concierge Pilot Protocol

**Version:** 1.0  
**Date:** June 2026  
**Duration:** Two weeks (14 days)

---

## Purpose

This document defines the concierge pilot protocol for validating inbox access policy controls. The pilot tests whether users can effectively configure and maintain restrictive email policies for real communication workflows.

---

## Core Promise Validation

**Hypothesis:** Users who configure restrictive inbox access policies (allow, request, block, paid-access) will:
1. Keep the restrictive policy enabled for 70%+ of the pilot duration
2. Report measurable reduction in email triage effort

**Why this matters:** The core promise is control over who enters an inbox. This pilot provides observed behavioral validation before deeper infrastructure investment in policy systems, payment integration, and compliance frameworks.

---

## Pilot Scope

### Participant Cohort
- **Target size:** 8-12 users
- **Selection criteria:** Diverse email workflows (personal, professional, recruiting, organizational)
- **Geographic:** No restrictions
- **Technical requirement:** Access to Stealth reference client

### Policy Categories Under Test
Participants configure rules across four categories:
1. **Allow** - Trusted senders reach the inbox immediately
2. **Request** - Unknown senders trigger a review request before delivery
3. **Block** - Senders are blocked with no notification or delivery
4. **Paid-access** - Senders must attach postage (micro-payment) to reach the inbox

### Measurement Scope
Measurements capture:
- **Policy decision count:** How many senders triggered policy checks
- **Policy decision outcome:** Which category was applied and whether delivery occurred
- **Manual overrides:** User interventions overriding automatic policy decisions
- **False positives:** Trusted senders incorrectly blocked or delayed
- **Restrictive policy retention:** Percentage of pilot duration policy remained enabled

**Explicitly NOT measured:**
- Message bodies (never stored, never accessible)
- Sender email addresses (hashed deterministically, then discarded)
- Message subjects or metadata
- Any personally identifiable information

---

## Pilot Phases

### Phase 1: Enrollment (Days 1-2)
- Participants receive enrollment invitation with full consent language
- Confirm informed consent (see Consent Language section)
- System collects enrollment timestamp
- Participants receive concierge support via email or chat

### Phase 2: Active Policy Configuration (Days 3-13)
- Participants configure allow, request, block, and paid-access rules
- System records each policy decision without storing message content
- Participants manually override automatic decisions as needed
- System tracks override frequency and reason codes (optional)
- Participants report false positives through in-app interface

### Phase 3: Analysis (Day 14)
- Pilot ends; no new policy decisions recorded
- System generates per-user and cohort-level metrics
- Participants receive individual impact report
- Team reviews requirements updates based on observed behavior

---

## Measurement Framework

### Privacy-Safe Analytics
All measurements use privacy-focused tracking:
- **Hashing:** Sender identifiers are deterministically hashed (SHA-256 equivalent) and never stored plaintext
- **Privacy budget:** Events consume epsilon values from a privacy budget pool to prevent inference attacks
- **Retention:** Measurements deleted 2 weeks after pilot completion unless participant opts for archival
- **Aggregation:** Individual data only reported to participant; cohort results aggregated before analysis

### Key Metrics

**Per-User Metrics:**
```
1. Enrollment Duration (days in pilot)
2. Restrictive Policy Adopted (boolean: did user enable policy)
3. Restrictive Policy Retention (% of days enabled)
4. Policy Decision Count (total senders evaluated)
5. Manual Override Count (user overrides of auto-decisions)
6. False Positive Count (trusted senders incorrectly blocked)
7. Triage Effort Reduction (1 - (overrides / policy decisions)) × 100
8. Success Signal Met (retention ≥ 70% AND triage reduction > 0)
```

**Cohort Metrics:**
```
1. Cohort Size (enrolled participants)
2. Adoption Rate (% enabling restrictive policy)
3. Retention Rate (% keeping policy enabled 70%+ of time)
4. Average Triage Reduction (mean effort reduction across cohort)
5. Success Signal Achieved (≥70% retention AND avg reduction > threshold)
6. Requirements Updates (observations for infrastructure design)
```

---

## Success Criteria

The pilot succeeds if **both** conditions hold:

1. **Retention:** ≥70% of participants keep a restrictive policy enabled for ≥70% of the pilot duration
2. **Effort Reduction:** Participants report measurable reduction in email triage effort (tracked via override patterns)

**Success outcome:** Validates observed behavioral commitment to restrictive policies, justifying infrastructure investment in:
- Advanced policy storage and versioning
- Postage settlement and refund automation
- Per-sender policy granularity
- Fallback and exception handling

**Non-success outcome:** Identifies specific friction points for requirements refinement before next iteration.

---

## Requirements Update Process

During analysis phase, the team identifies:
1. **Common override patterns:** Which policy categories need tuning
2. **False positive themes:** Systematic policy decision errors
3. **Feature requests:** Capabilities participants need (e.g., regex patterns, time-based rules)
4. **UX friction:** Usability issues in policy configuration

Requirements are updated in priority order:
- **Critical:** Blocks success (70% retention) → Fast-track fix
- **High:** Improves retention by >10% → Next iteration
- **Medium:** Improves adoption or feature completeness → Backlog
- **Low:** Nice-to-have improvements → Archive for later

---

## Concierge Support

Participants receive:
- **Email support:** Response within 24 hours for questions
- **Weekly check-in:** Optional call to discuss policy effectiveness
- **In-app help:** Documentation and example policy configurations
- **Data transparency:** Participants can export their measurements at any time

---

## Post-Pilot Outcome

### Data Handling
- Participant measurements: Retained 2 weeks after pilot completion for quality assurance
- Individual data: Deleted unless participant requests archival
- Cohort analysis: Aggregated results shared publicly in anonymized form
- Detailed findings: Shared with participant cohort before public release

### Next Steps (If Successful)
1. Archive successful configurations as templates
2. Design postage payment integration
3. Extend pilot to larger cohort (50-100 users)
4. Plan full production rollout with compliance infrastructure

---

## Participant Rights

Participants may:
- Exit the pilot at any time without penalty
- Request deletion of their measurement data
- Request export of their policy configurations
- Provide feedback or criticism at any time
- Remain anonymous in published results (default)

---

## Timeline

| Day | Activity |
|-----|----------|
| 1-2 | Enrollment, consent collection |
| 3-13 | Active policy configuration, measurement collection |
| 14 | Analysis, metric generation, outcome reporting |
| 14-28 | Post-pilot data retention and optional archival |

---

## Contact

For pilot questions, feedback, or data requests:
- Email: pilot@stealth.email
- In-app: Help → Pilot Support
- Feedback form: Available on metrics dashboard

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | June 2026 | Initial protocol release |

