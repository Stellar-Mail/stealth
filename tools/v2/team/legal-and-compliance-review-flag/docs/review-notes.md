# Review Notes

## Reviewer Intent

The folder-local service is designed for future UI integration while staying
fully isolated from the main app. It does not make legal decisions. It only
surfaces deterministic review signals so a human team member can decide whether
Legal, Compliance, Finance Operations, or the Team Owner should handle the item.

## Rule Coverage

- Legal review required: contract, NDA, MSA, DPA, addendum, liability, terms, or
  procurement language.
- Compliance risk: PII, personal data, regulated data, privacy, GDPR, HIPAA, or
  external customer data.
- Sanctions or export review: sanctions, embargo, restricted country, dual-use,
  or export-control wording.
- Finance review required: refund, chargeback, invoice, tax, or payment
  exception wording.
- Missing approval: high-value or external-data items without an assigned
  reviewer, legal owner, compliance owner, or approval marker.

## State Model

- `loading`: future UI can render a waiting state while local data is prepared.
- `empty`: callers passed an empty list and there is nothing to evaluate.
- `success`: each item has status, severity, flags, metadata, and reviewer
  suggestion.
- `error`: invalid local input shape; no item evaluation is attempted.

## Data Safety

Fixtures are invented and deterministic. The service does not read production
mail, call APIs, fetch remote resources, use secrets, or persist user data.
