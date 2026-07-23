# Canonical Request Signing System (v1 Specification)

This document describes the canonical request signing and verification architecture implemented in `src/server/api/auth`. The goal of canonical signing is to prevent request signature replay, tamper attacks across HTTP methods, modified request paths/query strings, payload body tampering, timestamp manipulation, and audience spoofing.

---

## 1. Canonical Payload Format

The canonical signing payload is a deterministic, multi-line UTF-8 string consisting of exactly 7 fields separated by LF (`\n` / `0x0A`) characters in this strict order:

```text
<version>
<HTTP_METHOD>
<CANONICAL_ROUTE>
<SHA256_BODY_HASH>
nonce=<NONCE>
iat=<ISSUED_AT>
aud=<AUDIENCE>
```

### Example Format

```text
v1
POST
/api/auth/login
475f0f9600f0efc50029867287851d7f9db84dc5416c4fc307d6473cb868e010
nonce=nonce-abc-123
iat=2026-07-23T00:00:00.000Z
aud=remitflow-api
```

### Field Definitions

1. **`version`**: Protocol version string (e.g. `v1`).
2. **`HTTP_METHOD`**: Uppercase HTTP method (e.g., `GET`, `POST`, `PUT`, `DELETE`).
3. **`CANONICAL_ROUTE`**: Normalized route path (e.g. `/api/auth/login`).
   - Removes query strings and hash fragments.
   - Collapses consecutive slashes (`//` -> `/`).
   - Ensures a leading slash `/`.
   - Strips trailing slash unless the path is `/` (so `/auth/login/` and `/auth/login` resolve identically).
4. **`SHA256_BODY_HASH`**: Lowercase hexadecimal string of the SHA-256 hash of the request body.
   - Empty or whitespace-only bodies hash the empty string `""` -> `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
   - Valid JSON payloads are serialized with **stable key ordering** (keys sorted lexicographically at all nesting levels, no extraneous whitespace) before hashing.
5. **`nonce`**: Cryptographically unpredictable nonce string prefixed with `nonce=`.
6. **`iat`**: Issue timestamp prefixed with `iat=` (RFC 3339 string or Unix epoch timestamp in seconds/milliseconds).
7. **`aud`**: Target audience identifier prefixed with `aud=` (e.g. `remitflow-api`).

---

## 2. Client Signing Process (SDK Implementation)

When sending an authenticated request, SDK developers perform the following steps:

1. **Prepare Request Attributes**:
   - HTTP Method: `POST`
   - Route Path: `/api/auth/login`
   - Request Body: `{ "username": "alice", "role": "admin" }`
   - Nonce: Securely generated random hex string (e.g. `nonce-abc-123`).
   - Issued At: Current UTC RFC 3339 timestamp (e.g. `2026-07-23T00:00:00.000Z`).
   - Audience: Target API audience (e.g. `remitflow-api`).

2. **Compute Canonical Body Hash**:
   - Serialize JSON deterministically: `{"role":"admin","username":"alice"}`.
   - Compute SHA-256 digest hex.

3. **Construct Canonical Payload**:
   - Join the 7 fields with `\n`.

4. **Sign the Payload**:
   - Sign the UTF-8 bytes of the canonical payload using Ed25519, RSA, or HMAC secret.
   - Encode the signature in Base64 (or hex for HMAC).

5. **Attach Request Headers**:
   ```http
   POST /api/auth/login HTTP/1.1
   Host: api.remitflow.com
   X-Stealth-Nonce: nonce-abc-123
   X-Stealth-Timestamp: 2026-07-23T00:00:00.000Z
   X-Stealth-Audience: remitflow-api
   X-Stealth-Signature: <base64-signature>
   Content-Type: application/json

   { "username": "alice", "role": "admin" }
   ```

### SDK Code Example (TypeScript / JavaScript)

```typescript
import { createHash, sign } from "node:crypto";
import { canonicalJson } from "./canonicalJson";
import { buildCanonicalSigningPayload } from "./canonicalSigningPayload";

function signRequest(opts: {
  privateKey: any;
  method: string;
  url: string;
  body?: unknown;
  nonce: string;
  issuedAt: string;
  audience: string;
}) {
  const payload = buildCanonicalSigningPayload({
    version: "v1",
    method: opts.method,
    route: opts.url,
    body: opts.body,
    nonce: opts.nonce,
    issuedAt: opts.issuedAt,
    audience: opts.audience,
  });

  const signature = sign(null, Buffer.from(payload, "utf8"), opts.privateKey).toString("base64");
  return { payload, signature };
}
```

---

## 3. Server-Side Verification Flow

When the server receives an incoming request:

1. **Extract Headers and Payload Parameters**:
   - Read method, route, body, nonce, timestamp, audience, and signature header.

2. **Validate Request Window (Timestamp)**:
   - Verify `issuedAt` is within the validity window (`now - 5 mins <= issuedAt <= now + 30s`).
   - If invalid/expired, reject with `TIMESTAMP_INVALID`.

3. **Validate Audience**:
   - Require `audience === expectedAudience`. If mismatch, reject with `AUDIENCE_MISMATCH`.

4. **Reconstruct Canonical Payload**:
   - Normalize route via `canonicalizeRoute(route)`.
   - Compute body hash via `computeBodyHash(body)`.
   - Build canonical payload string using version builder (`buildCanonicalSigningPayload`).

5. **Verify Cryptographic Signature**:
   - Verify `signature` against reconstructed canonical payload string.
   - If signature check fails, reject with `SIGNATURE_INVALID`.

6. **Atomically Consume Nonce**:
   - Nonce service checks storage for replay. If previously consumed, reject with `409 Conflict` (replayed nonce).

7. **Proceed to Endpoint Execution**.

---

## 4. Replay Attack Protection & Security Matrix

| Attack Vector | Countermeasure / Security Check | Outcome |
| :--- | :--- | :--- |
| **HTTP Method Tampering** (POST -> GET) | Signature verification checks uppercase method line in payload. | **REJECTED** (`METHOD_MISMATCH` / `SIGNATURE_INVALID`) |
| **Route / Endpoint Modification** | Route normalized & included in payload. | **REJECTED** (`ROUTE_MISMATCH` / `SIGNATURE_INVALID`) |
| **Body Modification** | SHA-256 body hash included in signed payload. | **REJECTED** (`BODY_MISMATCH` / `SIGNATURE_INVALID`) |
| **JSON Whitespace / Key Shuffling** | `canonicalJson` enforces stable key ordering before hashing. | **DETERMINISTIC SUCCESS** |
| **Audience Spoofing** | Audience `aud=` checked against server audience. | **REJECTED** (`AUDIENCE_MISMATCH`) |
| **Nonce Replay** | Nonce consumed atomically in storage once validated. | **REJECTED** (`409 Conflict` / `replayed_nonce`) |
| **Timestamp Alteration** | `iat=` bound in signature & checked against clock skew. | **REJECTED** (`TIMESTAMP_INVALID`) |

---

## 5. Versioning Coexistence Architecture

Payload versioning uses a version dispatcher (`buildCanonicalSigningPayload`).

- `version = "v1"` is active.
- To introduce `v2` or `v3` in the future without breaking existing clients:
  1. Implement `buildV2CanonicalSigningPayload`.
  2. Register version via `registerPayloadBuilder("v2", buildV2CanonicalSigningPayload)`.
  3. Existing `v1` verification remains intact while `v2` clients use the new format.
