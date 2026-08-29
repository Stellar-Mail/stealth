# BETA-005 :: Verification Token Lifecycle and Pluggable Delivery Adapter

> **Workflow 1 — Identity, Access & Beta Foundation**  
> **Security Standard**: Non-Plaintext Credential Storage & Replay Protection  
> **Dependencies**: #1911 (BETA-004)

---

## 1. Overview & Goal

To secure account signup and activation without relying on external proprietary SaaS vendors (such as Resend), the repository implements a self-contained, cryptographically secure verification-token lifecycle and pluggable delivery architecture.

---

## 2. Core Security Invariants

1. **Non-Plaintext Storage**:
   - Plaintext tokens ($256$ bits of entropy generated via `crypto.getRandomValues`) are handed directly to the delivery adapter and are **never** persisted to disk, database, cache, or response logs.
   - Only the SHA-256 hash (`tokenHash`) is indexed and stored in the repository (`verificationTokenSchema`).

2. **Single-Use & Atomic Consumption**:
   - Verification attempts execute atomically within storage transactions.
   - A token can be consumed exactly once. Replay attempts are rejected with `reused` error codes.

3. **Replacement on Resend**:
   - When a user triggers a resend, the existing active token is atomically marked as `replaced` before the new token is issued, preventing multiple valid tokens from existing simultaneously.

4. **Rate Limiting & Cooldowns**:
   - **Resend Cooldown**: 60 seconds minimum interval between token generation requests (`DEFAULT_VERIFICATION_POLICY.resendCooldownMs`).
   - **Brute-Force Protection**: Capped at 5 maximum failed attempts (`DEFAULT_VERIFICATION_POLICY.maxAttempts`) before the token is permanently invalidated.
   - **Lifetime Expiry**: 24-hour default expiration (`DEFAULT_VERIFICATION_POLICY.tokenLifetimeMs`).

---

## 3. Pluggable Delivery Adapters

The delivery abstraction supports multiple decoupled backend transports without vendor lock-in:

- **Self-Hosted SMTP Adapter** (`src/services/notifications/smtp.ts`):
  - Connects to self-hosted or standard TLS/STARTTLS SMTP relays with pooled connection reuse.
- **Local Development Capture Sink** (`src/services/notifications/sink.ts`):
  - Captures verification links and emails in an in-memory / local sink for rapid deterministic testing without outbound internet connectivity.

---

## 4. Endpoints & Audit Trail

| Endpoint                           | Method | Purpose                               | Rate Limit               |
| :--------------------------------- | :----- | :------------------------------------ | :----------------------- |
| `/api/v1/auth/verify`              | `POST` | Consume token and activate account    | 5 attempts / IP / window |
| `/api/v1/auth/resend-verification` | `POST` | Invalidate previous & issue new token | 60s cooldown             |

All actions record structured audit events referencing the SHA-256 token hash to maintain forensic observability without leaking sensitive credentials.
