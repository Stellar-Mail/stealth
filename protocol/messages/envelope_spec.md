# Cryptographic Message Envelope Specification

To ensure interoperability across independent client implementations, the Stealth protocol defines a single normative envelope and signature scheme.

## 1. Envelope Structure

The envelope is a JSON object with two top-level fields: `payload` and `signature`.

```json
{
  "payload": {
    "version": "v1",
    "sender": "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "recipient": "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    "timestamp": "2026-06-17T22:00:00Z",
    "encryption_metadata": {
      "algorithm": "X25519-XSalsa20-Poly1305",
      "ephemeral_public_key": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "nonce": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "mac": "86355651ecbc6e969d27038e8e78e86cf0f4e1f7a0756e0766a5cfbfcae29202"
    },
    "content_commitment": "5b40cf39e4a86e969d27038e8e78e86cf0f4e1f7a0756e0766a5cfbfcae29202",
    "attachments": [
      {
        "filename": "invoice.pdf",
        "content_type": "application/pdf",
        "size_bytes": 10240,
        "content_hash": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
      }
    ],
    "critical": ["custom_mandatory_header"]
  },
  "signature": {
    "scheme": "Ed25519",
    "value": "86355651ecbc6e969d27038e8e78e86cf0f4e1f7a0756e0766a5cfbfcae2920286355651ecbc6e969d27038e8e78e86cf0f4e1f7a0756e0766a5cfbfcae29202"
  }
}
```

### Fields

#### Payload

- `version` (string): The envelope format version (e.g. `"v1"`).
- `sender` (string): Stellar G-address of the sender.
- `recipient` (string): Stellar G-address of the recipient.
- `timestamp` (string): ISO 8601 UTC timestamp string.
- `encryption_metadata` (object): Encryption parameters.
  - `algorithm` (string): The scheme name (e.g., `"X25519-XSalsa20-Poly1305"`).
  - `ephemeral_public_key` (string): Ephemeral public key (Stellar G-address).
  - `nonce` (string): Hex-encoded encryption nonce.
  - `mac` (string): 32-byte hex-encoded message authentication code.
- `content_commitment` (string): SHA-256 digest of the encrypted payload ciphertext.
- `attachments` (array): List of attachment descriptors.
  - `filename` (string): File name.
  - `content_type` (string): MIME type.
  - `size_bytes` (integer): Size of attachment in bytes.
  - `content_hash` (string): SHA-256 digest of the attachment data.
- `critical` (array of strings, optional): List of mandatory header names.

#### Signature

- `scheme` (string): The signature scheme (e.g., `"Ed25519"`).
- `value` (string): Hex-encoded signature bytes (128 hex characters for Ed25519).

---

## 2. Canonical Serialization (JCS)

To verify the signature, the `payload` object must be serialized to an unambiguous, canonical byte representation. Stealth uses the **JSON Canonicalization Scheme (JCS)** as defined in [RFC 8785](https://tools.ietf.org/html/rfc8785).

Key JCS rules:

1. Object keys are sorted lexicographically by their UTF-16 code units.
2. No unnecessary whitespace (e.g. spaces, tab characters, newlines) is included around structural delimiters (`:`, `,`, `{`, `}`, `[`, `]`).
3. Strings are enclosed in double quotes (`"`), and standard JSON escaping is applied uniformly.
4. Boolean values are serialized as `true` or `false`, and null is `null`.

### Signature Coverage

The cryptographic signature covers the canonicalized byte representation of the `payload` object.

```text
signature = sign(private_key, jcs(payload))
```

---

## 3. Extensibility and Fail-Closed Validation

To allow safe feature updates, the envelope is extensible.

1. **Unknown Optional Fields**: An implementation may ignore any key in the `payload` that is not defined in this specification, _unless_ it is designated as critical.
2. **Unknown Mandatory Fields**: If a key name is listed in the `critical` array, the recipient implementation _must_ recognize and validate that field. If the parser encounters a field in `critical` that it does not recognize, validation must immediately fail (fail closed).
