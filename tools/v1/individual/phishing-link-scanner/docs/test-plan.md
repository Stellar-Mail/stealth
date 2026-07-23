# Phishing Link Scanner Test Plan

## Goals

- Verify phishing labels are conservative, explainable, and deterministic.
- Guard against opening, fetching, or rewriting links during review.
- Confirm display-text mismatch and lookalike-domain warnings are surfaced.
- Keep all work inside the V1 individual tool folder.

## Automated Cases

1. Display-text mismatch

   - Given display text for a trusted brand but an unrelated target domain.
   - Expect `suspicious` or `blocked`, high confidence, and a mismatch signal.

2. Punycode domain

   - Given a link with an `xn--` domain that resembles a trusted domain.
   - Expect `suspicious` and a punycode warning.

3. URL shortener

   - Given a shortened link in a payment or account-security message.
   - Expect `suspicious` with shortener and lure signals.

4. Credential reset lure

   - Given reset-password language and a non-allowlisted domain.
   - Expect `blocked` or high-confidence `suspicious`.

5. Trusted domain hint

   - Given a caller-supplied trusted domain and matching target link.
   - Expect `safe` or low-risk output with the hint named.

6. Newsletter link

   - Given a benign newsletter with unsubscribe and tracking-style links.
   - Expect `unknown` or `safe` without credential-theft warnings.

7. Empty input

   - Given no links and minimal message content.
   - Expect `unknown` with an insufficient-content warning.

8. Determinism
   - Given the same message twice.
   - Expect identical risk, confidence, signal ordering, and warnings.

## Manual Review Checklist

- Confirm risk labels are visible as text.
- Confirm warnings name the suspicious domain or pattern.
- Confirm the UI never auto-clicks, expands, fetches, or rewrites links.
- Confirm long URLs remain readable without breaking layout.
- Confirm fixtures do not include real recipients, senders, payment accounts,
  wallet addresses, or live phishing URLs.

## Regression Expectations

- Adding a new risk signal requires one positive fixture and one false-positive
  fixture.
- Adding allowlist logic requires tests for exact-match, subdomain, and
  lookalike-domain cases.
- Any future inbox integration must keep explicit user control before mutation.
