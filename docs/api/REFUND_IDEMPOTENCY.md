# Postage Refund Idempotency

## Overview

The postage refund endpoint (`POST /api/v1/postage/:messageId/refund`) implements idempotency to ensure safe retry behavior during network failures, race conditions, or other transient errors.

## Problem Statement

Refund operations involve critical state transitions in the escrow system:

- Moving postage from `pending` to `refunded` returns escrow funds to the sender
- Network failures can cause clients to retry refund requests
- Without idempotency, retries could result in conflicting responses or ambiguous system state
- Concurrent settlement and refund attempts need deterministic conflict outcomes (settlement vs. refund)

## Solution

### Idempotency Key Header

Clients can include an optional `X-Idempotency-Key` header with refund requests:

```http
POST /api/v1/postage/abc123.../refund
Authorization: Bearer <recipient-token>
X-Idempotency-Key: unique-refund-request-id
```

### Key Properties

- **Actor-scoped**: Keys are scoped per recipient, preventing cross-actor collisions
- **SHA-256 hashed**: Raw keys are hashed to protect against key leakage in logs
- **Success replay**: Successful refunds (200) are cached and replayed
- **Error replay**: Terminal-state errors (409 conflict) are cached and replayed
- **Transient errors**: Non-terminal errors (500, network failures) are NOT cached, allowing retry

### Request Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ POST /refund (with idempotency key)
       ▼
┌─────────────────────────────────────────┐
│  Check idempotency cache                │
│  - Hash actor + key                     │
│  - Look up previous response            │
└──────┬──────────────────────────────────┘
       │
       ├─ Cache hit? ──► Return cached response (200 or 409)
       │                 + X-Idempotency-Replayed: true
       │
       └─ Cache miss
          │
          ▼
    ┌──────────────────────────────┐
    │  Attempt refund              │
    │  - Load postage              │
    │  - Check status              │
    │  - Transition to "refunded"  │
    └──────┬───────────────────────┘
           │
           ├─ Success (200)
           │  - Cache response
           │  - Return success
           │
           └─ Terminal error (409)
              - Cache error
              - Return error
```

## Retry Scenarios

### Scenario 1: Retry After Successful Refund

```http
# First request
POST /api/v1/postage/abc123.../refund
X-Idempotency-Key: req-001

Response: 200 OK
{
  "data": { "status": "refunded", ... },
  "meta": { "requestId": "..." }
}
```

Network failure occurs. Client retries:

```http
# Retry with same key
POST /api/v1/postage/abc123.../refund
X-Idempotency-Key: req-001

Response: 200 OK
X-Idempotency-Replayed: true
{
  "data": { "status": "refunded", ... },  # Same response
  "meta": { "requestId": "..." }
}
```

**Result**: No double-refunding. Same response returned. Client can safely process.

### Scenario 2: Retry After Terminal-State Error

Postage already refunded or settled by another process:

```http
# First request
POST /api/v1/postage/abc123.../refund
X-Idempotency-Key: req-002

Response: 409 Conflict
{
  "error": {
    "code": "conflict",
    "message": "Postage has already been refunded. The escrow was previously returned to the sender.",
    "details": {
      "currentStatus": "refunded",
      "attemptedStatus": "refunded",
      "messageId": "abc123..."
    }
  }
}
```

Client retries:

```http
# Retry with same key
POST /api/v1/postage/abc123.../refund
X-Idempotency-Key: req-002

Response: 409 Conflict
X-Idempotency-Replayed: true
{
  "error": { ... }  # Same error
}
```

**Result**: Deterministic error response. Client knows refund already completed.

### Scenario 3: Settlement vs. Refund Race

```http
# Settle message A
POST /api/v1/postage/messageA.../settle

# Refund message A concurrently
POST /api/v1/postage/messageA.../refund
```

**Result**: Atomic compare-and-swap guarantees only one operation wins `pending` state transition. The losing operation receives a `409 conflict` detailing the current status (`settled` or `refunded`).

## Error Messages

The implementation provides detailed error messages for terminal states:

### Already Refunded

```json
{
  "error": {
    "code": "conflict",
    "message": "Postage has already been refunded. The escrow was previously returned to the sender.",
    "details": {
      "currentStatus": "refunded",
      "attemptedStatus": "refunded",
      "messageId": "..."
    }
  }
}
```

### Already Settled

```json
{
  "error": {
    "code": "conflict",
    "message": "Postage has already been settled. The escrow was previously released to the recipient.",
    "details": {
      "currentStatus": "settled",
      "attemptedStatus": "refunded",
      "messageId": "..."
    }
  }
}
```

## Security Considerations

### Actor Isolation

Idempotency keys are scoped per recipient:

```typescript
hashIdempotencyKey(actor: string, rawKey: string): string {
  return createHash("sha256")
    .update(`${actor}:${rawKey}`)
    .digest("hex");
}
```

This ensures:

- Recipient A cannot replay responses meant for Recipient B
- Same key used by different recipients produces different cache entries
- No cross-actor information leakage

### Key Hashing

Raw idempotency keys are hashed before storage:

- Prevents key leakage in logs or database exports
- Provides consistent 64-character hex identifiers
- SHA-256 is computationally secure for this use case

## Implementation Details

### Code Location

- **Endpoint**: `src/routes/api/v1/postage/$messageId/refund.ts`
- **Service Logic**: `src/server/api/postage-service.ts` (`resolvePostage`)
- **Idempotency Logic**: `src/server/api/idempotency-service.ts`
- **Tests**: `tests/unit/api/postage-refund-idempotency.test.ts`

### Test Coverage

The test suite covers:

- ✅ Deterministic terminal states (refunded/settled)
- ✅ Success response replay
- ✅ Terminal error response replay (409)
- ✅ Actor isolation (different recipients don't collide)
- ✅ Network failure retry scenarios
- ✅ Settlement vs. refund concurrency races
- ✅ Data integrity across retries
- ✅ Missing postage error handling

## Related Endpoints

- `POST /api/v1/postage/` (postage submission)
- `POST /api/v1/postage/:messageId/settle` (postage settlement)
