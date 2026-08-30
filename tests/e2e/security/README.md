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

---

# BETA-085 — Cryptography & Managed-Wallet Misuse Resistance

Issue **#1992** · Workflow 4 — Security, Operations & Beta Launch

## Definition of done checklist

| Requirement                                                   | Status | Evidence                                                                |
| ------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| Key exfiltration / tampered wrapped keys / wrong version      | Done   | `tests/unit/crypto/misuse-resistance.test.ts`                           |
| Revoked recipients fail closed                                | Done   | `misuse-resistance.test.ts` + `sendRecipientValidation.test.ts`         |
| Signature substitution / nonce reuse                          | Done   | `tamper-matrix.test.ts`, `nonce.test.ts`, `security.regression.test.ts` |
| Memory cleanup on failure paths                               | Done   | `misuse-resistance.test.ts`, `secret-buffer.test.ts`                    |
| Bounded parser fuzz (envelope, directory, attachment, intent) | Done   | `tests/unit/crypto/fuzz.test.ts`                                        |
| Client API cannot request raw signing or arbitrary XDR        | Done   | `tests/unit/crypto/api-surface.test.ts`                                 |
| Managed-wallet XDR binding per intent type                    | Done   | `tests/unit/stellar/managed-wallet.test.ts`                             |
| Colocated crypto service tests in CI                          | Done   | `src/services/crypto/*.test.ts` in `beta-security` job                  |
| Reproducible regression fixtures                              | Done   | `tests/fixtures/crypto-misuse-corpus.json`                              |
| Redacted secrets in all output                                | Done   | `assertNoSecretsLeaked()` in BETA-085 suites                            |
| CI crypto gate                                                | Done   | `beta-security` job in `.github/workflows/ci.yml`                       |
| Live-beta success + denial evidence                           | Done   | `tests/e2e/live-beta/crypto-misuse-evidence.test.ts`                    |
| Operator repeatable command                                   | Done   | `bun run crypto:misuse-regression` → `gate-result-beta-085-crypto.json` |

## Attack classes

| Attack                   | Test file                                       | Control owner             |
| ------------------------ | ----------------------------------------------- | ------------------------- |
| Key exfiltration         | `misuse-resistance.test.ts`                     | `managed-wallet-envelope` |
| Tampered wrapped keys    | `misuse-resistance.test.ts`, `key-wrap.test.ts` | `key-wrap`                |
| Wrong master key version | `misuse-resistance.test.ts`                     | `managed-wallet-envelope` |
| Revoked recipient        | `misuse-resistance.test.ts`                     | `sendRecipientValidation` |
| Arbitrary XDR signing    | `managed-wallet.test.ts`                        | `managed-wallet`          |
| Client raw-sign API      | `api-surface.test.ts`                           | `api/clients`             |
| Parser confusion / fuzz  | `fuzz.test.ts`                                  | `schema` / `intents`      |

## Evidence artifacts

| File                                                | Purpose                                    |
| --------------------------------------------------- | ------------------------------------------ |
| `tests/e2e/live-beta/crypto-misuse-run-report.json` | Redacted local-fake misuse steps           |
| `gate-result-beta-085-crypto.json`                  | Operator crypto misuse regression evidence |
| `gate-result-beta-security.json`                    | CI gate result from `beta-security` job    |

## Run commands

```bash
# BETA-085 crypto misuse suites
bun x vitest run tests/unit/crypto/misuse-resistance.test.ts tests/unit/crypto/fuzz.test.ts tests/unit/crypto/api-surface.test.ts
bun x vitest run tests/unit/stellar/managed-wallet.test.ts
bun x vitest run src/services/crypto/*.test.ts
bun run test:beta:security:live

# Operator full crypto misuse regression + evidence artifact
bun run crypto:misuse-regression

# Full beta-security gate (same as CI)
bun run test:beta:security
```

## BETA-085 dependencies

- BETA-016 (#1923) — envelope encryption and key rotation
- BETA-017 (#1924) — managed-wallet transaction signer with policy controls
- BETA-027 (#1934) — versioned encryption-key directory
- BETA-046 (#1953) — recipient key-fetch and sealing pipeline
- BETA-047 (#1954) — recipient envelope verification and safe rendering
