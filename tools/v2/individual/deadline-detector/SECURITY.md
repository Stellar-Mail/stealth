# Deadline Detector - Threat Model & Performance Constraints

## Threat Assumptions
1. **Unsafe/Hostile Inputs**: Emails containing malicious scripts or prompt injection payload strings.
2. **Denial of Service (ReDoS)**: Specially crafted strings designed to cause exponential backtracking during regex execution.
3. **Payload Inflation**: Abusively large email bodies (>1MB) attempting to consume memory or freeze UI threads.

## Security Controls
- **Input Sanitization**: All incoming email text is sanitized and stripped of script tags using `sanitizeEmailInput()`.
- **Length Caps**: Input text is hard-capped at 50,000 characters per email.
- **Batching Safeguards**: Maximum batch processing size is restricted to 50 emails per invocation.
- **Regex Bounds**: Regex execution limits iteration caps and utilizes bounded, simple matcher patterns.

## Performance Profile
- **Temporal Keyword Pre-filtering**: Bypasses regex parsing completely if no deadline keywords (`due`, `deadline`, `eod`, etc.) are present.
