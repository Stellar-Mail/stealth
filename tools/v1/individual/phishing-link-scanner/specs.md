# Phishing Link Scanner

Review email links for phishing indicators in a V1 individual workspace.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/phishing-link-scanner/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Purpose

Help an individual user review links found in email content without opening
them, mutating the mailbox, or relying on real customer messages.

## Functional Contract

- Input: normalized email subject, body, sender display/address, and extracted
  link objects.
- Each link object should include:
  - `href`
  - optional `displayText`
  - optional `source`
  - optional caller-provided `trustedDomainHints`
- Output: one phishing review model.
- The review model should include:
  - `risk`
  - `confidence`
  - `links`
  - `signals`
  - `warnings`
  - `recommendedAction`
- The scanner must be deterministic for the same input.
- If signals conflict, return `unknown` or a lower confidence result.
- The scanner must not click links, fetch remote pages, send email, delete
  email, label messages, or rewrite inbox content.

## Signal Categories

- Display text domain does not match the target `href` domain.
- Punycode, homoglyph-like, or lookalike domain patterns.
- URL shorteners or redirect-heavy patterns.
- Credential, wallet, payment, security, or urgent account lures.
- Suspicious TLD/domain age hints when supplied by the caller.
- Safe-list hints supplied by the caller for known internal domains.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## UI And Accessibility Expectations

- Risk labels must be visible as text, not color alone.
- Link domains and warning reasons should be keyboard and screen-reader
  reachable.
- Long URLs should wrap or truncate with an accessible full-value view.
- Users must be able to ignore a warning or copy the link for manual review.

## Security And Performance Expectations

- Do not open, prefetch, expand, or resolve links in the baseline scanner.
- Do not transmit links to an external reputation service in baseline tests.
- Parsing must be bounded for long email bodies and many links.
- Fixtures must use reserved domains and synthetic email content only.
- The scanner should treat allowlists as hints, not absolute proof of safety.

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
