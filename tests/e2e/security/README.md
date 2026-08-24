# Security Regression Suite — Workflow 4 (BETA-084 / #1991)

## Purpose

This directory contains the end-to-end **security regression suite** for Stealth account isolation.
It deliberately mounts cross-account and privilege-escalation attacks across every sensitive resource
class and proves that Alice can never read or mutate Bob's data, and vice versa.

This is **Workflow 4** in the BETA release sequence:

- Workflow 2 (`live-beta/workflow2.test.ts`) — Protocol, Relay & Testnet Delivery
- Workflow 3 (`live-beta/workflow3.test.ts`) — Real Web Mail Experience
- **Workflow 4 (`security/workflow4.security.test.ts`) — Security Regression & Account Isolation ← THIS**

---

## Actors

| Actor           | Role                                    | Address Form |
| --------------- | --------------------------------------- | ------------ |
| Alice (`GAAA…`) | Legitimate resource owner               | Canonical    |
| Bob (`GBBB…`)   | Attacker (cross-account access attempt) | Canonical    |
| Carol (`GCCC…`) | Third party (relay queue isolation)     | Canonical    |
| Dave (`GDDD…`)  | Privilege escalation / delegation tests | Canonical    |

---

## Attack Classes Covered

| #   | Class                                    | Resources                                        |
| --- | ---------------------------------------- | ------------------------------------------------ |
| 1   | **IDOR — read isolation**                | drafts, contacts, wallets, requests, sessions    |
| 2   | **IDOR — mutation isolation**            | policy, postage, receipts, mail, attachments     |
| 3   | **CSRF — forged origin**                 | policy PUT, postage, receipt publish             |
| 4   | **Session replay / nonce reuse**         | relay submit, postage settle                     |
| 5   | **Stale authorization**                  | expired + revoked delegations                    |
| 6   | **Canonicalization / alt-address forms** | padding, lowercase, trailing whitespace          |
| 7   | **Admin privilege escalation**           | DLQ, jobs routes                                 |
| 8   | **Envelope cross-account decryption**    | AES-GCM key wrap — wrong key → OpenEnvelopeError |
| 9   | **Relay queue IDOR**                     | recipient address isolation                      |
| 10  | **Attachment key isolation**             | cross-account key derivation separation          |

---

## CI Execution

All tests in this directory run in **local-fake mode** by default — no network, no secrets.
This mode is always executed in CI as part of the standard `bun run test` unit step.

```bash
# Run all unit tests (includes this suite via vitest)
bun run test

# Run the security suite in isolation
bun x vitest run tests/e2e/security/workflow4.security.test.ts
```

### Live Mode (Operator-Triggered)

To run against the deployed beta stack:

```bash
STEALTH_LIVE_TEST=1 \
  STEALTH_ALICE_SECRET=<redacted> \
  STEALTH_BOB_SECRET=<redacted> \
  STEALTH_RELAY_ENDPOINT=https://your-relay.example.com/api/v1/relay/messages \
  bun x vitest run tests/e2e/security/workflow4.security.test.ts
```

> **NEVER commit live credentials to this file or any other file in this repository.**
> Use environment variables only. The run-report sanitizer strips any field containing
> `secret`, `private`, `plaintext`, `body`, `password`, or `seed`.

---

## Evidence & Redaction Contract

The `run-report.json` file in this directory is written by the live test run.
It is committed as a baseline evidence artifact for the PR.

Fields guaranteed to be **absent** from the report:

- Private keys or secrets
- Plaintext message bodies
- Passwords, seeds, or tokens

Fields **present** in the report:

- Timestamp and network identifier
- Message IDs (random 32-byte hex correlation handles)
- Transaction hashes (on-chain, non-secret)
- Step pass/fail status and classification

---

## Control Owner Classification

Each test is tagged with the responsible control owner (the team/layer that owns the enforcement):

| Control                       | Owner                                                   |
| ----------------------------- | ------------------------------------------------------- |
| API route authorization       | `api/actor.ts` → `authorizeResourceOwner`               |
| Intent signing                | `api/authorization/intents.ts` → `validateIntent`       |
| Relay queue isolation         | `services/relay/relay-service.ts` → `getRecipientQueue` |
| Envelope decryption isolation | `services/crypto/open-envelope.ts` → `openEnvelope`     |
| Attachment key isolation      | `services/crypto/attachment-stream.ts` → key derivation |
| Admin route access control    | `routes/api/v1/admin/*` → handler-level check           |

---

## Files

| File                         | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `workflow4.security.test.ts` | Main Workflow 4 security regression suite                   |
| `attack-fixtures.ts`         | Stable, deterministic fixture factory (no real credentials) |
| `run-report.json`            | Redacted evidence from the most recent live run             |
| `README.md`                  | This file                                                   |
