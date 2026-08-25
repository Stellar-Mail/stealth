# BETA-084 — Account Isolation Security Regression Suite

Issue **#1991** · Workflow 4 — Security, Operations & Beta Launch

## Definition of done checklist

| Requirement                                             | Status | Evidence                                                                           |
| ------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| IDOR matrix across all sensitive resources              | Done   | `tests/unit/api/security/account-isolation.matrix.test.ts`                         |
| Attachments cross-account denial                        | Done   | `tests/unit/api/security/attachment-routes.security.test.ts`                       |
| Wallets actor-scoped                                    | Done   | `tests/unit/api/security/wallet-routes.security.test.ts`                           |
| Session fixation / stale auth / CSRF / canonicalization | Done   | `tests/unit/api/security/session-attacks.test.ts`                                  |
| Replay / signature binding                              | Done   | `tests/unit/api/security.regression.test.ts` (STEALTH-AUTH-V1 on mutating HTTP)    |
| Admin privilege escalation                              | Done   | `tests/unit/api/security/admin-routes.security.test.ts` (`requireAdmin` allowlist) |
| Redacted secrets in all output                          | Done   | `assertNoSecretsLeaked()` in every suite                                           |
| Control owner per failure                               | Done   | See matrix below + `scripts/security/run-regression.mjs`                           |
| CI with stable fixtures                                 | Done   | `beta-security` job in `.github/workflows/ci.yml`                                  |
| Live-beta path evidence                                 | Done   | `tests/e2e/live-beta/security-isolation.test.ts` → `security-run-report.json`      |
| Operator repeatable command                             | Done   | `bun run security:regression`                                                      |
| Artifact secret scan                                    | Done   | `scripts/ci/scan-artifacts-for-secrets.mjs` (via regression runner)                |

## Coverage matrix

| Resource                   | Unit test                                                              | Notes                       |
| -------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| Profiles                   | `account-isolation.matrix.test.ts`                                     | Actor-scoped                |
| Sessions                   | `session-attacks.test.ts`                                              | Isolation, fixation, logout |
| Wallets (managed + linked) | `wallet-routes.security.test.ts`, `account-isolation.matrix.test.ts`   | Actor-scoped                |
| Contacts                   | `account-isolation.matrix.test.ts` + `contact-routes.test.ts`          | Actor-scoped CRUD           |
| Onboarding drafts          | `account-isolation.matrix.test.ts`                                     | Session-bound               |
| Compose drafts             | `account-isolation.matrix.test.ts`                                     | Actor-bound                 |
| Mail                       | `account-isolation.matrix.test.ts` + `mailbox-*.test.ts`               | Recipient-scoped            |
| Attachments                | `attachment-routes.security.test.ts`                                   | Object-store owner binding  |
| Requests                   | `account-isolation.matrix.test.ts`                                     | Recipient-scoped decisions  |
| Policy                     | `account-isolation.matrix.test.ts` + `policy-routes.security.test.ts`  | Owner-bound                 |
| Postage                    | `account-isolation.matrix.test.ts`                                     | Recipient-bound settle      |
| Receipts                   | `account-isolation.matrix.test.ts` + `receipt-routes.security.test.ts` | Role-bound                  |
| Admin                      | `admin-routes.security.test.ts`                                        | `requireAdmin` allowlist    |

## Attack classes

| Attack                                 | Test file                          | Status   | Control owner                           |
| -------------------------------------- | ---------------------------------- | -------- | --------------------------------------- |
| IDOR / cross-account                   | `account-isolation.matrix.test.ts` | Enforced | `api-authorization`                     |
| Session fixation                       | `session-attacks.test.ts`          | Enforced | `session-service`                       |
| Stale authorization                    | `session-attacks.test.ts`          | Enforced | `api-auth`                              |
| Canonicalization                       | `session-attacks.test.ts`          | Enforced | `api-auth`                              |
| CSRF (unauthenticated mutating routes) | `session-attacks.test.ts`          | Enforced | `session-service`                       |
| Forged actor headers                   | `security.regression.test.ts`      | Enforced | `signed-request` (STEALTH-AUTH-V1 HTTP) |
| Replay / signature binding             | `security.regression.test.ts`      | Enforced | `signed-request` (STEALTH-AUTH-V1 HTTP) |
| Admin privilege escalation             | `admin-routes.security.test.ts`    | Enforced | `admin-platform`                        |

## Run commands

```bash
# Full unit security regression
bun run test:security

# Live-beta local-fake evidence (writes security-run-report.json)
bun run test:security:live

# Operator full regression + evidence artifact
bun run security:regression

# E2E cross-account API probes (Playwright + dev server)
bun run test:e2e tests/e2e/security/

# Scan build artifacts for secrets
node scripts/ci/scan-artifacts-for-secrets.mjs --dir dist
```

## CI

The `beta-security` job runs:

1. Crypto & managed-wallet misuse tests
2. `bun run test:security` (account isolation matrix + existing security suites)
3. `tests/e2e/live-beta/security-isolation.test.ts` (evidence report)

Mutating HTTP API routes require STEALTH-AUTH-V1 signed requests (`authenticateSignedRequest` via `getApiContext`). The non-production header-only escape hatch is opt-in (`STEALTH_AUTH_ALLOW_HEADER_ONLY=1`) and disabled under `STEALTH_AUTH_REQUIRE_SIGNED=1` or production builds. Admin-platform authorization is enforced via `STEALTH_ADMIN_ADDRESSES`.

## Evidence artifacts

| File                                           | Purpose                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `tests/e2e/live-beta/security-run-report.json` | Redacted local-fake run steps (generated by tests)                |
| `gate-result-beta-084-security.json`           | Operator regression evidence (generated by `security:regression`) |
| `gate-result-beta-security.json`               | CI gate result from `beta-security` job                           |

## Redaction

All tests use `assertNoSecretsLeaked()` from `tests/fixtures/identity.ts`. The regression runner and live-beta report writer redact passwords, Stellar secret keys, and session tokens before writing artifacts.

## Dependencies

- BETA-025 (#1932) — two-user identity acceptance
- BETA-050 (#1957) — encrypted testnet round trip
- BETA-075 (#1982) — two-user web experience
- BETA-078 (#1985) — production cookies, CORS, CSP

Signed-request HTTP enforcement is required on mutating routes in production builds. Keep the header-only escape hatch out of release environments.
