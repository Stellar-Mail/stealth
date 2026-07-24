# RFC 8785 JSON Canonicalization Scheme (JCS) - PR Summary

## Issue Overview

This PR replaces the previous ad hoc JSON canonicalization logic with a verified, fully compliant RFC 8785 JSON Canonicalization Scheme (JCS) implementation. This ensures absolute determinism across all runtimes when producing the canonical bytes signed by the user's wallet, eliminating cross-platform interoperability failures for edge-cases.

## Changes Summary

**Modified Files:**

- `src/services/crypto/envelope.ts` (Updated `canonicalizePayload` to securely wrap the new JCS encoder)

**New Files Added:**

- `src/services/crypto/jcs.ts` (Core JCS canonicalization logic)
- `tests/unit/crypto/jcs.test.ts` (Comprehensive RFC 8785 test vectors and strict type validations)

## Improvements Implemented

### ✅ Strict RFC 8785 Compliance
- **Primitive Handling:** Reliably canonicalizes numbers natively by strictly delegating to the ES6 `ToString()` representation (verifying `-0` handling according to spec).
- **String Escaping:** Implements deterministic escaping and UTF-8 encoding compliance (escapes backslashes, quotes, and specific control characters natively).
- **Object Key Sorting:** Enforces strictly deterministic, lexicographical sorting of object properties via UTF-16 code units.

### ✅ Explicit Failure on Unsupported Values
- **Invalid Types Blocked:** Actively rejects (throws errors) when encountering `undefined`, `NaN`, `Infinity`, `-Infinity`, `BigInt`, `symbol`, or `function`.
- **Prevents Coercion:** Mitigates risk of hidden bugs by guaranteeing that invalid structures are explicitly blocked rather than silently coerced to `null` or silently stripped out (which is standard `JSON.stringify` behavior).
- **Deep Validation:** Enforces these structural validations completely recursively, securing elements nestled deep within nested Arrays or Objects.

### ✅ Seamless Crypto Pipeline Integration
- **Zero Disruptions:** Exposes the new canonicalizer cleanly through `envelope.ts`, ensuring that `signature.ts` and `sendPipeline.ts` automatically utilize the secure byte representation without architectural rewrites.
- **Cross-module compatibility:** Validated against newly merged `main` functionality (like `#1696` AEAD Tag Convention and `#1716` Session Hierarchy).

## Acceptance Criteria Met

| Criterion | Status | Evidence |
| --- | --- | --- |
| Official or equivalent RFC 8785 vectors pass | ✅ | Validated in `jcs.test.ts` (official sample vectors) |
| Unsupported values fail explicitly | ✅ | Throws on `NaN`, `Infinity`, `BigInt`, and `undefined` |
| Unicode and escaping behavior is deterministic | ✅ | Proper control character bounds, consistent UTF-8 bytes |
| The send pipeline signs canonical bytes | ✅ | Hooked through `envelope.ts`, confirmed with test suite |
| Kept implementation inside `src/services/crypto/` | ✅ | Only modified isolated crypto internals |

## Technical Details

### File Changes

```diff
src/services/crypto/envelope.ts
- Removed inline ad-hoc canonicalizePayload logic
+ Imported canonicalize from ./jcs and exposed through canonicalizePayload
```

### No Changes Needed

These files natively accept the compliant JCS output without required updates:
- `src/services/crypto/signature.ts` ✓
- `src/features/compose/sendPipeline.ts` ✓

## Testing Coverage

### Vector Testing
- Official RFC 8785 examples (Euro sign, control characters, numerical exponents)
- Deeply nested objects and complex multidimensional arrays

### Security & State Testing
- Deliberate coercion attempts using ES6 primitives (Symbols, BigInt)
- Verifying ES6 number conversions against spec limitations
- `.toJSON()` behavior compliance

## Deployment Checklist

- [x] Code changes complete
- [x] No TypeScript errors
- [x] No breaking API/UI changes
- [x] Core behavior significantly hardened
- [x] Documentation complete
- [ ] Code review approval (pending)
- [ ] Tests passing natively on CI (pending)
- [ ] Ready to merge

## PR Description for GitHub

### Title

```
feat(crypto): Replace ad hoc canonicalizer with verified RFC 8785 JCS behavior
```

### Description

```markdown
## Summary

Replaces the ad hoc JSON canonicalization structure with a strictly compliant RFC 8785 JSON Canonicalization Scheme (JCS) representation to guarantee wallet signature interoperability across runtimes.

## What Changed

- Created a dedicated, strict JCS canonicalization encoder inside `src/services/crypto/jcs.ts`.
- Directed `envelope.ts` `canonicalizePayload` to use the shared JCS logic natively.
- Added comprehensive unit testing with official RFC 8785 test vectors to validate explicit failures and sorting behaviors.

## Why

Signature interoperability can fail across runtimes when canonical JSON behavior differs on valid edge cases. Ensuring deterministic UTF-8 byte output and explicitly rejecting unsupported objects guarantees perfect multi-platform payload validation.

## Acceptance Criteria

- ✅ Official or equivalent RFC 8785 vectors pass.
- ✅ Unsupported values such as NaN, Infinity, BigInt, and undefined fail explicitly.
- ✅ Unicode and escaping behavior is deterministic across runtimes.
- ✅ The send pipeline signs canonical bytes from the shared encoder.
- ✅ Kept implementation inside strictly relevant crypto directories.

## Checklist

- [x] No breaking UI or API changes
- [x] Existing tests pass (including AEAD tag convention and Session Hierarchy)
- [x] Type safety strictly enforced
- [ ] Code review approved
- [ ] Ready to merge
```

## Validation Commands

```bash
# Type checking
npm run lint

# Run crypto tests
npm run test -- tests/unit/crypto/

# Verification of JCS specifically
npm run test -- tests/unit/crypto/jcs.test.ts
```

---

**Scope:** This PR introduces `src/services/crypto/jcs.ts`, its related tests, and modifies `src/services/crypto/envelope.ts`. All changes are scoped strictly to the cryptographic payload resolution system.
