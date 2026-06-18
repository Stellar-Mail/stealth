# Review Notes

## What This Contribution Adds

- A guard module (`guards/access-guards.mjs`) with validation, sanitisation, and performance-safety helpers — no UI, no service wiring, no app integration.
- A fixture (`fixtures/sample-access-requests.json`) that encodes the valid-request contract and a named catalogue of 19 hostile inputs covering role escalation, injection, and traversal attacks.
- A test suite (`tests/access-guards.test.mjs`) with 33 tests that validate every guard function against both normal and adversarial inputs, and verify that all fixture hostile inputs throw `AccessValidationError`.
- A threat model (`docs/threat-model.md`) documenting trust boundaries, attack categories, and out-of-scope threats for future issues.
- Performance notes (`docs/performance-notes.md`) covering O(n) risks, size caps, and future implementation guidance.
- An updated `README.md` with setup, run command, file map, and known limitations.

## Validation Performed

```bash
node --test tools/v2/team/role-based-mail-access/tests/access-guards.test.mjs
```

All 33 tests pass. No install step required.

## Reviewer Focus

- **Guard completeness** — every hostile input category in `docs/threat-model.md` should have a corresponding entry in `fixtures/sample-access-requests.json` and a passing rejection test.
- **Allowlist discipline** — `validateRole` and `validateAccessLevel` use `Set.has()` against hard-coded allowlists, not regex. If the allowed roles or levels change in a future issue, update `ALLOWED_ROLES` / `ALLOWED_ACCESS_LEVELS` in the guard module and the `policy` object in the fixture.
- **Error field tagging** — every `AccessValidationError` carries a `field` property so future UI code can surface per-field error messages without parsing the message string.
- **No production code touched** — this contribution is self-contained. No files outside `tools/v2/team/role-based-mail-access/` were modified.

## Intentionally Out of Scope

- Authentication (verifying the caller owns the declared role) — requires session/token integration
- Audit logging of access decisions — separate compliance concern
- Rate limiting / brute-force protection — requires middleware outside this boundary
- UI components for role assignment — future feature issue
- Integration with the main inbox or routing — blocked by isolation boundary

## Follow-Up Work

- Add service code that loads the live role policy and wires `checkAccess` to inbox thread lookups.
- Add authentication middleware that validates the declared role against the session token.
- Add audit logging so every access decision is recorded for compliance review.
- Add integration tests only after a future issue explicitly allows app wiring.
