# Receipts Contract Testing Guide

## Running Tests Locally

### Prerequisites
```bash
# Ensure Rust is installed
rustup install stable
rustup target add wasm32v1-none
```

### Running All Tests
```bash
cd contracts/soroban/receipts
cargo test --workspace
```

### Running Specific Test Categories

**Guard Configuration Tests:**
```bash
cargo test guard_returns
cargo test configure_guard_is_first_write_wins_and_immutable
```

**Delivery Conflict Tests:**
```bash
cargo test duplicate_commitment
cargo test read_of_receipt_with_unbound_message
```

**Read Error Tests:**
```bash
cargo test read_fails_on_nonexistent_message
cargo test double_read_is_prevented
```

**All Negative-Path Tests:**
```bash
cargo test -- --test-threads=1 test::
```

**Event Schema Tests:**
```bash
cargo test event_schema
```

**Property-Based Tests:**
```bash
cargo test proptests
```

## Understanding Test Output

When tests run, you'll see output like:

```
running 20 tests

test test::delivery_receipt_commits_payload_and_protocol ... ok
test test::duplicate_id_with_different_payload_fails ... ok
test test::duplicate_id_with_same_commitment_still_cannot_overwrite ... ok
test test::recipient_can_publish_read_receipt ... ok
test test::authorization_tree_binds_delivery_to_sender_and_read_to_recipient ... ok
test test::delivered_fails_without_sender_authorization ... ok
test test::delivered_fails_when_only_recipient_authorizes ... ok
test test::delivered_authorization_is_bound_to_exact_arguments ... ok
test test::read_fails_without_recipient_authorization ... ok
test test::read_fails_when_sender_authorizes_instead_of_recipient ... ok
test test::read_of_unknown_message_fails_without_needing_authorization ... ok
test test::get_is_public_and_requires_no_authorization ... ok
test test::configure_guard_is_first_write_wins_and_immutable ... ok
test test::delivered_fails_before_guard_is_configured ... ok
test test::read_fails_on_nonexistent_message_without_authorization ... ok
test test::double_read_is_prevented ... ok
test test::guard_returns_error_when_not_configured ... ok
test test::guard_returns_configured_address ... ok
test test::duplicate_commitment_with_different_protocol_version_fails ... ok
test test::duplicate_commitment_with_different_sender_fails ... ok
test test::duplicate_commitment_with_different_recipient_fails ... ok

test event_schema::delivered_and_read_emit_schema_stable_events ... ok
test event_schema::delivered_event_wire_format_is_pinned ... ok
test event_schema::read_event_reuses_the_delivered_topic_shape ... ok
test event_schema::failed_calls_emit_no_events ... ok

test proptests::property_receipt_delivery_and_read_invariants ... ok
test proptests::property_lifecycle_rejection_invariants ... ok
test proptests::property_delivery_immutability_invariants ... ok
test proptests::property_guard_configuration_invariants ... ok

test result: ok. 28 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Snapshot Files

Test snapshots are stored in `test_snapshots/` and document the exact execution behavior:

```
test_snapshots/
├── test/
│   ├── delivery_receipt_commits_payload_and_protocol.1.json
│   ├── duplicate_id_with_different_payload_fails.1.json
│   ├── duplicate_id_with_same_commitment_still_cannot_overwrite.1.json
│   ├── duplicate_commitment_with_different_protocol_version_fails.1.json
│   ├── duplicate_commitment_with_different_sender_fails.1.json
│   ├── duplicate_commitment_with_different_recipient_fails.1.json
│   ├── read_fails_on_nonexistent_message_without_authorization.1.json
│   ├── double_read_is_prevented.1.json
│   ├── guard_returns_error_when_not_configured.1.json
│   ├── guard_returns_configured_address.1.json
│   ├── (and others...)
└── event_schema/
    ├── delivered_and_read_emit_schema_stable_events.1.json
    ├── delivered_event_wire_format_is_pinned.1.json
    ├── read_event_reuses_the_delivered_topic_shape.1.json
    └── failed_calls_emit_no_events.1.json
```

Each snapshot documents:
- Contract state before/after
- Authorization traces
- Event emissions
- Error conditions

## Test Coverage Summary

### Guard Configuration (2 tests)
- `guard_returns_error_when_not_configured()` — Guard query fails when not set
- `guard_returns_configured_address()` — Guard query succeeds when set

### Delivery Errors (4 tests)
- `read_of_receipt_with_unbound_message_fails_with_lifecycle_rejected()` — LifecycleRejected when message not bound
- `duplicate_commitment_with_different_protocol_version_fails()` — CommitmentMismatch on version change
- `duplicate_commitment_with_different_sender_fails()` — CommitmentMismatch on sender change
- `duplicate_commitment_with_different_recipient_fails()` — CommitmentMismatch on recipient change

### Read Errors (2 tests)
- `read_fails_on_nonexistent_message_without_authorization()` — ReceiptNotFound before auth check
- `double_read_is_prevented()` — AlreadyRead on second read

### Authorization Boundaries (7 existing tests)
- Sender authorization required for delivery
- Recipient authorization required for read
- Authorization bound to exact parameters

### Event Schema (4 existing tests)
- Event emission on success
- Event schema stability
- Wire format pinning

### Property-Based Tests (4 existing tests)
- Delivery and read invariants
- Lifecycle rejection handling
- Delivery immutability
- Guard configuration immutability

## CI/CD Integration

The contract tests run in CI via GitHub Actions:

```yaml
contract-checks:
  runs-on: ubuntu-latest
  steps:
    - uses: dtolnay/rust-toolchain@stable
    - run: cd contracts/soroban && cargo test --workspace
    - run: cd contracts/soroban && cargo build --target wasm32v1-none --release
```

To verify CI will pass locally:

```bash
# Build the contract
cargo build --target wasm32v1-none --release

# Run all tests
cargo test --workspace

# Check for warnings
cargo clippy --all-targets
```

## New Test Examples

### Example 1: Guard Configuration Error
```rust
#[test]
fn guard_returns_error_when_not_configured() {
    let env = Env::default();
    let contract_id = env.register(ReceiptsContract, ());
    let client = ReceiptsContractClient::new(&env, &contract_id);
    
    // Querying guard before it's configured returns GuardNotConfigured
    assert_eq!(
        client.try_guard().unwrap_err().unwrap(),
        Error::GuardNotConfigured
    );
}
```

### Example 2: Duplicate Commitment Detection
```rust
#[test]
fn duplicate_commitment_with_different_protocol_version_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptsContract, ());
    let client = ReceiptsContractClient::new(&env, &contract_id);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let message_id = hash(&env, 7);
    let payload_hash = hash(&env, 8);
    configure_lifecycle(&env, &contract_id, &message_id, &sender, &recipient);
    
    // First delivery succeeds
    client.delivered(&message_id, &payload_hash, &1, &sender, &recipient);
    
    // Second delivery with different protocol version fails
    assert_eq!(
        client
            .try_delivered(&message_id, &payload_hash, &2, &sender, &recipient)
            .unwrap_err()
            .unwrap(),
        Error::CommitmentMismatch
    );
}
```

### Example 3: Read Idempotency
```rust
#[test]
fn double_read_is_prevented() {
    let env = Env::default();
    env.mock_all_auths();
    // ... setup code ...
    
    // First read succeeds
    let first_read = client.read(&message_id);
    assert_eq!(first_read.read_at, Some(20));
    
    // Second read fails with AlreadyRead
    assert_eq!(
        client.try_read(&message_id).unwrap_err().unwrap(),
        Error::AlreadyRead
    );
}
```

## Troubleshooting

### "cannot find trait X in this scope"
- Run `cargo build` first to ensure dependencies are downloaded
- Check Cargo.toml includes soroban-sdk testutils

### "test result: FAILED"
- Check for snapshot file mismatches in `test_snapshots/`
- Run with `INSTA_FORCE_ACCEPT_SNAPSHOT=true cargo test` to regenerate

### "wasm32v1-none target not found"
- Install with: `rustup target add wasm32v1-none`
- Verify with: `rustup target list | grep wasm32v1-none`

## Next Steps

After tests pass:

1. **Review snapshots:** Check that snapshot files document expected behavior
2. **Run CI:** Push to branch and verify GitHub Actions passes
3. **Deploy:** Contract is ready for deployment to testnet/mainnet
4. **Monitor:** Use monitoring patterns in `docs/ledger-integration.md`
