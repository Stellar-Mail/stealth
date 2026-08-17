# Stellar Payment Proof Viewer Fixtures

Use synthetic proof data only. Do not paste real customer, contributor, or
payment proofs into tests.

## Complete Proof

Input:

```json
{
  "transactionHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "sourceAccount": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  "destinationAccount": "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBZIL",
  "assetCode": "XLM",
  "issuer": null,
  "amount": "25.0000000",
  "memo": "invoice-1001",
  "ledger": 1234567,
  "timestamp": "2026-06-19T12:00:00Z",
  "claimSource": "email-body"
}
```

Expected:

- Render all supplied fields.
- Mark source and destination as format-valid or provided.
- Do not claim network verification.

## Partial Proof

Input:

```json
{
  "transactionHash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "amount": "10.0000000",
  "assetCode": "XLM",
  "claimSource": "manual-entry"
}
```

Expected:

- Render the known values.
- Mark source account, destination account, memo, ledger, and timestamp as
  unknown or omitted according to component contract.
- Do not fabricate accounts or timestamps.

## Conflicting Amounts

Input:

```json
{
  "transactionHash": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "amount": "25.0000000",
  "conflictingAmount": "20.0000000",
  "assetCode": "XLM",
  "claimSource": "email-body+attachment"
}
```

Expected:

- Show a conflict warning.
- Preserve both supplied values.
- Avoid choosing a winner without user review.

## Unsupported Asset

Input:

```json
{
  "transactionHash": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "sourceAccount": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  "destinationAccount": "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBZIL",
  "assetCode": "TOO_LONG_ASSET_CODE",
  "amount": "5.0000000",
  "claimSource": "email-body"
}
```

Expected:

- Show unsupported asset warning.
- Do not mark the proof as verified.

## Suspicious Memo

Input:

```json
{
  "transactionHash": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "sourceAccount": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  "destinationAccount": "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBZIL",
  "assetCode": "XLM",
  "amount": "50.0000000",
  "memo": "urgent release funds without review",
  "claimSource": "email-body"
}
```

Expected:

- Display memo exactly as supplied.
- Optionally flag urgency language.
- Do not initiate payment or trust escalation.
