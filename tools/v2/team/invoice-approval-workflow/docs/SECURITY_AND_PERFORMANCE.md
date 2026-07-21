# Security and Performance Specification

## Security Hardening
The `Invoice Approval Workflow` processes financial data and submission rationale. The tool enforces defensive programming principles to prevent input-based vulnerabilities:

1. **Input Sanitization**:
   - Strips dangerous HTML, `<script>` tags, and control characters from vendor strings, email addresses, and rejection rationale.
   - Prevents XSS injection when invoice rationale or vendor names are rendered downstream.

2. **Numerical Validation**:
   - Rejects non-finite numbers (`NaN`, `Infinity`), negative values, and non-numeric types.
   - Caps max amount to $1,000,000,000 to avoid numerical overflow.

3. **String Bounding**:
   - Enforces explicit length limits: vendor (200), email (254), rejection reason (1000), ID (100).

4. **Prototype Pollution Protection**:
   - Validates input keys to prevent property injection on JavaScript prototypes.

## Performance Design
1. **Status Indexing**: Maintains an auxiliary `Map<InvoiceStatus, Set<string>>` index to allow $\mathcal{O}(K)$ status filtering instead of scanning all $N$ invoices ($\mathcal{O}(N)$).
2. **Pagination**: Implements `limit` (default 50, max 100) and `offset` parameters for listing operations.
3. **Memory Safeguards**: Caps in-memory store capacity to 10,000 items to avoid memory exhaustion under high load.
