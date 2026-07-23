# Crypto Services

Encryption, signing, verification, key derivation, and payload hash helpers.

## Memory budget

The `sealEnvelope` path is the primary allocation-sensitive crypto operation.
The table below documents the worst-case live bytes at each phase for a body
of **N** bytes and **A** attachments each ≤ **M** bytes.

| Phase                  | Peak live bytes       | Notes                              |
| ---------------------- | --------------------- | ---------------------------------- |
| Key generation         | ~0 (opaque CryptoKey) |                                    |
| Body encrypt           | N + (N+16) + 12       | plaintext + ciphertext + IV (pool) |
| After body encrypt     | N+16                  | plaintext zeroed via `clearSecret` |
| Content commitment     | N+16 + 32             | ciphertext + SHA-256 digest        |
| Per-attachment encrypt | M + (M+16)            | sequential, freed per iteration    |
| Base64 body ciphertext | N+16 + ⌈(N+16)/3⌉×~4  | ciphertext zeroed after encoding   |
| **Worst-case peak**    | **≈ 2N + 28**         | body only, no attachments          |

Previous peak was ≈ 3N + 48 (plaintext + ciphertext + base64 intermediate
binary string + hex helpers all alive simultaneously).

### Cancellation

`sealEnvelope` accepts an optional `AbortSignal`. When aborted, all internal
buffer references are released and the promise rejects. Callers should pass a
signal to avoid holding large buffers when a send is cancelled.

### Buffer pool

`memory.ts` exports a `BufferPool` (and a `sharedPool` singleton) for reusing
ArrayBuffers across sequential crypto operations. Pool buffers are zeroed on
release (best-effort secret erasure) and capped at 8 entries per size bucket
to bound total pooled memory.

### Hex / Base64 encoding

`memory.ts` provides lookup-table hex encoding (O(n), no intermediate string
concatenation) and direct base64 encoding (no intermediate binary string).
These replace the per-module ad-hoc helpers that used `out += ...` concatenation
(O(n²) for hex) and `String.fromCharCode` loops (2× peak for base64).
