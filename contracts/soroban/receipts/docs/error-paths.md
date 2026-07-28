# Receipts Contract Error Paths & Ledger Integration

This document specifies the negative-path semantics of the receipts contract to ensure robust ledger integration and prevent silent failures during receipt recording.

## Error Types

### `GuardNotConfigured`

**When:** The receipts contract has not yet been configured with a guard contract address.

**Triggers:**
- `delivered()` before `configure_guard()` is called
- `read()` before `configure_guard()` is called
- `guard()` when no guard has been configured

**Ledger Impact:** No state change. Caller must establish the guard before attempting receipt operations.

**Mitigation:** Deployers must call `configure_guard()` atomically with deployment (e.g., in the same transaction) to establish the lifecycle guard before any relays attempt to record receipts.

---

### `GuardAlreadyConfigured`

**When:** An attempt is made to reconfigure the guard after it has already been set.

**Triggers:**
- `configure_guard()` called a second time with any address (same or different)

**Ledger Impact:** No state change. The original guard address remains immutable.

**Semantics:** First-write-wins immutability. Once set, the guard contract address cannot be changed, preventing accidental or malicious reconfiguration of the trust boundary.

---

### `DuplicateReceipt`

**When:** An attempt is made to record a delivery receipt with a message ID that already exists with identical commitment parameters.

**Triggers:**
- `delivered()` called twice with the same `message_id`, `payload_hash`, `protocol_version`, `sender`, and `recipient`

**Ledger Impact:** No state change. The original receipt remains.

**Semantics:** Idempotency boundary. Duplicate submissions with identical commitments are safe to retry without consequence. This prevents relays from accidentally double-recording the same receipt.

**Authorization:** No additional authorization is required to detect duplicates; the check occurs before the guard verification.

---

### `CommitmentMismatch`

**When:** An attempt is made to record a delivery receipt with a message ID that exists but with different commitment parameters.

**Triggers:**
- `delivered()` called with a `message_id` that already exists but different `payload_hash`, `protocol_version`, `sender`, or `recipient`

**Ledger Impact:** No state change. The original receipt remains immutable.

**Semantics:** Payload immutability enforcement. A relay holding a sender's signature for one payload hash cannot replay it as a different payload or for different parties. This is a security boundary preventing signature reuse attacks.

**Authorization:** The commitment mismatch check occurs before guard verification, so authorization failures are not consulted for conflict detection.

---

### `ReceiptNotFound`

**When:** An attempt is made to read, or retrieve a receipt that does not exist.

**Triggers:**
- `read()` called with a `message_id` that has no prior `delivered()` record
- `get()` called with a `message_id` that has no prior `delivered()` record

**Ledger Impact:** No state change.

**Semantics:** Early failure. `read()` fails with `ReceiptNotFound` *before* authorization is required, so recipients cannot be confused about whether a receipt was created for them. Public read access (`get()`) is unrestricted, so receipt existence is not a secret.

---

### `AlreadyRead`

**When:** An attempt is made to call `read()` on a receipt that already has a `read_at` timestamp.

**Triggers:**
- `read()` called on a message ID whose receipt already has `read_at` set to a non-None value

**Ledger Impact:** No state change. The original `read_at` timestamp remains.

**Semantics:** Read timestamp immutability. A message cannot be marked as read multiple times. The first read wins.

---

### `LifecycleRejected`

**When:** The guard contract (lifecycle contract) rejects the receipt operation.

**Triggers:**
- `delivered()` when the guard's `verify_delivered()` returns an error or fails
- `read()` when the guard's `verify_read()` returns an error or fails

**Ledger Impact:** No state change. No receipt is created or updated when the guard rejects.

**Semantics:** Guard integration point. This error surface indicates a policy, ledger, or lifecycle constraint violation upstream. Common causes include:
- Message ID not bound in the lifecycle contract
- Policy rejection (sender blocked, insufficient postage, etc.)
- Recipient policy requires verification or receipt
- Ledger state mismatch

**Mitigation:** Verify that the lifecycle contract has bound the message ID before attempting receipt recording. Check policy settings on the recipient's mailbox. Ensure ledger state is consistent.

---

## Error Path Invariants

### No Partial State on Failure

All operations are atomic:
- If `delivered()` fails, no receipt is stored.
- If `read()` fails, the `read_at` timestamp is not updated.
- If `configure_guard()` fails (guard already configured), the existing guard remains unchanged.

This ensures the contract never enters an inconsistent state.

### Authorization Happens After Commitment Validation

For `delivered()`:
1. Check if receipt exists with mismatched commitment → `CommitmentMismatch` or `DuplicateReceipt`
2. Require sender authorization
3. Call guard contract

For `read()`:
1. Check if receipt exists → `ReceiptNotFound`
2. Check if already read → `AlreadyRead`
3. Require recipient authorization
4. Call guard contract

This layering ensures cheap, authorization-free validation for obvious conflicts before expensive signature verification.

### Guard Verification Happens Last

Both `delivered()` and `read()` call the guard contract only after all local validation passes. If the guard rejects with `LifecycleRejected`, no state is written.

---

## Integration Checklist for Relays

When integrating the receipts contract, relays should handle these error paths:

- **`GuardNotConfigured`**: Retry later or escalate; guard must be deployed first.
- **`GuardAlreadyConfigured`**: Proceed; guard is immutable once set.
- **`DuplicateReceipt`**: Safe to retry; idempotency is guaranteed.
- **`CommitmentMismatch`**: Reject the relay request; signature reuse detected.
- **`ReceiptNotFound`**: Reject on read; caller must deliver first.
- **`AlreadyRead`**: Safe to retry; read is idempotent once set.
- **`LifecycleRejected`**: Escalate to policy or ledger diagnostics; check lifecycle binding and recipient policy.

---

## Event Emission Guarantees

Events are emitted **only** on success:

- `Delivered` event: Emitted exactly once when `delivered()` succeeds.
- `Read` event: Emitted exactly once when `read()` succeeds.

Failed operations emit no events, allowing off-chain indexers to safely assume:
- Every indexed `Delivered` event corresponds to a stored receipt.
- Every indexed `Read` event corresponds to a receipt with `read_at` set.

---

## Snapshot Tests

Negative-path snapshot coverage in `src/lib.rs` includes:

1. **Guard Configuration**
   - `configure_guard_is_first_write_wins_and_immutable` — Guard is set once and immutable.
   - `guard_returns_configured_address` — Guard retrieval succeeds when configured.
   - `guard_returns_error_when_not_configured` — Guard retrieval fails appropriately.

2. **Delivery Errors**
   - `delivered_fails_before_guard_is_configured` — Guard must be set first.
   - `delivered_fails_when_guard_rejects` — Policy/ledger rejection surfaces properly.
   - `duplicate_id_with_same_commitment_still_cannot_overwrite` — DuplicateReceipt on replay.
   - `duplicate_id_with_different_payload_fails` — CommitmentMismatch on payload reuse.
   - `duplicate_commitment_with_different_protocol_version_fails` — CommitmentMismatch on version change.
   - `duplicate_commitment_with_different_sender_fails` — CommitmentMismatch on sender change.
   - `duplicate_commitment_with_different_recipient_fails` — CommitmentMismatch on recipient change.

3. **Read Errors**
   - `read_fails_on_nonexistent_message_without_authorization` — ReceiptNotFound before auth.
   - `double_read_is_prevented` — AlreadyRead on second read.
   - `read_fails_when_guard_rejects` — Policy/ledger rejection surfaces properly.

4. **Authorization Boundary Tests** (existing)
   - `delivered_fails_without_sender_authorization` — Sender authorization required.
   - `delivered_fails_when_only_recipient_authorizes` — Only sender, never recipient, for delivery.
   - `delivered_authorization_is_bound_to_exact_arguments` — Signature cannot be replayed with different args.
   - `read_fails_without_recipient_authorization` — Recipient authorization required.
   - `read_fails_when_sender_authorizes_instead_of_recipient` — Stored recipient, never caller-supplied.

These tests ensure ledger integration is robust and error semantics are documented and stable.
