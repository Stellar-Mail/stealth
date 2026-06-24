# Spam Risk Checker (V1)

**Release Tier:** V1  
**Audience:** Individual  
**Labels:** GrantFox OSS, Maybe Rewarded, Official Campaign, Tooling Ecosystem, V1 Launch Tool, Individual Tool

## Overview

The Spam Risk Checker is a small, isolated heuristic tool for reviewing incoming message content and producing a lightweight risk score. It is intentionally self-contained so contributors can validate it without touching the main mail application.

## Setup

1. From the repository root, ensure dependencies are installed.
2. Run the local test suite for this tool:
   `npx vitest run tools/v1/individual/spam-risk-checker/tests/spamRiskChecker.test.ts`

## Usage

```ts
import { analyzeSpamRisk } from "./services/spamRiskChecker";

const result = analyzeSpamRisk({
  subject: "Urgent update",
  body: "Verify your account now and click the link.",
});

console.log(result.level, result.score, result.reasons);
```

## Fixtures

The local fixtures live in [tests/fixtures.ts](tests/fixtures.ts) and cover:

- a benign message that should score as low risk
- a suspicious message with urgency and bait language
- a mixed message that should score as medium risk

## Known Limitations

- The current implementation uses simple deterministic heuristics rather than machine learning.
- It evaluates message text only; it does not inspect headers, attachments, or sender reputation.
- The scoring is intentionally conservative so contributors can review and extend it easily.

## OSS Contributor Review Notes

- Review the service in [services/spamRiskChecker.ts](services/spamRiskChecker.ts) first.
- Validate the behavior in [tests/spamRiskChecker.test.ts](tests/spamRiskChecker.test.ts).
- Keep future inbox integration work as a separate follow-up issue.
