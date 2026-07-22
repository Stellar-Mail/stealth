# Threat Model & Unsafe Inputs

## Threat Assumptions

### 1. Untrusted Client Payloads
Submissions may originate from malicious actors or compromised integration scripts attempting to inject HTML/XSS script tags in `vendor` or `reason` fields.

### 2. Resource Exhaustion (DoS)
Attackers might submit massive string payloads (e.g. 10MB vendor names) or millions of invoice requests to degrade system performance or trigger Out-Of-Memory (OOM) crashes.

### 3. Financial Amount Spoofing
Invalid numerical inputs like `NaN`, `Infinity`, negative amounts, or extremely large numbers could corrupt financial accounting calculations.

## Mitigations Implemented
- `sanitizeString(val)` strips tags and null bytes while enforcing length limits.
- `validateInvoiceInput(input)` validates numerical range (`0 < amount <= 1,000,000,000`) and finite bounds.
- Pagination (`limit` & `offset`) limits response payload size.
- Status indexing (`Set<string>`) optimizes query lookup performance.
