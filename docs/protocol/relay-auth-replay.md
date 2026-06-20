# Relay Request Authentication and Replay Protection

This document defines a canonical signed request format, nonce and timestamp handling, audience binding, idempotency keys, clock skew, stable errors, and recommended conformance tests for relays.

## Goals

- Prevent cross-relay replay
- Ensure duplicate delivery is idempotent
- Define a clear replay window and handling
- Document negative vectors and error behaviors

## Threat Model

- Adversary can capture valid TLS-encrypted requests and attempt to replay them later, or via different relays.
- Adversary may attempt to modify fields to bypass protections.
- Relay servers may be untrusted or compromised.

## Actors

- Client: originator of requests to be relayed
- Relay: intermediary that forwards signed requests to recipients
- Recipient: final service that processes requests
- Clock: system clocks on Relay and Recipient (may skew)

## Canonical Signed Request

A signed request includes the following top-level fields (JSON object):

- `method`: HTTP method (e.g., "POST")
- `path`: request path (e.g., "/v1/messages")
- `query`: canonicalized query string or null
- `headers`: canonicalized headers object (subset used for signing)
- `body_hash`: base64url-encoded hash of the body (e.g., SHA-256)
- `created_at`: RFC3339 timestamp in UTC
- `expires_at`: RFC3339 timestamp in UTC (optional; recommended)
- `nonce`: random unique string (see Nonce rules)
- `aud`: audience string binding (recipient identifier)
- `idempotency_key`: client-supplied idempotency identifier (optional)

Signature is performed over the UTF-8 encoded canonical JSON with deterministic object ordering (lexicographic on keys) using an asymmetric key (e.g., Ed25519 or ECDSA P-256). The signature metadata must include the signer key id (`kid`) and algorithm.

Signed envelope example:

{
"payload": { ...canonical fields above... },
"signature": "base64url(...)",
"kid": "client-key-id",
"alg": "Ed25519"
}

Recipients MUST reject requests without a valid signature.

### Canonicalization rules

- JSON keys sorted lexicographically
- Strings normalized to NFC
- `headers` includes only signed headers; header names lowercased; multiple values concatenated with `,` per RFC7230
- `query` sorted by parameter name then value
- `body_hash` computed over the raw bytes of the request body using SHA-256 and base64url-encoded without padding

## Nonce and Timestamp Handling

- `nonce` MUST be at least 16 bytes of cryptographically secure random data, base64url-encoded.
- Recipients MUST store seen (`nonce`, `kid`) tuples for the duration of the replay window to prevent duplicates across relays.
- `created_at` MUST be present. `expires_at` is RECOMMENDED but optional; if present, it constrains lifetime.
- Replay window: default 2 minutes (configurable). Recipient accepts requests where `now` is within `[created_at - skew, created_at + replay_window]` where `skew` is configured clock skew allowance (default 30s).
- Clock skew: clocks are allowed ±30 seconds by default. Recipients SHOULD be configurable to accept larger skew in special cases.

Behavior:

- If `created_at` is more than `skew` in the future, reject with `400` and `error="invalid_timestamp"`.
- If `created_at` is older than `replay_window + skew`, reject with `400` and `error="replay_detected"`.
- If `nonce` has been seen for the same `kid`, reject with `409` and `error="nonce_replay"`.

## Audience Binding

- `aud` binds the request to a specific recipient or recipient set. It MUST be a globally unique identifier (e.g., URI or DID) representing the intended recipient service.
- Recipient MUST verify `aud` matches its identity or an acceptable audience list. Otherwise reject with `403` and `error="invalid_audience"`.

## Idempotency and Duplicate Delivery

- `idempotency_key` allows clients to indicate requests that are safe to deduplicate. It SHOULD be a UUIDv4 or comparable random identifier.
- Recipient MUST maintain an idempotency store keyed by (`kid`, `idempotency_key`) returning the same response for duplicate requests received within a configured retention window (default 24h).
- For requests without `idempotency_key`, recipient MAY deduplicate by (`kid`,`nonce`) or rely on application-level semantics.
- When returning cached responses for idempotent requests, the recipient MUST include `X-Idempotency-Replayed: true` and the original response timestamp.

## Cross-Relay Replay Prevention

- Since signature covers `aud`, `nonce`, `created_at`, and `body_hash`, a captured envelope replayed via another relay will be detected by the recipient because the `nonce` is stored globally by recipient, not scoped to a relay.
- Recipients MUST not accept the same (`kid`,`nonce`) pair twice.
- Recipients SHOULD persist nonce tuples in a distributed store or a local store that is resilient across restart for at least the `replay_window`.

## Stable Error Codes

- `400`: invalid request or timestamp; `error` tokens: `invalid_signature`, `invalid_timestamp`, `expired`, `bad_canonicalization`
- `401`: authentication failed; `error`: `invalid_signature`, `unknown_kid`
- `403`: audience mismatch; `error`: `invalid_audience`
- `409`: nonce replay detected; `error`: `nonce_replay`, `idempotency_conflict`
- `429`: rate limits
- `5xx`: server error

Errors MUST be stable and machine-parseable using a JSON response with fields: `error`, `error_description`, `error_details`.

Example:

HTTP/1.1 409 Conflict
Content-Type: application/json

{ "error":"nonce_replay", "error_description":"nonce already seen for this key","error_details":{}}

## Negative Vectors

- Replay via different relay: prevented by nonce+recipient storage.
- Replay with modified `aud` or `expires_at`: signature invalid unless attacker controls signing key.
- Timestamp tampering: signature invalid unless attacker signs; clock skew allows small offsets.
- Nonce forgery for same `kid`: if signer reuses nonce, duplicates will be rejected; recommend cryptographic generation.
- Loss of nonce store: if recipient restarts and loses nonce state, replays may be accepted. Mitigation: persistent distributed store, or short replay window.

## Conformance Tests (Suggested)

1. Reuse same envelope within replay window → expect `409` or idempotent response.
2. Replay after `replay_window` → expect `400`/`replay_detected`.
3. Modify body but keep signature (invalid) → expect `401`/`invalid_signature`.
4. Replay via different relay → expect `409`/`nonce_replay`.
5. Future `created_at` beyond `skew` → expect `400`/`invalid_timestamp`.
6. Valid idempotent duplicate with `idempotency_key` → expect original response and `X-Idempotency-Replayed: true`.
7. Missing `kid` or unknown `kid` → expect `401`/`unknown_kid`.

## Operational Considerations

- Nonce and idempotency stores need retention policies and cleanup.
- Replay window tuning: smaller windows reduce attack surface but increase sensitivity to clock skew.
- Key management: rotate keys and maintain `kid` lists; past nonces for rotated keys may need mapping.

## Open Questions

- Exact storage backend recommendations (Redis with TTL, etc.)
- Whether to allow truncated `nonce` handling for legacy clients

# End of Spec
