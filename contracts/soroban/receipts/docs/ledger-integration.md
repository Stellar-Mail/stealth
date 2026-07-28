# Receipts Contract Ledger Integration Guide

This document provides guidance for systems integrating the receipts contract with Soroban ledgers and off-chain indexing layers.

## Contract Invariants for Ledger Safety

### State Atomicity

The receipts contract guarantees atomic state transitions:

1. **Successful `delivered()` call:**
   - Exactly one receipt record is created or confirmed unchanged
   - Exactly one `Delivered` event is emitted
   - State is persisted before the transaction commits

2. **Successful `read()` call:**
   - Exactly one receipt's `read_at` timestamp is updated
   - Exactly one `Read` event is emitted
   - The previous `delivered_at` remains unchanged

3. **Failed call (any error):**
   - No state changes occur
   - No events are emitted
   - Ledger storage is unaffected

### Commitment Immutability

Once a receipt is recorded for a message ID, its commitment parameters are immutable:

- `message_id`: Unique identifier for the receipt; serves as primary key
- `payload_hash`: Payload content hash; cannot be changed
- `protocol_version`: Protocol version; cannot be changed
- `sender`: Sender address; cannot be changed
- `recipient`: Recipient address; cannot be changed
- `delivered_at`: Delivery timestamp; set once and immutable

Only `read_at` can transition from `None` to a timestamp value (and cannot revert).

### Read Timestamp Ordering

When `read()` succeeds:

```
read_at ≥ delivered_at  (always true)
```

The read timestamp is always greater than or equal to the delivery timestamp, by construction (set from the same `env.ledger().timestamp()` at a later point or same moment).

## Indexing Off-Chain

Off-chain indexers should follow these patterns:

### Event Filtering

1. **Monitor `Delivered` events:**
   - Topic[0] = Symbol("delivered")
   - Topic[1] = message_id (BytesN<32>)
   - Data = Receipt struct (single-value format)

2. **Monitor `Read` events:**
   - Topic[0] = Symbol("read")
   - Topic[1] = message_id (BytesN<32>)
   - Data = Receipt struct with `read_at` set (single-value format)

### Durability Guarantees

- Every indexed `Delivered` event corresponds to a receipt in contract storage
- Every indexed `Read` event corresponds to `read_at` being set on the stored receipt
- Events are never emitted before state is written; state durability is not asynchronous
- Replaying an event archive is safe; the contract is deterministic

### Indexer State Reconciliation

If an indexer falls behind:

1. **Rescan `delivered()` events** for message IDs not in the indexer's cache
2. **Rescan `read()` events** for message IDs and correlate with delivery
3. **On conflict:** Prefer the indexer's stored state; re-emit events for cache warming

Because the contract is immutable, replaying events idempotently rebuilds the correct state.

## Relay Integration Patterns

Relays should use these patterns when submitting receipts:

### Delivery Flow

```
1. Relay receives delivery confirmation
2. Relay calls receipts.delivered(...)
   - If DuplicateReceipt: Safe to retry (idempotent)
   - If CommitmentMismatch: Relay error; log and escalate
   - If LifecycleRejected: Policy error; check recipient policy
   - If GuardNotConfigured: Infrastructure error; retry after guard setup
   - If other error: Log and retry later
3. On success: Relay indexes the receipt and notifies sender
```

### Read Flow

```
1. Relay receives read confirmation
2. Relay calls receipts.read(...)
   - If ReceiptNotFound: Delivery not recorded yet; retry later
   - If AlreadyRead: Safe to ignore (read already recorded)
   - If LifecycleRejected: Policy error; escalate
   - If GuardNotConfigured: Infrastructure error; retry after guard setup
   - If other error: Log and retry later
3. On success: Relay indexes the read and notifies sender
```

### Error Handling Decision Tree

```
received_error:
  GuardNotConfigured
    → wait for guard deployment
    → retry

  GuardAlreadyConfigured
    → guard is set; proceed

  DuplicateReceipt
    → safe to retry
    → receipt already exists with same commitment
    → consider this success

  CommitmentMismatch
    → do NOT retry
    → relay error detected; signature replayed incorrectly
    → log and escalate

  ReceiptNotFound
    → retry later
    → deliver() must be called before read()

  AlreadyRead
    → safe to retry
    → read already recorded
    → consider this success

  LifecycleRejected
    → policy or ledger error
    → check recipient policy configuration
    → verify message is bound in lifecycle
    → escalate if policy violation
```

## Watchdog Monitoring

Systems should monitor for:

1. **Guard Configuration Latency:**
   - If `GuardNotConfigured` errors persist, guard was not deployed
   - Alert: missing guard contract deployment

2. **Commitment Mismatch Rate:**
   - If `CommitmentMismatch` errors spike, relays may be misconfigured
   - Alert: signature reuse or relay parameter errors

3. **Lifecycle Rejection Rate:**
   - If `LifecycleRejected` errors spike, policies may be blocking receipts
   - Alert: policy configuration or ledger state issue

4. **Duplicate Receipt Rate (Healthy):**
   - `DuplicateReceipt` is normal and expected during retries
   - Alert: only if combined with `CommitmentMismatch` (indicates replay attempts)

## Contract Query Patterns

### Read-Only Public Access

```
let receipt = receipts.get(message_id);
```

- No authorization required
- Returns `ReceiptNotFound` if message ID not in storage
- Safe for off-chain consumption

### Guard Query

```
let guard = receipts.guard();
```

- Returns configured guard address
- Returns `GuardNotConfigured` if not yet configured
- Used to validate integration setup

## Ledger Storage Layout

The receipts contract uses:

- **Instance Storage (Immortal):**
  - `DataKey::Guard` → single configured guard address

- **Persistent Storage:**
  - `DataKey::Receipt(message_id)` → Receipt struct

Instance storage is backed indefinitely; guards never expire.

Persistent storage follows Soroban's ledger lifetime rules; receipts may be archived if not accessed within the ledger's entry lifetime window. Off-chain indexing is recommended for long-term durability.

## Backward Compatibility

The receipts contract maintains backward compatibility for:

- **Event schema** — pinned by `event_schema` test module
- **Error codes** — stable; new codes added only in major versions
- **Authorization boundaries** — immutable; sender required for delivery, recipient for read
- **Public interface** — `delivered()`, `read()`, `get()`, `configure_guard()`, `guard()`

Contract upgrades (if any) will maintain these invariants or provide migration documentation.
