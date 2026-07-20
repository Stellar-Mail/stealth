# Stealth Mail API

The TanStack Start worker exposes versioned endpoints under `/api/v1`.

## Endpoint groups

- Operations: `GET /health`, `GET /protocol`, `GET /openapi.json`
- Policy: read or replace mailbox defaults, manage sender overrides, and evaluate admission
- Postage: quote, submit, retrieve, settle, and refund message postage
- Receipts: record delivery, retrieve participant state, and acknowledge reads

Amounts are decimal strings in stroops because Soroban uses i128 values that can exceed JavaScript's
safe integer range. Message IDs and payment hashes are lowercase 32-byte hexadecimal strings.

## Idempotency

Certain endpoints support idempotency via the optional `X-Idempotency-Key` header to ensure safe
retry behavior during network failures or race conditions. Currently supported:

- `POST /api/v1/postage/` - Postage submission
- `POST /api/v1/postage/:messageId/settle` - Postage settlement

See [SETTLEMENT_IDEMPOTENCY.md](./SETTLEMENT_IDEMPOTENCY.md) for detailed documentation on
idempotency semantics, retry scenarios, and client best practices.

## Input Validation

Endpoints enforce strict validation for Stellar addresses and other identifiers:

- `POST /api/v1/postage/quote` - Quote request validation

See [POSTAGE_QUOTE_VALIDATION.md](./POSTAGE_QUOTE_VALIDATION.md) for comprehensive documentation on
validation rules, error responses, and boundary cases.

## Signed request authentication

Protected endpoints derive their principal from a Stellar Ed25519 signature. A bare
`x-stealth-address` header is never sufficient. Clients send all four headers:

| Header                | Value                                     |
| --------------------- | ----------------------------------------- |
| `x-stealth-address`   | Stellar G-address for the signing account |
| `x-stealth-timestamp` | Current Unix timestamp in seconds         |
| `x-stealth-nonce`     | Unique 16-128 character URL-safe value    |
| `x-stealth-signature` | Base64-encoded 64-byte Ed25519 signature  |

The signature covers this UTF-8 payload, with fields separated by a single newline:

```text
stealth-mail-api-request-v1
<stellar address>
<timestamp>
<nonce>
<uppercase HTTP method>
<URL pathname and query>
<lowercase SHA-256 hash of the exact request body>
```

Method, route/query, and body binding prevents a valid signature from authorizing a
different operation. Requests outside the five-minute clock window and repeated
address/nonce pairs are rejected. Clients must create a fresh nonce and signature
for every retry, including an idempotent retry.

The current replay cache is process-local. A durable, atomic nonce adapter is still
required before horizontally scaled production deployment so a nonce consumed by
one worker cannot be replayed against another worker.

## Persistence and chain integration

The current repository adapter is process-memory storage for local endpoint development. Before
production deployment, replace it with a Cloudflare Durable Object, D1, or another durable adapter.
The production postage adapter must verify `paymentHash` against Stellar before accepting a proof,
and mutations must submit or reconcile with the Soroban contracts rather than treating memory state
as chain truth.

Rate limiting, durable nonce persistence, durable API persistence, and contract event reconciliation
remain required production gates.
