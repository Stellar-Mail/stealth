# Role-Based Mail Access

A self-contained V2 team tool that enforces which team members can read, write, assign, delete, or manage mail threads based on a declared role. This contribution adds the safety and performance guard layer — validation, sanitisation, and size caps — before any future integration work begins.

## Ownership Boundary

All work for this tool must stay inside:

```
tools/v2/team/role-based-mail-access/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Folder Structure

```
role-based-mail-access/
├── guards/
│   └── access-guards.mjs            # validation, sanitisation, and performance guard helpers
├── fixtures/
│   └── sample-access-requests.json  # valid requests + 19 named hostile inputs
├── tests/
│   └── access-guards.test.mjs       # 33-test Node suite covering guards and fixture
├── docs/
│   ├── threat-model.md              # trust boundary, attack categories, out-of-scope threats
│   ├── performance-notes.md         # O(n) risks, size caps, future guidance
│   └── review-notes.md              # scope, reviewer focus, follow-up issues
├── specs.md
└── README.md
```

## Running the Tests

No install step required. Run from the repository root:

```bash
node --test tools/v2/team/role-based-mail-access/tests/access-guards.test.mjs
```

Expected output: 33 passing tests, 0 failures.

## Guard API

All helpers live in `guards/access-guards.mjs` and throw `AccessValidationError` on invalid input.

| Export                              | Purpose                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `sanitizeRole(raw)`                 | Trims, lowercases, strips non-alphanumeric chars — use before validation |
| `validateRole(role)`                | Allowlist check against 5 known roles                                    |
| `validateAccessLevel(level)`        | Allowlist check against 5 known access levels                            |
| `validateEmailAddress(email)`       | Rejects CRLF injection, null bytes, missing local/domain parts           |
| `validateThreadId(threadId)`        | Rejects path traversal, spaces, special chars                            |
| `validateAccessRequest(req)`        | Full object validation — calls all four field validators                 |
| `checkAccess(role, level, policy)`  | O(1) Set-based policy lookup — returns boolean                           |
| `guardTeamSize(members)`            | Rejects arrays > 500 before any role scan                                |
| `guardAttachmentCount(attachments)` | Rejects arrays > 100 before any filter pass                              |
| `LIMITS`                            | Exported constants for all thresholds                                    |

## Roles and Access Levels

| Role      | read | write | assign | delete | manage |
| --------- | ---- | ----- | ------ | ------ | ------ |
| `admin`   | ✓    | ✓     | ✓      | ✓      | ✓      |
| `manager` | ✓    | ✓     | ✓      |        |        |
| `agent`   | ✓    | ✓     |        |        |        |
| `viewer`  | ✓    |       |        |        |        |
| `guest`   |      |       |        |        |        |

## Known Limitations

- The guard module validates shape and allowlist membership only — it does not verify that the caller actually holds the declared role (authentication is a future issue).
- `checkAccess` builds a `Set` on every call; callers checking access in a tight loop should pre-index the policy as `Map<role, Set<level>>` to avoid repeated construction.
- Size caps (`MAX_TEAM_SIZE=500`, `MAX_ATTACHMENT_COUNT=100`) are conservative starting values — adjust them in `access-guards.mjs` if product requirements change, and update the corresponding fixture `performanceLimits` object.

## Review

See `docs/threat-model.md` for the full attack-surface analysis and `docs/review-notes.md` for contributor scope and follow-up issues.
