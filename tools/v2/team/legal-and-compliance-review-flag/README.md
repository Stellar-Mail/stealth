# Legal and Compliance Review Flag

This folder is the isolated workspace for the Legal and Compliance Review Flag tool.

## Ownership Boundary

All work for this tool must stay inside:

`tools/v2/team/legal-and-compliance-review-flag/`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See `specs.md` for the issue categories and contributor expectations.

## Non-UI execution contract

The contract is backend-facing and has no UI or DOM dependencies.

- `contract.ts` — typed inputs (`ReviewFlagInput`), outputs (`ReviewFlagResult`), and
  the discriminated `ReviewFlagError` union (`invalid_input`, `unauthorized_reviewer`,
  `duplicate_flag`, `resource_not_found`, `policy_conflict`). The pure entrypoint is
  `createReviewFlag(input, deps)`.
- `services/review-flag-service.ts` — the service boundary that wires the pure contract
  to a real backend (`ReviewFlagBackend`) without leaking I/O into the contract.
- `fixtures.ts` — deterministic fixtures covering valid, invalid, and edge cases.
- `index.ts` — the public surface; import from here.
- `../../../tests/unit/legal-and-compliance-review-flag/contract.test.ts` — unit tests.

### Invariants

- The contract never throws for expected domain failures; it returns a typed
  `ReviewFlagError` so callers branch on `outcome.code`.
- All non-determinism (auth, persistence, ids, clock) is injected via
  `ReviewFlagDependency` / `ReviewFlagBackend`, keeping the contract testable with no DB.
