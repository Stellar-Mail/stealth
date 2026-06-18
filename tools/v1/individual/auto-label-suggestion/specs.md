# Auto Label Suggestion Specs

## Purpose

Suggest practical labels for individual inbox users so they can triage messages faster
without manually scanning every thread.

## Input Contract

Each label decision should be based on a normalized email record:

```ts
type AutoLabelEmail = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  bodyPreview?: string;
  existingLabels?: string[];
  receivedAt?: string;
};
```

## Output Contract

Each suggestion should be explainable and safe to render in a review UI:

```ts
type AutoLabelSuggestion = {
  label: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  evidence: string;
};
```

## Initial Label Taxonomy

| Label         | Trigger examples                                           | Notes                                                                                |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Action needed | "please review", "approval required", "due today"          | Prefer high confidence when a deadline or explicit request is present.               |
| Finance       | invoice, receipt, payout, refund, payment                  | Keep separate from Stellar unless the message references wallet or on-chain details. |
| Stellar       | XLM, USDC, wallet, transaction hash, memo                  | Use when the email has blockchain-specific payment context.                          |
| Security      | OTP, verification code, suspicious sign-in, password reset | Never expose codes in logs or analytics.                                             |
| Calendar      | meeting, invite, reschedule, agenda                        | Include date/time evidence when available.                                           |
| Newsletter    | unsubscribe, weekly digest, product update                 | Do not override higher-risk Security or Finance labels.                              |

## Decision Rules

- Preserve existing user labels and add suggestions separately.
- Return at most three suggestions per email.
- Prefer fewer high-quality labels over broad keyword matching.
- If multiple labels are possible, rank Security and Finance above Newsletter.
- Explanations should quote only the minimal evidence needed for review.
- Suggestions must be deterministic for the same input fixture.

## Test Fixtures

Use `fixtures/email-label-cases.json` as the baseline fixture set for future unit tests.
The fixture covers finance, Stellar payment, security, calendar, newsletter, and mixed
priority scenarios.

## Review Expectations

Until executable code exists, reviewers can validate this tool by checking that the
fixture labels and the test plan cover the taxonomy, edge cases, and privacy boundaries
without modifying the main app.
