# Launch Metrics and North-Star Metric

## Purpose

Account counts, message volume, and transaction totals are easy to grow and easy to fake. Optimizing them can reward spam, bots, and shallow activity that make the product look busy without making communication more trustworthy. This document defines a north-star metric for trusted communication, the driver metrics that move it, the quality guardrails that keep it honest, and stage-specific targets for design partner, private beta, and public beta.

## Guiding principles

- Measure trusted communication, not raw activity.
- Every metric has a precise definition: numerator, denominator, measurement window, and exclusions.
- Guardrails are first-class. A win that breaches a guardrail is not a win.
- Targets are hypotheses until validated by real usage, and are labeled as such.
- Each metric has a named owner and a fixed review cadence.

## Metric definition format

Every metric below is defined with four fields so it can be implemented and audited without ambiguity:

- **Numerator** — what is counted at the top of the ratio (or the counted event for volume metrics).
- **Denominator** — the population the numerator is measured against (`Not applicable` for absolute counts).
- **Window** — the time period the metric is measured over.
- **Exclusions** — accounts, messages, or events removed before measurement.

## North-star metric

**Weekly Trusted Conversations (WTC)** — the number of distinct two-way conversations in a week that stay trustworthy end to end.

- **Numerator** — distinct conversations in the window where (a) both participants are verified, (b) the recipient sends at least one reply, (c) every message passed proof verification, and (d) neither participant marked the thread as spam or abusive.
- **Denominator** — Not applicable (absolute count). The companion `Trusted Conversation Rate` below carries the denominator.
- **Window** — rolling 7 days, reported weekly.
- **Exclusions** — internal and test accounts, automated or system messages, self-conversations (same owner on both sides), and conversations created by accounts flagged for abuse during the window.

**Trusted Conversation Rate** (companion ratio)

- **Numerator** — trusted conversations as defined above.
- **Denominator** — all conversations initiated in the window (verified or not).
- **Window** — rolling 7 days.
- **Exclusions** — same exclusions as WTC.

## Driver metrics

Driver metrics are the inputs we expect to move the north star. Each is fully defined.

### Trusted activation

- **Numerator** — new accounts that complete their first trusted conversation within 7 days of verifying.
- **Denominator** — new accounts that verified in the same cohort window.
- **Window** — weekly cohort, 7-day follow.
- **Exclusions** — internal and test accounts; accounts that never completed verification.

### Verification coverage

- **Numerator** — active senders that are verified.
- **Denominator** — all active senders in the window.
- **Window** — rolling 7 days.
- **Exclusions** — system senders; accounts flagged for abuse.

### Two-way reply rate

- **Numerator** — initiated conversations that receive at least one recipient reply.
- **Denominator** — all conversations initiated in the window.
- **Window** — rolling 7 days; a reply counts if sent within 7 days of initiation.
- **Exclusions** — automated messages; conversations to blocked senders.

### Trusted retention

- **Numerator** — accounts with a trusted conversation in week N that have another trusted conversation in week N+1.
- **Denominator** — accounts with a trusted conversation in week N.
- **Window** — week over week.
- **Exclusions** — internal and test accounts; accounts deactivated in week N+1.

## Quality guardrails

Guardrails protect users from the failure modes that gaming the north star would create. Each has a defined ceiling; breaching it blocks a launch decision regardless of north-star movement.

### False block rate

- **Numerator** — legitimate messages that were incorrectly blocked or quarantined (confirmed via appeal or manual review).
- **Denominator** — all legitimate messages in the window.
- **Window** — rolling 7 days.
- **Exclusions** — messages correctly blocked by explicit user rules.
- **Direction** — lower is better; treated as a ceiling guardrail.

### Proof failure rate

- **Numerator** — messages that failed proof verification.
- **Denominator** — all messages that attempted proof verification.
- **Window** — rolling 7 days.
- **Exclusions** — messages from clients on a known-broken version pinned for upgrade.
- **Direction** — lower is better; treated as a ceiling guardrail.

### Spam-marked rate

- **Numerator** — delivered messages later marked as spam or abusive by the recipient.
- **Denominator** — all delivered messages in the window.
- **Window** — rolling 7 days.
- **Exclusions** — internal and test accounts.
- **Direction** — lower is better; treated as a ceiling guardrail.

## Stage targets

All targets are **hypotheses** to be validated or revised with real data. They are starting points for learning, not commitments.

### Design partner

- _Hypothesis:_ Trusted Conversation Rate >= 60%; trusted activation >= 40%; false block rate <= 2%; proof failure rate <= 1%.
- Focus: confirm the definitions are measurable and the guardrails are observable with a handful of real teams.

### Private beta

- _Hypothesis:_ WTC grows week over week; Trusted Conversation Rate >= 65%; trusted retention >= 35%; false block rate <= 1.5%; proof failure rate <= 0.7%.
- Focus: confirm the drivers actually move the north star.

### Public beta

- _Hypothesis:_ WTC sustains double-digit weekly growth; Trusted Conversation Rate >= 70%; trusted retention >= 40%; false block rate <= 1%; proof failure rate <= 0.5%; spam-marked rate <= 0.5%.
- Focus: confirm the metric holds under open, adversarial traffic.

## Ownership and review cadence

- **North-star owner** — Product lead; owns the WTC definition and reports it weekly.
- **Driver metrics** — Growth owns activation, coverage, and reply rate; Product owns retention.
- **Guardrails** — Trust and Safety owns false block, proof failure, and spam-marked rates, and holds veto on launch decisions that breach a ceiling.
- **Weekly metric review** — the team reviews north star, drivers, and guardrails together; guardrail breaches are triaged first.
- **Monthly target review** — targets are re-examined against real data and updated; every change is recorded with its date and rationale.

## Acceptance criteria mapping

- **Definitions include numerator, denominator, window, and exclusions** — every metric in _North-star metric_, _Driver metrics_, and _Quality guardrails_ uses the four-field format from _Metric definition format_.
- **Guardrails cover false blocks and proof failures** — see _Quality guardrails_ (false block rate, proof failure rate, plus spam-marked rate).
- **Targets are labeled as hypotheses** — see _Stage targets_, where every target is marked as a hypothesis.
- **Ownership and review cadence are assigned** — see _Ownership and review cadence_.

## Success signal

Every roadmap bet names the metric it is expected to move and states the result that would invalidate it. A bet that cannot name its metric, or that improves the north star while breaching a guardrail, is not ready to ship.
