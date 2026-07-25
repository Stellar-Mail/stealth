# Postage Settlement Idempotency

## Overview

The postage settlement endpoint (`POST /api/v1/postage/:messageId/settle`) implements idempotency to ensure safe retry behavior during network failures, race conditions, or other transient errors.

## Problem Statement

Settlement operations involve critical state transitions in the escrow system:

- Moving postage from `pending` to `settled` releases funds to the recipient
- Network failures can cause clients to retry settlement requests
- Without idempotency, retries could result in conflicting responses or ambiguous system state
- Concurrent settlement attempts from different processes need deterministic outcomes

## Solution

### Idempotency Key Header

Clients can include an optional `X-Idempotency-Key` header with settlement requests:

```http
POST /api/v1/postage/abc123.../settle
Authorization: Bearer <recipient-token>
X-Idempotency-Key: unique-settlement-request-id
```

### Key Properties

- **Actor-scoped**: Keys are scoped per recipient, preventing cross-actor collisions
- **SHA-256 hashed**: Raw keys are hashed to protect against key leakage in logs
- **Success replay**: Successful settlements (200) are cached and replayed
- **Error replay**: Terminal-state errors (409 conflict) are cached and replayed
- **Transient errors**: Non-terminal errors (500, network failures) are NOT cached, allowing retry

### Request Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ POST /settle (with idempotency key)
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
    │  Attempt settlement          │
    │  - Load postage              │
    │  - Check status              │
    │  - Transition to "settled"   │
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

### Scenario 1: Retry After Successful Settlement

```http
# First request
POST /api/v1/postage/abc123.../settle
X-Idempotency-Key: req-001

Response: 200 OK
{
  "data": { "status": "settled", ... },
  "meta": { "requestId": "..." }
}
```

Network failure occurs. Client retries:

```http
# Retry with same key
POST /api/v1/postage/abc123.../settle
X-Idempotency-Key: req-001

Response: 200 OK
X-Idempotency-Replayed: true
{
  "data": { "status": "settled", ... },  # Same response
  "meta": { "requestId": "..." }
}
```

**Result**: No double-settlement. Same response returned. Client can safely process.

### Scenario 2: Retry After Terminal-State Error

Postage already settled by another process:

```http
# First request
POST /api/v1/postage/abc123.../settle
X-Idempotency-Key: req-002

Response: 409 Conflict
{
  "error": {
    "code": "conflict",
    "message": "Postage has already been settled. The escrow was previously released to the recipient.",
    "details": {
      "currentStatus": "settled",
      "attemptedStatus": "settled",
      "messageId": "abc123..."
    }
  }
}
```

Client retries:

```http
# Retry with same key
POST /api/v1/postage/abc123.../settle
X-Idempotency-Key: req-002

Response: 409 Conflict
X-Idempotency-Replayed: true
{
  "error": { ... }  # Same error
}
```

**Result**: Deterministic error response. Client knows settlement already completed.

### Scenario 3: Different Operations with Different Keys

```http
# Settle message A
POST /api/v1/postage/messageA.../settle
X-Idempotency-Key: req-003

# Settle message B
POST /api/v1/postage/messageB.../settle
X-Idempotency-Key: req-004
```

**Result**: Each operation is independent. Keys don't collide.

## Error Messages

The implementation provides detailed error messages for terminal states:

### Already Settled

```json
{
  "error": {
    "code": "conflict",
    "message": "Postage has already been settled. The escrow was previously released to the recipient.",
    "details": {
      "currentStatus": "settled",
      "attemptedStatus": "settled",
      "messageId": "..."
    }
  }
}
```

### Already Refunded

```json
{
  "error": {
    "code": "conflict",
    "message": "Postage has already been refunded. The escrow was previously returned to the sender.",
    "details": {
      "currentStatus": "refunded",
      "attemptedStatus": "settled",
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

- **Endpoint**: `src/routes/api/v1/postage/$messageId/settle.ts`
- **Service Logic**: `src/server/api/postage-service.ts` (`resolvePostage`)
- **Idempotency Logic**: `src/server/api/idempotency-service.ts`
- **Tests**: `tests/unit/api/postage-settlement-idempotency.test.ts`

### Test Coverage

The test suite covers:

- ✅ Deterministic terminal states (settled/refunded)
- ✅ Success response replay
- ✅ Terminal error response replay (409)
- ✅ Actor isolation (different recipients don't collide)
- ✅ Network failure retry scenarios
- ✅ Multiple operations with different keys
- ✅ Data integrity across retries
- ✅ Missing postage error handling

### Performance Considerations

- Idempotency check adds one cache lookup (O(1))
- Recording adds one cache write (O(1))
- No impact when idempotency key is not provided
- Keys are stored in the same repository layer as postage state (KV store)

## Client Best Practices

### Generating Idempotency Keys

Use UUIDs or other collision-resistant identifiers:

```javascript
const idempotencyKey = crypto.randomUUID();
// or
const idempotencyKey = `settlement-${messageId}-${Date.now()}-${Math.random()}`;
```

### Retry Logic

```javascript
async function settleWithRetry(messageId, maxRetries = 3) {
  const idempotencyKey = crypto.randomUUID();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`/api/v1/postage/${messageId}/settle`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Idempotency-Key": idempotencyKey,
        },
      });

      if (response.ok) {
        const wasReplayed = response.headers.get("X-Idempotency-Replayed");
        return await response.json();
      }

      if (response.status === 409) {
        // Terminal state - don't retry
        throw new Error("Postage already resolved");
      }

      // Retry transient errors
      await sleep(Math.pow(2, attempt) * 1000);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
    }
  }
}
```

### Key Reuse

- **DO**: Reuse the same key for retries of the same logical operation
- **DON'T**: Reuse keys across different messages or operations
- **DON'T**: Retry with a different key after a 409 error (wastes cache resources)

## Related Endpoints

The same idempotency pattern is also used in:

- `POST /api/v1/postage/` (postage submission)

Future endpoints that modify critical state should adopt this pattern.

## References

- [RFC 9110 - HTTP Semantics (Idempotent Methods)](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)
- [Stripe API - Idempotent Requests](https://stripe.com/docs/api/idempotent_requests)
- [AWS API Gateway - Idempotency](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-idempotency.html)
