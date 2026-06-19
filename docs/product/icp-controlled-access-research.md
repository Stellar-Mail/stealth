# ICP Research: Controlled-Access Mail Workflow

> **Status: draft research plan, not yet validated.** Stealth's value proposition
> rests on one workflow where controlled access beats ordinary email. This
> document is the research instrument and current best hypothesis, built from
> the product's existing design intent (see [README](../../README.md) and the
> [legacy email interoperability roadmap](./legacy-email-interoperability-roadmap.md)).
> It has **not** been validated against the required 10+ user interviews. Each
> section below states what is hypothesis vs. what must be confirmed in the
> field, and includes the interview guide needed to close that gap.

## Why one workflow, not "every email user"

Stealth's core mechanic — sender-side identity verification, mailbox policy,
and priced/blocked access for unknown senders — is wasted on low-stakes inboxes
where spam is merely annoying. It pays off where unauthorized access has a real
cost: financial loss, leaked credentials, reputational damage, or wasted
high-value time. The ICP should be the segment where that cost is highest and
most frequent, not the segment with the most total inboxes.

## Candidate ICP (hypothesis, pending validation)

**One-page ICP**

| Dimension | Hypothesis |
|---|---|
| **Who** | Operator or gatekeeper for a high-value, high-target inbox: a founder/exec EA, a crypto-native team's ops/security lead, or a paid expert (advisor, auditor, counsel) who sells access to their time/attention. |
| **Firmographic qualifiers** | Org size 2–200; handles outside money (treasury, client funds, or paid consulting); has a named security/compliance owner or an EA managing exec inboxes; already pays for at least one identity/security tool (2FA hardware, password manager, KYC tool). |
| **Behavioral qualifiers** | Receives unsolicited high-stakes outreach weekly (deal flow, vendor pitches, impersonation attempts); has been targeted by phishing/spoofing in the last 12 months; currently uses manual workarounds (allowlists, separate "public" vs "private" addresses, gatekeeping via EA) to manage inbound trust. |
| **Trigger event** | A specific impersonation/phishing incident, a wallet/treasury near-miss, or onboarding a new EA/ops hire tasked with "cleaning up" the inbox. |
| **Buyer vs. user** | Buyer is typically the security/ops lead or the principal themselves (for solo paid experts); user is the EA, ops lead, or the principal directly. These are the same person in solo/paid-expert cases, distinct in exec/crypto-team cases — this split changes onboarding and pricing motion and must be confirmed per segment. |

## Top three jobs (ranked by urgency × frequency — hypothesis)

1. **Stop impersonation/phishing from reaching the inbox at all** (high urgency, recurring). Job: verify sender identity cryptographically before a message is even rendered, not after-the-fact reporting.
2. **Gate paid/expert access without managing it manually** (medium urgency, frequent for paid experts). Job: let unknown senders reach you only if they pay postage or pass an explicit check, replacing manual "intro fee" or calendar-gating workflows.
3. **Produce an auditable trail of who reached the inbox and how** (lower frequency, high urgency when needed — compliance review, incident postmortem, dispute). Job: prove delivery/identity/postage history without exposing message content.

These rankings are a starting hypothesis to be re-ranked after interviews — frequency and urgency may diverge by segment (e.g., job 1 may dominate for crypto-native teams, job 2 for paid experts).

## Five falsifiable assumptions and their tests

1. **Assumption:** Targeted users have been phished/impersonated in the last 12 months and can recall a specific incident.
   **Test:** In each interview, ask for a dated incident; reject the assumption if fewer than 6 of 10 can name one.
2. **Assumption:** Current workarounds (separate addresses, EA gatekeeping, manual allowlists) are perceived as failing, not just annoying.
   **Test:** Ask "what happens when it fails" and rate severity 1–5; reject if median severity < 3.
3. **Assumption:** The buyer is willing to require verified identity from counterparties, even at the cost of friction for legitimate-but-unverified senders.
   **Test:** Present a concrete tradeoff scenario (a real prospect can't reach them because unverified) and ask if they'd accept it; reject if fewer than 6 of 10 say yes.
4. **Assumption:** Paid postage for unknown senders is acceptable/desirable, not just identity verification.
   **Test:** Ask if they'd set a minimum payment to receive unsolicited mail today, with what amount; reject if fewer than 5 of 10 give a concrete number > $0.
5. **Assumption:** A delivery/identity audit trail is something they'd actively reference (compliance, dispute, postmortem), not merely "nice to have."
   **Test:** Ask for a past instance where they needed proof of "who sent what, when, and how it was verified"; reject if fewer than 5 of 10 have a real instance.

## Explicit non-goals (for this research and the resulting product focus)

- Not targeting casual/personal email users seeking general spam reduction.
- Not targeting large enterprises requiring SSO/IT-procurement-led rollout in this phase.
- Not solving full legacy-email replacement; bridging is a separate, later roadmap item (see [legacy email interoperability roadmap](./legacy-email-interoperability-roadmap.md)).
- Not optimizing for sender-side adoption (people sending mail) — initial focus is recipient-side control.
- Not pursuing segments where the buyer and user disagree on access policy without a clear resolution path (e.g., shared team inboxes with no single owner).

## Deferred segments

- General consumer inboxes (spam-fatigue alone is not high-stakes enough).
- Large enterprise IT/security teams (longer procurement cycle, likely a later expansion segment once the core workflow is proven).
- Customer-support / high-volume transactional inboxes (different cost structure — volume over precision).
- Journalists/whistleblower-source-protection use cases (real fit, but distinct trust model and threat profile from the postage/identity mechanic above — worth a separate ICP pass later).

## Interview guide (for the required 10+ interviews)

Run across all four named segments: executive inboxes (EAs/principals), crypto-native teams (ops/security leads), security-sensitive orgs (compliance/security owners), paid expert access (advisors/consultants who gate their own time).

1. Walk me through the last time someone you didn't know reached your inbox and it mattered (good or bad).
2. Have you had a phishing/impersonation incident in the past 12 months? What happened?
3. What do you currently do to control who reaches you? What breaks about it?
4. If you could require verified identity to even see a message from a stranger, would you? What would you give up to get that?
5. Would you set a price for unsolicited mail to reach you? What would that number be, and why?
6. Has anyone ever asked you to prove who contacted you, when, and how you verified them? Walk me through that.
7. Who actually decides your inbox policy — you, an assistant, a security team? Who would need to approve a tool like this?
8. What would have to be true for you to try this in the next 30 days?

## Success signal tracking

Target: **5 design partners** committed to testing the same core workflow within 30 days of completing interviews. Track per segment to confirm the workflow generalizes rather than being a one-segment artifact:

| Segment | Interviews completed | Design partners committed |
|---|---|---|
| Executive inboxes | 0 / — | 0 / 5 |
| Crypto-native teams | 0 / — | 0 / 5 |
| Security-sensitive orgs | 0 / — | 0 / 5 |
| Paid expert access | 0 / — | 0 / 5 |

## Next steps

1. Recruit and schedule 10+ interviews across the four segments above.
2. Run the interview guide; log raw notes per assumption test.
3. Score each falsifiable assumption pass/fail against its stated threshold.
4. Re-rank jobs and finalize (or revise) the ICP based on actual findings.
5. Recruit design partners from interviewees who pass assumption tests 1–3 at minimum.
