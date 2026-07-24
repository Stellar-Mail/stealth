# Relay Request Authentication and Replay Protection

Status: proposed
Scope: `protocol` (relay request authentication, replay protection)
Related: `protocol/messages/envelope_spec.md`, `protocol/relay/README.md`

## 1. Motivation

TLS protects a request in transit but does **not** prevent a captured, valid
request from being replayed across time or across relays. A single signed
envelope can be submitted to many relays, or resubmitted after a transient
failure, producing duplicate deliveries or forged-at-relay attacks. This
document defines the canonical, signed relay request and the mechanisms that
make replays detectable and idempotent.

## 2. Threat model

- **R1 — Cross-relay replay.** An attacker captures a valid signed request and
  replays it to a second relay after the first accepted it.
- **R2 — Temporal replay.** An attacker replays a captured request far in the
  future (after the originating client is gone).
- **R3 — Duplicate delivery.** A benign retry (network timeout) causes the same
  logical request to be delivered twice.
- **R4 — Audience confusion.** A request signed for relay A is replayed against
  relay B, which accepts it because it only checks the envelope signature.
- **R5 — Clock skew.** Honest clients and relays disagree on "now", causing
  legitimate requests to be rejected or stale ones to be accepted.

## 3. Canonical signed request

A relay request is the envelope payload (per `envelope_spec.md`) extended with
four anti-replay fields:

```json
{
  "version": "v1",
  "sender": "GBBB...",
  "recipient": "GCCC...",
  "timestamp": "2026-06-17T22:00:00Z",
  "encryption_metadata": { "...": "..." },
  "content_commitment": "5b40cf39...",
  "attachments": [],

  "request_nonce": "a1b2c3d4e5f6...",
  "audience": "relay:us-east-1.stealth.test",
  "idempotency_key": "idem-9f8e7d6c5b4a",
  "replay_window_seconds": 300
}
```

All four new fields are **mandatory** for relay submission. They are included in
the canonical (JCS) serialization that is signed, so a tamperer cannot strip or
alter them without invalidating the signature.

| Field                   | Type                | Purpose                                                |
| ----------------------- | ------------------- | ------------------------------------------------------ |
| `request_nonce`         | 16+ byte random hex | Binds a specific relay submission; unique per attempt. |
| `audience`              | string              | Names the intended relay/authority; prevents R4.       |
| `idempotency_key`       | string              | Stable client-chosen key; drives dedup (R3).           |
| `replay_window_seconds` | integer             | Client-stated freshness window; clamped server-side.   |

## 4. Signature coverage

The Ed25519 signature covers `jcs(payload)` exactly as today, but the payload
**now includes** the four anti-replay fields. No separate signature is added;
the envelope signature is the request authenticator. This keeps a single
verification path.

```
signature = sign(private_key, jcs(payload))
```

## 5. Server-side validation (fail closed)

A relay MUST reject a request that fails any step:

1. **Signature** — verify Ed25519 over `jcs(payload)`; reject `INVALID_SIGNATURE`.
2. **Audience** — `audience` MUST equal the relay's configured authority id;
   reject `AUDIENCE_MISMATCH`.
3. **Freshness** — `now - timestamp` MUST be within
   `[0, min(replay_window_seconds, MAX_REPLAY_WINDOW)]`; reject
   `STALE_REQUEST` (too old) or `FUTURE_REQUEST` (too far ahead, clock skew).
4. **Nonce uniqueness** — `request_nonce` MUST NOT already be recorded; reject
   `REPLAY_DETECTED`.
5. **Idempotency** — if `idempotency_key` was seen with a completed result,
   return the original stored response with header `x-idempotency-replayed:
true` and HTTP 200/201 (never re-execute).

Order is significant: signature and audience are cheap and run first; nonce and
idempotency checks run against the recorded state.

## 6. Replay window and clock skew

- `MAX_REPLAY_WINDOW` is a server constant (default **300s**).
- A request whose `replay_window_seconds` exceeds `MAX_REPLAY_WINDOW` is
  **clamped** to the maximum; the client's stated window is never trusted to
  widen the server's bound.
- `FUTURE_REQUEST` is allowed only within `CLOCK_SKEW_TOLERANCE` (default **30s**)
  to absorb honest clock drift (R5).
- A nonce is retained for `MAX_REPLAY_WINDOW + CLOCK_SKEW_TOLERANCE` after first
  seen, then evicted.

## 7. Negative vectors (conformance)

The conformance suite (`tests/unit/protocol/relay-auth-replay.test.ts`) MUST
reject, at minimum:

- `replay/cross-relay` — valid signature but `audience` names a different relay.
- `replay/stale` — `timestamp` older than the window.
- `replay/future` — `timestamp` ahead beyond skew tolerance.
- `replay/duplicate-nonce` — same `request_nonce` submitted twice.
- `replay/tampered-nonce` — signature valid but `request_nonce` altered after
  signing (canonicalization catches this).
- `replay/missing-fields` — any mandatory anti-replay field absent
  (`INVALID_REQUEST`).

## 8. Stable errors

| Code                | HTTP | Meaning                                      |
| ------------------- | ---- | -------------------------------------------- |
| `INVALID_SIGNATURE` | 401  | Envelope signature fails verification.       |
| `AUDIENCE_MISMATCH` | 403  | `audience` does not match this relay.        |
| `STALE_REQUEST`     | 400  | `timestamp` older than allowed window.       |
| `FUTURE_REQUEST`    | 400  | `timestamp` too far in the future.           |
| `REPLAY_DETECTED`   | 409  | `request_nonce` already recorded.            |
| `INVALID_REQUEST`   | 400  | Mandatory anti-replay field missing/invalid. |

## 9. Success signal

Conformance tests reject every replay variant in §7 using the reference
verifier in `src/services/crypto/relayAuth.ts`, driven by
`protocol/vectors/relay-auth-replay.json`.
