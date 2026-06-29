# Tests

Unit and integration tests for the Team Payment Approval tool.

## Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── payment.service.spec.ts       # PaymentService CRUD methods
│   │   └── decision.service.spec.ts      # DecisionService + localStorage
│   ├── hooks/
│   │   ├── use-payment-approval.spec.ts  # approve / reject / clearError
│   │   └── use-payment-requests.spec.ts  # fetch / filter / refresh
│   └── components/
│       ├── payment-approval-list.spec.tsx
│       └── payment-approval-form.spec.tsx
└── integration/
    └── approval-workflow.spec.ts         # Full list → form → decision flow
```

## Running Tests

```bash
# From workspace root
bun run test --filter tools/v2/team/team-payment-approval

# Or directly with vitest
npx vitest run tests/
```

## Guidelines

- Use **Vitest** for all tests
- Import fixtures from `../fixtures/payments.fixtures`  — never inline test data
- Mock `localStorage` for service tests
- Mock service responses for hook tests
- Test the happy path and at least one error/edge case per behaviour
- No imports from `src/`
- No real network calls

See `CONTRIBUTOR_GUIDE.md` for more detail on writing tests.
