# Threat Model & Safety Assumptions: Shared Team Inbox (V1)

## 1. Threat Assumptions & Vectors

| Threat Vector | Source | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **XSS / HTML Injection** | Malicious email body / headers | Execution of arbitrary JavaScript in team context | Strict HTML sanitization; stripping dangerous tags (`<script>`, `<iframe>`, `object`) and attributes (`onload`, `onerror`, `javascript:` URLs). |
| **Payload DoS** | Oversized email bodies, nested MIME attachments | Browser memory exhaustion / tab freezing | Max body payload limit (1MB max, auto-truncated preview at 100KB); attachment metadata validation. |
| **Header / Metadata Spoofing** | Invalid/malformed sender headers | UI misleading / impersonation | Strict schema validation on `sender`, `recipient`, `timestamp`, and `teamId`. |
| **Resource Exhaustion** | Unbounded list sizes (thousands of emails) | DOM node bloat, rendering lag | Forced pagination limits (max 50 items/page) and thread depth truncation. |

## 2. Unsafe Inputs & Redaction Rules

- **Emails with Inline JavaScript**: All inline scripts and `data:` or `javascript:` URI schemes are stripped prior to rendering.
- **Malformed Team Context**: Missing or invalid `teamId` formats are immediately flagged and isolated by guard helpers.
- **Oversized Attachments**: Attachments exceeding 25MB are flagged as unprocessable in-browser and require stream handling.
