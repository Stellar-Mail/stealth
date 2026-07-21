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

## Development identity

Protected endpoints require `x-stealth-address` with the Stellar address acting on the request.
This header only preserves authorization boundaries during development. It is not authentication.
Production must derive the actor from a verified wallet challenge or signed session and must ignore
caller-supplied identity headers at the public edge.

```bash
curl -X PUT http://localhost:8080/api/v1/policies/GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA \
  -H "content-type: application/json" \
  -H "x-stealth-address: GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" \
  -d '{"allowUnknown":true,"requireVerified":true,"minimumPostage":"10000000"}'
```

## Persistence and chain integration

The current repository adapter is process-memory storage for local endpoint development. Before
production deployment, replace it with a Cloudflare Durable Object, D1, or another durable adapter.
The production postage adapter must verify `paymentHash` against Stellar before accepting a proof,
and mutations must submit or reconcile with the Soroban contracts rather than treating memory state
as chain truth.

Rate limiting, replay-resistant signed authentication, idempotency keys, durable persistence, and
contract event reconciliation remain required production gates.
