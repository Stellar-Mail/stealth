# Test Plan

## Overview

The Escalation Tool provides a presentation-independent execution contract and isolated service implementation.
This document outlines the validation strategy covering automated unit tests, fixtures, contract enforcement, and isolation checks.

## Automated Unit Tests

Automated tests cover:

- Successful escalation creation with normalized attributes and timestamps
- Input validation failures (missing `conversationId`, missing `reason`, empty strings)
- Priority validation (rejecting invalid priority values)
- Correlation ID propagation
- Persistence error handling when an injected repository throws
- Custom clock (`now`) and ID generator (`generateId`) dependency injection

Run unit tests via:

```bash
npx vitest run --config tools/v2/team/escalation-tool/vitest.config.ts
```

## Fixtures

`fixtures/execution.fixtures.ts` provides deterministic fixtures for testing and consumer integration:

- `successfulEscalationInput` — valid high-priority escalation request
- `missingConversationIdInput` — invalid whitespace conversation ID
- `missingReasonInput` — invalid empty reason string
- `invalidPriorityInput` — invalid priority level
- `failingRepository` — repository mock throwing persistence errors

## Manual Review Checklist

1. Confirm all modified/created files are contained within:

```text
tools/v2/team/escalation-tool/
```

2. Confirm no UI layout or styling files were changed.
3. Verify `CONTRACT.md` documents typed inputs, outputs, error codes, and service boundaries.
4. Verify non-UI service entry point is exported from `index.ts`.
5. Confirm unit tests pass cleanly.

## Acceptance Criteria Verification

- [x] Typed input and output contract is documented (`CONTRACT.md`)
- [x] Non-UI service entry point is exported (`escalationToolService`, `createEscalationToolService`)
- [x] Fixtures cover success and failure cases (`fixtures/execution.fixtures.ts`)
- [x] No styling or layout files are changed
