# Beta Threat Model and Security-Control Ownership Map (BETA-076)

Issue: [#1983](https://github.com/anomalyco/opencode/issues/1983) · Status artifacts:
[control map](./beta-control-map.md) · [verification checklist](./beta-verification-checklist.md) ·
[risk register](./beta-risk-register.md)

This document models the **live beta system**: the deployed identity/auth API, encrypted-envelope
relay, managed storage, wallet linking, Soroban testnet contracts, and the deployment pipeline that
carries them. It exists so that every beta asset and trust boundary is mapped to a concrete control
with a named owner before outside users are invited.

Companion documents:

- Every threat below links to controls (`SC-xx`) in the [control map](./beta-control-map.md).
- Every control names its owner, category (code / infrastructure / operator procedure / accepted
  beta limitation), enforcement point, and automated verification.
- Unresolved critical risks live in the [risk register](./beta-risk-register.md) and block the
  release gate defined in [`docs/deployment/RELEASE_GATES.md`](../deployment/RELEASE_GATES.md);
  they are never absorbed into prose here.

---

## 1. Scope: the live beta stack

| Component           | Reality at time of writing                                                                                       | Key code / config                                                        |
| :------------------ | :--------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| Identity & auth API | Cloudflare Worker API: registration, sessions, signed-request auth (`STEALTH-AUTH-V1`), verification tokens      | `src/server/api/**`, `docs/security/api-authentication-v1.md`            |
| Encrypted relay     | Envelope submission/delivery coordination; insert-only envelope persistence; postage/receipt/policy services     | `src/server/api/envelope.ts`, `receipt-service.ts`, `postage-service.ts` |
| Managed storage     | KV (`STEALTH_KV`), R2 (`STEALTH_OBJECT_STORE`), Durable Object `StealthCoordinator`; manifest currently `memory` | `wrangler.jsonc`, `src/server/api/protocol.ts`                           |
| Wallet linking      | External Stellar wallet bound to an account via expiring signed challenges                                       | `src/server/api/wallet-link-service.ts`                                  |
| Client crypto       | AES-256-GCM envelopes, per-recipient key wrap (ECDH P-256 + HKDF + AES-GCM), Ed25519 signing, blinded recipients | `src/services/crypto/**`, `ALGORITHM_SUITE.md`                           |
| Chain contracts     | Soroban workspace: `policies`, `postage`, `receipts`, `lifecycle` on Stellar **testnet**                         | `contracts/soroban/**`                                                   |
| Deployment & CI     | Wrangler config generation with placeholder guard; Bun CI; cargo contract CI; provenance hash job                | `.github/workflows/ci.yml`, `scripts/generate-wrangler-config.ts`        |

Dependencies tracked by this issue: BETA-050 (#1957 two-user encrypted testnet round trip) and
BETA-075 (#1982 full two-user web experience). Sign-off of BETA-076 is blocked while either
dependency or a required release gate is incomplete — see the register's gate-status row.

## 2. Assets

| ID  | Asset                                              | Custody                         | Impact if compromised                             |
| :-- | :------------------------------------------------- | :------------------------------ | :------------------------------------------------ |
| A01 | User secret keys / seed phrases                    | Client device only              | Total identity compromise; catastrophic           |
| A02 | Session tokens / cookies                           | Client + server session store   | Account takeover within token lifetime            |
| A03 | Auth nonces + challenge records                    | Server (single-use, atomic)     | Replay of captured requests                       |
| A04 | Encrypted envelopes (ciphertext + wrapped keys)    | Relay/storage (ciphertext only) | None directly; metadata exposure if correlated    |
| A05 | Content-encryption keys (wrapped per recipient)    | Inside envelopes, ECDH-wrapped  | Message decryption if ECDH/wrap broken            |
| A06 | Communication metadata (timing, size, graph)       | Relay, chain, network observers | Privacy loss even with perfect content encryption |
| A07 | Postage escrow funds                               | Soroban `postage` contract      | Financial griefing or theft of escrowed value     |
| A08 | Delivery/read receipts                             | `receipts` contract + relay     | Social-graph and activity leakage                 |
| A09 | Contract admin/upgrade authority                   | Operator keys                   | Malicious contract logic for all users            |
| A10 | Verification tokens (email/account recovery)       | Server (SHA-256 hashed)         | Account pre-hijack via brute force                |
| A11 | Key directory records (published public keys)      | Server, versioned per owner     | MITM key substitution if poisoned                 |
| A12 | Deployment secrets (Cloudflare API tokens, KV IDs) | Operator console + CI secrets   | Full infrastructure takeover                      |
| A13 | Telemetry events                                   | Opt-in client analytics         | Behavioral profiling if identifiers leak          |

## 3. Trust boundaries

```
 TB6 external wallet          TB7 federation/key lookup
      │                              │
      ▼                              ▼
┌───────────────────────────────────────────────┐
│ TB1: user device / browser (trusted core)     │
│  seeds, private keys, plaintext               │
└───────────────┬───────────────────────────────┘
                │ TLS  (TB2: internet edge)
                ▼
┌───────────────────────────────────────────────┐
│ TB3: Cloudflare Worker edge                   │
│  auth, rate limits, CORS, relay routing       │
└───────┬───────────────────┬───────────────────┘
        │ TB4 internal      │ TB5 chain RPC
        ▼                   ▼
┌───────────────────┐  ┌─────────────────────┐
│ KV / R2 / Durable │  │ Soroban testnet     │
│ Object storage    │  │ contracts + ledger  │
└───────────────────┘  └─────────────────────┘
        ▲
        │ TB8 deploy path: operator console → wrangler → edge
```

| Boundary | Crossing                                  | Trust assumption                                        |
| :------- | :---------------------------------------- | :------------------------------------------------------ |
| TB1–TB2  | Device → browser client                   | Device integrity assumed out of scope (accepted limit.) |
| TB2–TB3  | Client ↔ Worker over TLS from any network | Untrusted: authenticate, throttle, validate everything  |
| TB3–TB4  | Worker ↔ KV/R2/DO                         | Cloudflare platform trust; isolation by bindings        |
| TB3–TB5  | Worker/operator ↔ Soroban RPC + testnet   | Untrusted chain; verify events, expect resets/reorgs    |
| TB6      | Browser extension wallet ↔ client page    | Semi-trusted: user approves; signature proof required   |
| TB7      | Client ↔ federation/key directory         | Untrusted directory: pin fingerprints, verify key IDs   |
| TB8      | Operator console/CI → production config   | Least privilege; no secrets in repo (placeholder guard) |

## 4. Actors

| Actor                              | Role in the model                                                               |
| :--------------------------------- | :------------------------------------------------------------------------------ |
| Beta user                          | Sends/receives encrypted mail; owns keys; links an external wallet              |
| Security owner                     | Owns this document, the control map, and the risk register; runs gate reviews   |
| Release manager                    | Runs the RELEASE_GATES runbook; blocks promotion on open critical risks         |
| Relay/storage operator             | Operates the Cloudflare deployment; executes migrations and rollback procedures |
| Contract owner                     | Deploys/upgrades Soroban contracts; owns wasm artifact hashes                   |
| External attacker                  | Network observer, spammer, credential stuffer, replay artist                    |
| Malicious beta user                | Enumerates recipients, floods mailboxes, griefs postage, probes auth            |
| Compromised infrastructure insider | Reads KV/R2/logs; sees only ciphertext and minimized metadata                   |
| External providers                 | Cloudflare (platform), Stellar testnet (chain), wallet vendors (TB6)            |

## 5. Threats and abuse cases

Severity reflects beta exposure (testnet funds are low-value; identity reputation is not).

| ID     | Boundary | Threat / abuse case                                                                             | Sev. | Controls                                       | Owner role      |
| :----- | :------- | :---------------------------------------------------------------------------------------------- | :--- | :--------------------------------------------- | :-------------- |
| TM-B01 | TB2/TB3  | Identity spoofing: stolen/replayed session tokens used against another account                  | High | SC-02 SC-03 SC-12                              | Identity Owner  |
| TM-B02 | TB2/TB3  | Replay of captured signed requests (route/body substitution variants R1–R5)                     | High | SC-02 SC-04                                    | Identity Owner  |
| TM-B03 | TB3      | Password/auth brute force and credential stuffing against registration/login                    | High | SC-05 SC-06                                    | Identity Owner  |
| TM-B04 | TB3      | Mailbox flooding / spam griefing of beta users                                                  | Med. | SC-06 SC-21                                    | Relay Owner     |
| TM-B05 | TB3/TB4  | Envelope tampering, injection, or duplicate/conflicting writes during delivery                  | High | SC-01 SC-08 SC-09 SC-11                        | Relay Owner     |
| TM-B06 | TB3      | Recipient enumeration via probing wrapped-key entries or directory lookups                      | Med. | SC-08 (blinded IDs) SC-14                      | Crypto Owner    |
| TM-B07 | TB2–TB5  | Metadata leakage: timing correlation, ciphertext size analysis, social-graph mapping            | Med. | SC-14 + padding rules (see §7); residual RR-03 | Privacy Owner   |
| TM-B08 | TB6      | Custody risk: phishing a user into linking an attacker-controlled wallet; stale challenge reuse | High | SC-15 (challenge proof)                        | Wallet Owner    |
| TM-B09 | TB7      | Key-directory poisoning: substituting a published recipient public key to intercept future mail | High | SC-16 (versioned keys, fingerprint pinning)    | Key Dir. Owner  |
| TM-B10 | TB5      | Chain replay/double-spend: receipt or postage transition replayed across contracts/networks     | Med. | SC-17 SC-18                                    | Contract Owner  |
| TM-B11 | TB5/TB8  | Contract upgrade misuse: malicious wasm deployed under admin authority                          | High | SC-19 SC-20                                    | Contract Owner  |
| TM-B12 | TB4      | Storage breach: insider/cloud compromise reads stored envelopes                                 | Med. | SC-01 SC-09 SC-11 (ciphertext-only store)      | Storage Owner   |
| TM-B13 | TB8      | Supply-chain: malicious dependency or build artifact enters the client bundle                   | High | SC-22 SC-23                                    | Release Manager |
| TM-B14 | TB8      | Secret leakage: real resource IDs/tokens committed to the repository or bundled into artifacts  | High | SC-24 SC-25                                    | Deploy Owner    |
| TM-B15 | TB3      | Verification-token brute force on account recovery flows                                        | Med. | SC-12 SC-05                                    | Identity Owner  |
| TM-B16 | TB1      | Device compromise exposes seeds/plaintext/draft caches                                          | High | Accepted limitation AL-01 (out of scope)       | Product Owner   |
| TM-B17 | TB5      | Testnet instability/reset invalidates receipts/postage state mid-beta                           | Low  | Accepted limitation AL-02                      | Contract Owner  |

### 5.1 Abuse-case walkthroughs (denial paths proven by tests)

Each critical threat above must link to a _demonstrated_ denial, not just a claim. The
[verification checklist](./beta-verification-checklist.md) exercises:

- **TM-B02** — tampered/route-substituted signed requests fail closed
  (`tests/unit/api/auth/*`, executable vectors in `test-fixtures/auth/signed-request-v1.json`).
- **TM-B03/TM-B15** — throttles deny after threshold and delay grows exponentially
  (`tests/unit/security/beta-controls.test.ts`, "auth-failure throttle" section).
- **TM-B04** — weighted quotas exhaust and return denial with `retryAfterSeconds`
  (`tests/unit/security/beta-controls.test.ts`, "operation quota" section).
- **TM-B05** — AEAD tamper matrix fails closed (`tests/unit/crypto/tamper-matrix*`) and conflicting
  envelope inserts are rejected (insert-only persistence).
- **TM-B08** — expired/mismatched-address/network challenges fail closed (`wallet-link-service.ts`).
- **TM-B10** — authorization-boundary snapshots reject unauthorized contract callers
  (`contracts/soroban/*/test_snapshots/auth_boundaries/`).

## 6. Custody risk (managed wallet)

The beta does not custody user funds or seeds. Custody surfaces are:

1. **Client-held identity keys (A01).** Seeds are generated and stored client-side; servers receive
   only public material. Loss of device = loss of identity; there is no server-side recovery.
   This is accepted limitation **AL-01** for beta and must be disclosed to users.
2. **Linked external wallets (TB6).** Binding requires a fresh random challenge (32 bytes,
   5-minute expiry) signed inside the wallet, with address and network binding enforced before the
   link is stored. Risks remain: user approves a malicious signature request (phishing), or the
   wallet vendor itself is compromised (out of scope, disclosed).
3. **Postage escrow (A07).** Funds locked in the `postage` contract follow deterministic state
   transitions snapshot-tested in `contracts/soroban/postage`; refund paths are part of the
   rollback rehearsal in the checklist.
4. **Operator custody (A09/A12).** Contract admin keys and Cloudflare credentials follow
   least-privilege separation documented in `docs/deployment/SECRETS.md`; no operator step may
   bypass the repository-side checklist in the verification checklist.

## 7. Metadata leakage

Full inventory and policy: [`metadata-policy.md`](./metadata-policy.md). Beta-relevant summary:

| Observer         | Sees                                                           | Standing control                          | Residual                          |
| :--------------- | :------------------------------------------------------------- | :---------------------------------------- | :-------------------------------- |
| Network observer | Connection timing, sizes, endpoints                            | TLS; client padding rule (policy §2.C)    | Timing correlation (RR-03)        |
| Relay operator   | Ciphertext, wrapped keys, blinded recipient IDs, source IP     | Header scrubbing; log scrub rules (§2.E)  | IP + timing until 1h log sweep    |
| Storage backend  | Ciphertext envelopes, folder labels                            | Client-side encryption; retention purge   | Size/folder metadata              |
| Soroban ledger   | Sender/recipient addresses, hashes, timestamps, escrow amounts | On-chain address rule (§3); stealth addrs | Graph linkage if addresses reused |
| Analytics        | Opt-in minimal events                                          | Blocklist + budget cap + 30d retention    | Coarse operational telemetry      |

## 8. Chain-specific threats (Stellar/Soroban testnet)

- **Replay across contexts (TM-B10).** Receipts and postage transitions are keyed by unique
  `message_id`s; authorization boundaries are snapshot-tested
  (`contracts/soroban/*/test_snapshots/auth_boundaries/`). Network mismatch is additionally
  rejected in wallet-link verification.
- **Upgrade/admin abuse (TM-B11).** Only pinned wasm builds recorded in the RELEASE_GATES artifact
  tables may be promoted; the provenance CI job publishes SHA-256 sums; upgrades require the
  irreversible-change decision point in the runbook.
- **Testnet reset (TM-B17).** Accepted limitation **AL-02**: chain state can vanish independently
  of off-chain state; reconciliation surfaces pending sync rather than failing silently.
- **Griefing via escrow spam (part of TM-B04).** Weighted payment-transition rate-limit costs make
  escrow churn expensive at the edge before it reaches the chain.

## 9. Control assignment summary

Controls are classified as exactly one of: **code**, **infrastructure**, **operator procedure**, or
**accepted beta limitation**. The authoritative registry — one row per control with owner role,
enforcement point, and its automated verification — is the
[control map](./beta-control-map.md). Accepted limitations are restated here because they are part
of the security posture, not gaps in it:

| ID    | Accepted beta limitation                                              | Disclosure duty                    |
| :---- | :-------------------------------------------------------------------- | :--------------------------------- |
| AL-01 | No server-side key recovery; device loss = identity loss              | Beta onboarding copy + support doc |
| AL-02 | Testnet resets can invalidate chain-linked state                      | Status page / release notes        |
| AL-03 | Manifest reports non-durable memory adapter by default (see RR-01)    | Blocks production promotion        |
| AL-04 | Gitleaks job is conditional on license secret; local scan compensates | Checklist P0 item VC-P0-8          |

## 10. Acceptance scenarios

1. **Every live beta component has an owner and explicit trust boundary.** §3 boundaries +
   ownership column in the control map cover identity, wallet, relay, storage, contracts, deploy.
2. **Critical threats link to implemented controls and executable tests.** §5 table maps each
   High-severity threat to controls whose verification rows point at real test files/commands;
   §5.1 lists the proven denial paths.
3. **Unresolved critical risks block the release gate rather than hiding in prose.**
   `RR-01` is registered as production-blocking and wired into the Production Promotion Gates of
   [`RELEASE_GATES.md`](../deployment/RELEASE_GATES.md); sign-off requires the register reviewed
   and either cleared or explicitly accepted by the security owner.
