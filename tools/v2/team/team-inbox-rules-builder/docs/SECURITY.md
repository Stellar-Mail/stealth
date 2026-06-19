# Security Hardening - Team Inbox Rules Builder

This document outlines the security assumptions, threat model, and hardening measures implemented for the Team Inbox Rules Builder.

## Threat Assumptions

### 1. Hostile Input via Rule Definitions
- **Threat**: A user (or a malicious script) could provide rule names, descriptions, or condition values that are extremely large, potentially causing memory exhaustion or UI degradation.
- **Threat**: Malicious regex patterns in the `matches` operator could lead to Regular Expression Denial of Service (ReDoS).
- **Mitigation**:
    - Enforce length limits on all string inputs (Name: 100 chars, Description: 500 chars, Condition Value: 1000 chars).
    - Validate regex patterns before evaluation and use a timeout or safe-regex check if possible. (Note: standard JS RegExp doesn't have a built-in timeout, so we'll focus on pre-validation).

### 2. Malformed Rule Data
- **Threat**: Rule definitions imported via JSON might contain invalid fields, missing IDs, or circular logic (if extended in the future).
- **Mitigation**: Use Zod schema validation for all rule-related data structures, especially during import and CRUD operations.

### 3. Data Exfiltration via Actions
- **Threat**: The `forwardTo` action could be used to automatically exfiltrate sensitive emails to external addresses.
- **Mitigation**: While this tool is standalone and doesn't execute real actions, future integration should include an allow-list for forwarding domains or require administrative approval for such rules.

## Unsafe Inputs to Watch

| Input Field | Risk | Constraint |
|-------------|------|------------|
| Rule Name | UI Injection / Overflow | Max 100 characters |
| Rule Description | UI Injection / Overflow | Max 500 characters |
| Condition Value | ReDoS / Memory | Max 1000 characters, Regex validation |
| Action Config | Malformed data | Schema validation |

## Security Guards

- **Input Sanitization**: All string inputs are trimmed.
- **Schema Validation**: Every rule creation and update is validated against a Zod schema.
- **Regex Safety**: The `matches` operator handles invalid regex gracefully and avoids executing potentially catastrophic patterns.
