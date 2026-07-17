# Role-Based Mail Access Specs

Release tier: V2  
Audience: team

This folder contains a self-contained tool for role-based mail access checks. It is intentionally isolated from the main application until a future integration issue explicitly allows wiring.

## Scope

- local guard validation and sanitization
- in-memory policy evaluation and audit logs
- React hook and presentational UI for the isolated demo
- folder-local fixtures, tests, and contributor documentation

## Non-Goals

- no routing or shell changes
- no inbox architecture changes
- no mail rendering engine changes
- no authentication, wallet, Stellar, or database work

## Contributor Review

Start with:

- [README.md](README.md)
- [tests/test-plan.md](tests/test-plan.md)
- [docs/review-notes.md](docs/review-notes.md)

Keep every file touched by this issue inside `tools/v2/team/role-based-mail-access/`.
