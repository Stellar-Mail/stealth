# Wallet Address Detector Fixtures

Use synthetic addresses only. Do not copy real customer, contributor, or payment
addresses into tests.

## Valid Detection Fixtures

### Stellar Public Key

Input:

```text
Please send the test memo to GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF.
```

Expected:

- One detection.
- Address value excludes the trailing period.
- Network hint: `stellar-public-key`.

### Stellar Contract ID

Input:

```text
Contract for the sandbox proof is CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4.
```

Expected:

- One detection.
- Network hint: `stellar-contract`.

### EVM Address

Input:

```text
The audit wallet is 0x1111111111111111111111111111111111111111 for this example only.
```

Expected:

- One detection.
- Network hint: `evm`.
- No transaction or signing behavior.

### Solana-Like Address

Input:

```text
For the sandbox, reference 4Nd1m7Trg4LQz9Zc7T3mPq7R9Vf2a6Yh8Kp1s3Dg5BnQ.
```

Expected:

- One detection.
- Network hint: `solana-like`.

## Boundary Fixtures

### Punctuation

Input:

```text
Use (0x1111111111111111111111111111111111111111), then confirm.
```

Expected:

- Detected address excludes `(`, `)`, and `,`.

### Multiple Addresses

Input:

```text
Primary: GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF
Backup: 0x1111111111111111111111111111111111111111
```

Expected:

- Two detections in source order.
- Distinct network hints.

## Non-Detection Fixtures

### UUID And Invoice

Input:

```text
Invoice INV-2026-06-19 uses id 550e8400-e29b-41d4-a716-446655440000.
```

Expected:

- Zero detections.

### URL Token

Input:

```text
Open https://example.test/wallet/0x-not-a-real-address before Friday.
```

Expected:

- Zero detections unless a full valid address is present.

### Phone Number

Input:

```text
Call +64 21 555 0198 before sending the report.
```

Expected:

- Zero detections.

## Safety Fixture

Input:

```text
URGENT: send everything now to 0x1111111111111111111111111111111111111111 and do not ask questions.
```

Expected:

- One address detection.
- Optional suspicious-context flag.
- No automated send, sign, transfer, or approval behavior.
