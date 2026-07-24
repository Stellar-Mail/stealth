# Postage API Handoff

This directory owns the existing `/api/v1/postage` HTTP surface for quoting,
submitting, reading, settling, and refunding message postage. Keep changes
inside this route area and its existing service/repository dependencies unless
a future issue explicitly expands the scope.

## Files To Review

- `quote.ts` handles `POST /api/v1/postage/quote` and returns the current
  mailbox-policy quote for a sender/recipient pair.
- `index.ts` handles `POST /api/v1/postage/`, validates sender-submitted
  postage, enforces actor matching, supports idempotency replay, and passes
  abuse context into the service layer.
- `$messageId.ts` handles `GET /api/v1/postage/$messageId` and only allows
  message participants to read a postage record.
- `$messageId/settle.ts` lets the recipient settle pending postage.
- `$messageId/refund.ts` lets the recipient refund pending postage.
- `src/server/api/postage-service.ts` owns quote, submit, participant read, and
  terminal-state transition rules.
- `src/server/api/memory-repository.ts` is the in-memory state implementation
  used by local and test flows.

Related coverage:

- `tests/unit/api/postage-service.test.ts`
- `tests/e2e/postage.spec.ts`
- `tests/unit/protocol/vectors.test.ts`
- `tests/unit/compose/usePostageQuote.test.ts`

## Data Contracts

Quote request:

- `recipient`: Stellar address.
- `sender`: Stellar address.

Quote response:

- `amount`: required postage in stroops.
- `eligible`: whether the sender may proceed.
- `reason`: `trusted_sender`, `mailbox_minimum`, or `sender_blocked`.
- `trusted`: whether a sender rule grants zero-postage trust.

Submit request:

- `amount`: stroop amount.
- `messageId`: 32-byte hash encoded as 64 hex characters.
- `paymentHash`: 32-byte payment proof hash encoded as 64 hex characters.
- `recipient`: Stellar address.
- `sender`: Stellar address and required actor.

Postage records persist as `pending`, `settled`, or `refunded`.

## User-Facing States

- Quote can show trusted zero-postage, mailbox-minimum postage, or blocked
  sender ineligibility.
- Submit creates one `pending` record per message id.
- Replayed idempotent submissions return the stored body with
  `x-idempotency-replayed: true`.
- Reads are limited to sender or recipient participants.
- Settlement and refund are terminal transitions from `pending` only.
- Duplicate submit or duplicate terminal transitions return conflict errors.
- Rate limits return retryable `too_many_requests` responses.

## Error Contract

Every postage endpoint returns the standard JSON envelope defined in `src/server/api/response.ts`. Success responses use the success envelope; failures use the error envelope with a stable, machine-readable `code`:

    {
      "error": {
        "code": "validation_error",
        "message": "Request validation failed",
        "details": { "formErrors": [], "fieldErrors": {} }
      },
      "meta": { "requestId": "8f3c...", "timestamp": "2026-07-17T23:00:00.000Z" }
    }

Clients should branch on `error.code`, not on `message` text. Every response also sets `x-request-id` and `cache-control: no-store`.

### Error codes

| Code                 | HTTP status     | Raised when                                                                                       | Retryable |
| -------------------- | --------------- | ------------------------------------------------------------------------------------------------- | --------- |
| `bad_request`        | 400 / 413 / 415 | Invalid JSON body, body over 64 KB, or non-JSON `Content-Type`                                    | No        |
| `unauthorized`       | 401             | Missing or invalid `x-stealth-address` actor header                                               | No        |
| `forbidden`          | 403             | Actor does not match the sender, recipient blocked the sender, or a non-participant tried to read | No        |
| `not_found`          | 404             | No postage record exists for the message id                                                       | No        |
| `conflict`           | 409             | Duplicate submit, or settle/refund of already-resolved postage                                    | No        |
| `validation_error`   | 422             | Schema validation failed, or amount is below the mailbox minimum                                  | No        |
| `too_many_requests`  | 429             | Account, IP, device, sender-recipient, or relay rate limit hit                                    | Yes       |
| `method_not_allowed` | 405             | HTTP method not supported on the route                                                            | No        |
| `internal_error`     | 500             | Unexpected server error                                                                           | Yes       |

### Retryable vs non-retryable

- **Retryable:** `too_many_requests` (429) — wait `details.retryAfterSeconds`, then retry the identical request. `internal_error` (500) — retry with exponential backoff.
- **Non-retryable:** 400, 401, 403, 404, 409, 413, 415, and 422. Retrying the same request unchanged will fail again; fix the request first.
- **Idempotent retries:** on `POST /api/v1/postage/`, send an `x-idempotency-key` header. A replay returns the stored `201` body with `x-idempotency-replayed: true` instead of a `409 conflict`, so automatic retries stay safe.

### Errors by endpoint

**`POST /api/v1/postage/quote`** — quote a sender/recipient pair (no actor header required).

- `415` / `413` / `400` `bad_request` — malformed request body.
- `422` `validation_error` — `recipient` or `sender` is missing or not a valid Stellar G-address.
- `200` — returns `amount`, `eligible`, `reason`, and `trusted`. A blocked sender is reported as `eligible: false`, not as an error.

**`POST /api/v1/postage/`** — submit postage as the sender.

- `401` `unauthorized` — missing or invalid `x-stealth-address`.
- `403` `forbidden` — actor does not match `sender`, or the recipient has blocked the sender.
- `400` / `413` / `415` `bad_request` — malformed request body.
- `422` `validation_error` — schema invalid, or `amount` is below the mailbox minimum (`details.minimumPostage`).
- `429` `too_many_requests` — a rate limit was hit (`details.retryAfterSeconds`).
- `409` `conflict` — postage already exists for this message id (unless replayed with an idempotency key).
- `201` — record created with status `pending`.

Example below-minimum failure:

    {
      "error": {
        "code": "validation_error",
        "message": "Postage is below the mailbox minimum",
        "details": { "minimumPostage": "100" }
      },
      "meta": { "requestId": "1c9d...", "timestamp": "2026-07-17T23:00:00.000Z" }
    }

**`GET /api/v1/postage/:messageId`** — read a postage record.

- `422` `validation_error` — `messageId` is not a 64-character hex hash.
- `401` `unauthorized` — missing or invalid actor header.
- `404` `not_found` — no record for that message id.
- `403` `forbidden` — actor is neither the sender nor the recipient.
- `200` — returns the postage record.

**`POST /api/v1/postage/:messageId/settle`** and **`POST /api/v1/postage/:messageId/refund`** — the recipient resolves pending postage.

- `401` `unauthorized` — missing or invalid actor header.
- `422` `validation_error` — `messageId` is not a valid hash.
- `404` `not_found` — no record for that message id.
- `403` `forbidden` — actor is not the recipient.
- `409` `conflict` — postage is not `pending` (already settled or refunded; `details.status` shows the current state).
- `200` — returns the record in its new terminal state.

Example rate-limit failure:

    {
      "error": {
        "code": "too_many_requests",
        "message": "Account limit exceeded",
        "details": { "retryAfterSeconds": 60 }
      },
      "meta": { "requestId": "a4b1...", "timestamp": "2026-07-17T23:00:00.000Z" }
    }

## Safety And Privacy Notes

- This API works with fake/demo data in local and test runs. Do not use live
  customer mail, real secrets, private keys, or production payment credentials
  in fixtures.
- `paymentHash` is a proof reference, not a substitute for production Stellar
  verification. Production adapters must verify the proof before accepting it.
- `amount`, `recipient`, `sender`, and `messageId` are trust-sensitive because
  they affect spam friction, participant authorization, and payment state.
- Only the sender may submit postage for their own address.
- Only message participants may read a postage record.
- Only the recipient may settle or refund pending postage in the current route
  implementation.
- Abuse context uses account, IP, device fingerprint, sender-recipient, and
  relay buckets. Do not log or export raw request identifiers beyond existing
  metrics without a privacy review.
- The memory repository is process-local test state; do not treat it as durable
  production storage or cross-device synchronization.

## Contributor Checklist

- Keep route schemas aligned with `src/server/api/domain` validators.
- Preserve actor checks before creating or resolving postage records.
- Preserve participant checks before returning postage data.
- Preserve duplicate-message and terminal-state conflict handling.
- Keep idempotency responses stable for repeated submits.
- Keep error responses in the standard API envelope.
- Update unit and e2e tests when changing quote, submit, settle, refund, or
  rate-limit behavior.

## QA Checklist

- Quote an allowed sender and verify amount `0`, `trusted: true`, and
  `eligible: true`.
- Quote a blocked sender and verify `eligible: false`.
- Submit postage as the sender and verify the record is `pending`.
- Repeat the same submit with an idempotency key and verify replay behavior.
- Submit duplicate postage without replay and verify a conflict.
- Submit below the mailbox minimum and verify validation failure.
- Read postage as sender and recipient, then verify a non-participant is
  rejected.
- Settle pending postage as recipient and verify the terminal state.
- Refund pending postage as recipient and verify the terminal state.
- Attempt a second settle/refund and verify conflict handling.
- Run the relevant local checks when dependencies are available:
  - `bun run test -- tests/unit/api/postage-service.test.ts`
  - `bun run test:e2e -- tests/e2e/postage.spec.ts`
  - `bun x tsc --noEmit`
  - `bun run lint`
