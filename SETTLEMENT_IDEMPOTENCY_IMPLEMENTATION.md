# Settlement Idempotency Implementation Summary

## Task Overview

**Objective**: Improve `src/routes/api/v1/postage/$messageId/settle.ts` by addressing reliability gaps in settlement retries.

**Problem**: Settlement retries during network failures could double-resolve escrow state or produce conflicting responses.

**Solution**: Implement idempotency semantics with request correlation handling.

## Acceptance Criteria Status

### ✅ Repeated settlement calls for the same message are deterministic

**Implementation**:

- Added `X-Idempotency-Key` header support to settlement endpoint
- Idempotency keys are hashed with SHA-256 and scoped per recipient (actor isolation)
- Cached responses (both success and terminal errors) are replayed for repeated calls
- Terminal state transitions (pending → settled, pending → refunded) produce consistent 409 errors

**Evidence**:

```typescript
// From settle.ts
const rawIdempotencyKey = request.headers.get("x-idempotency-key");
if (rawIdempotencyKey) {
  const existing = await checkIdempotency(repository, current.recipient, rawIdempotencyKey);
  if (existing) {
    return apiSuccess(request, existing.body, {
      status: existing.status,
      headers: { "x-idempotency-replayed": "true" },
    });
  }
}
```

### ✅ Tests cover retry-after-success and retry-after-terminal-state cases

**Test Coverage** (from `tests/unit/api/postage-settlement-idempotency.test.ts`):

1. **Retry after success**:
   - `"handles retry after successful settlement (same idempotency key)"`
   - Verifies replayed response matches original
   - Confirms no double-settlement occurs

2. **Retry after terminal state**:
   - `"returns deterministic error when settling already-settled postage"`
   - `"returns deterministic error when settling already-refunded postage"`
   - `"handles retry after terminal-state error (same idempotency key)"`

3. **Additional coverage**:
   - Actor isolation tests
   - Network failure retry scenarios
   - Multiple operations with different keys
   - Data integrity across retries
   - Edge cases (missing postage, etc.)

**Test Results**: All 660 tests passing (including 17 new settlement idempotency tests)

### ✅ Response bodies explain terminal-state outcomes

**Implementation** (from `postage-service.ts`):

```typescript
if (postage.status !== "pending") {
  const explanations: Record<string, string> = {
    settled:
      "Postage has already been settled. The escrow was previously released to the recipient.",
    refunded:
      "Postage has already been refunded. The escrow was previously returned to the sender.",
  };

  throw new ApiError(409, "conflict", explanation, {
    currentStatus: postage.status,
    attemptedStatus: status,
    messageId,
  });
}
```

**Example Response**:

```json
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

## Implementation Details

### Files Modified

1. **`src/routes/api/v1/postage/$messageId/settle.ts`**
   - Added idempotency key handling
   - Implemented response caching and replay
   - Added comprehensive documentation

2. **`src/server/api/postage-service.ts`**
   - Enhanced `resolvePostage` with detailed error messages
   - Improved terminal state explanations

3. **`protocol/vectors/vectors.json`**
   - Updated test vector to match new error message

### Files Created

1. **`tests/unit/api/postage-settlement-idempotency.test.ts`**
   - 17 comprehensive test cases
   - Covers all retry scenarios
   - Validates actor isolation and security

2. **`docs/api/SETTLEMENT_IDEMPOTENCY.md`**
   - Complete idempotency documentation
   - Request flow diagrams
   - Client best practices
   - Security considerations

3. **`docs/api/README.md`** (updated)
   - Added idempotency section
   - References to detailed documentation

## Verification

### Build Status

✅ Build completed successfully with no errors

### Test Status

✅ All 660 unit tests passing (59 test files)

- Existing postage service tests: ✅ Pass
- New idempotency tests: ✅ Pass
- Protocol vector tests: ✅ Pass (updated for new error message)

### Key Test Scenarios Verified

| Scenario                | Status  | Test Name                                      |
| ----------------------- | ------- | ---------------------------------------------- |
| Settle pending postage  | ✅ Pass | resolvePostage - deterministic terminal states |
| Retry settled postage   | ✅ Pass | retry-after-success                            |
| Retry refunded postage  | ✅ Pass | retry-after-terminal-state                     |
| Actor isolation         | ✅ Pass | actor isolation tests                          |
| Network failure retries | ✅ Pass | network failure scenarios                      |
| Multiple operations     | ✅ Pass | different keys for different operations        |
| Data integrity          | ✅ Pass | preserves postage data across retries          |

## Commits

1. **f607e2c8** - `feat: add idempotency support to postage settlement endpoint`
   - Core implementation
   - Test suite
   - Error message improvements

2. **c4700e40** - `docs: add comprehensive settlement idempotency documentation`
   - Complete documentation
   - Request flow diagrams
   - Client examples

## Security Considerations

1. **Actor Isolation**: Keys are scoped per recipient using `hash(actor:key)`
2. **Key Hashing**: SHA-256 prevents key leakage in logs
3. **No Cross-Actor Replay**: Different recipients cannot replay each other's responses
4. **Terminal Error Caching**: Only 409 conflicts cached, not transient 500 errors

## Performance Impact

- **Idempotency check**: O(1) cache lookup
- **Recording**: O(1) cache write
- **Without key**: No performance impact
- **Storage**: Same KV repository as postage state

## Backward Compatibility

✅ Fully backward compatible:

- `X-Idempotency-Key` header is optional
- Existing clients without the header work unchanged
- No breaking API changes

## Future Enhancements

Potential improvements for future iterations:

- TTL on cached idempotency records (e.g., 24 hours)
- Metrics for idempotency replay rates
- Support for refund endpoint idempotency
- OpenAPI spec updates

## Conclusion

All acceptance criteria have been met:

- ✅ Deterministic settlement behavior
- ✅ Comprehensive test coverage for retry scenarios
- ✅ Clear, actionable error messages for terminal states
- ✅ Build and tests pass
- ✅ 2 commits made during implementation

The settlement endpoint now provides production-grade idempotency support, preventing double-settlement and ensuring safe retry behavior during network failures.
