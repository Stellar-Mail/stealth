# Validating Sender-Controlled Inbox Demand with Design Partners

## Purpose

This document defines a two-week **concierge pilot** to validate demand for
sender-controlled inbox rules (allow / request / block / paid-access) before
deeper infrastructure investment. It is the deliverable for issue #43.

The core promise is that users control who enters their inbox. Before building
out the full rule engine and paid-access plumbing, we need **observed behavioral
validation** from real communication workflows. This doc specifies the pilot
protocol, consent language, a privacy-preserving measurement plan, the analysis
of false positives and manual overrides, and how the results update product
requirements.

## Guiding principles

- **No message bodies stored.** Measurement observes _policy decisions and
  outcomes_, never content. We instrument rule evaluations, not mail text.
- **Concierge, not self-serve.** A small cohort (8–12) is onboarded hands-on so
  we capture rationale for every override and config change.
- **Explicit, revocable consent.** Participants know exactly what is logged and
  can withdraw without losing access.
- **Decisions are measurable.** Every allow / request / block / paid-access
  decision emits a structured, content-free event.
- **Close the loop.** Observed behavior feeds directly back into the requirements.

## Pilot protocol

- **Cohort:** 8–12 design partners running a real communication workflow (e.g.,
  a small team inbox or a founder's personal inbox).
- **Duration:** two weeks, with a kickoff, a mid-point check-in, and a close-out.
- **Onboarding (concierge):** a 30-minute setup call per participant to configure
  an initial policy and explain the four rule types.
- **Cadence:** daily lightweight check-in prompt; intervention only when a
  participant is stuck.
- **Off-boarding:** export of the participant's own policy + outcome summary;
  deletion of derived event logs per the retention window.

## Consent language

> **What we collect.** When you use sender-controlled inbox rules during the
> pilot, we record _rule decisions_ — the sender category, the rule type applied
> (allow / request / block / paid-access), and the outcome (auto-applied,
> overridden, or escalated). We do **not** collect or store message bodies,
> subjects, or sender names in clear text beyond a hashed, non-reversible
> category tag.
>
> **Why.** To learn whether sender-controlled inbox rules reduce your triage
> effort, and which rule types are actually useful.
>
> **Your control.** You can change or disable rules at any time. You may withdraw
> consent and request deletion of your derived logs at any point with no loss of
> access to your inbox. Logs are retained for the pilot period only and then
> deleted.
>
> **No sale / no training.** Derived data is used solely for this pilot analysis
> and is not used to train external models.

## Measurement plan (no message bodies)

Every decision emits a content-free event:

| Field             | Example                                                      | Notes                         |
| ----------------- | ------------------------------------------------------------ | ----------------------------- |
| `event_id`        | uuid                                                         | unique                        |
| `participant_tag` | `p03`                                                        | non-reversible cohort id      |
| `rule_type`       | `allow` \| `request` \| `block` \| `paid_access`             | which control                 |
| `sender_category` | `hash(category)`                                             | hashed bucket, not an address |
| `decision`        | `auto` \| `override_allow` \| `override_block` \| `escalate` | outcome                       |
| `latency_ms`      | 42                                                           | triage time saved / spent     |
| `ts`              | ISO ts                                                       | for trend analysis            |

Aggregation computes, **per participant and cohort**:

- rate of each `rule_type` used,
- override rate and direction (tightened vs loosened),
- triage-time delta vs a pre-pilot baseline,
- share of participants who keep a _restrictive_ policy enabled at close-out.

No field above contains message text, subject, or a resolvable identifier.

## Analysis: false positives and manual overrides

- **False positive** := a `block` (or `paid_access`) decision the participant
  overrode to `allow` (or waived). Tracked as `override_allow` on a blocked item.
- **False negative** := a `allow` decision the participant overrode to `block`.
- Weekly review tags each override with a **reason** (captured in the concierge
  check-in): wrong category, missing rule, UI confusion, or policy change.
- Outcome: a ranked list of rule-type × sender-category pairs with the highest
  override rate, driving the requirements update.

## Requirements update

From observed behavior we revise the requirements spec:

- Which rule types carried real weight (expect `block` + `request` to dominate;
  `paid_access` likely lowest urgency).
- Minimum UI affordances needed to cut override friction.
- Category taxonomy gaps revealed by overrides.
- Whether a restrictive default is acceptable to 70% of participants
  (success signal).

## Acceptance criteria mapping

| Criterion                                                | Where satisfied                                   |
| -------------------------------------------------------- | ------------------------------------------------- |
| Pilot protocol and consent language documented           | §"Pilot protocol", §"Consent language"            |
| Policy decisions measured without storing message bodies | §"Measurement plan" (content-free event schema)   |
| False positives and manual overrides analyzed            | §"Analysis: false positives and manual overrides" |
| Requirements updated from observed behavior              | §"Requirements update"                            |

**Success signal:** 70% of participants keep a restrictive policy enabled at
close-out and report lower triage effort (measured via `triage-time delta` in the
event schema and the close-out survey).
