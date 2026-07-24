# Phishing Link Scanner Fixtures

Use synthetic senders, reserved domains, and non-live links only.

## Display-Text Mismatch

Input:

```json
{
  "subject": "Security notice",
  "from": "security@example.test",
  "links": [
    {
      "displayText": "accounts.example.test",
      "href": "https://accounts-example-login.invalid/session"
    }
  ]
}
```

Expected:

- Risk: `suspicious` or `blocked`.
- Signals include display-text mismatch and account-security context.
- No link open, fetch, rewrite, or inbox mutation.

## Punycode Lookalike

Input:

```json
{
  "subject": "Review your account",
  "from": "notice@example.test",
  "links": [
    {
      "displayText": "billing.example.test",
      "href": "https://xn--billing-exmple-9db.invalid/update"
    }
  ]
}
```

Expected:

- Risk: `suspicious`.
- Warning mentions punycode or lookalike-domain handling.

## Shortened Payment Link

Input:

```json
{
  "subject": "Payment failed, action required",
  "from": "billing@example.test",
  "links": [
    {
      "displayText": "Fix payment",
      "href": "https://short.example.invalid/a1b2"
    }
  ]
}
```

Expected:

- Risk: `suspicious`.
- Signals include payment lure and shortened URL.

## Trusted Internal Link

Input:

```json
{
  "subject": "Internal handbook update",
  "from": "people@example.test",
  "trustedDomainHints": ["docs.example.test"],
  "links": [
    {
      "displayText": "docs.example.test/handbook",
      "href": "https://docs.example.test/handbook"
    }
  ]
}
```

Expected:

- Risk: `safe` or low-risk result.
- Explanation names the trusted-domain hint.

## Newsletter Links

Input:

```json
{
  "subject": "Weekly digest",
  "from": "digest@example.test",
  "links": [
    {
      "displayText": "Read story",
      "href": "https://news.example.test/story"
    },
    {
      "displayText": "Unsubscribe",
      "href": "https://news.example.test/unsubscribe"
    }
  ]
}
```

Expected:

- Risk: `unknown` or `safe`.
- Promotional tracking alone should not create a credential-theft warning.

## Empty Link Set

Input:

```json
{
  "subject": "",
  "from": "unknown@example.test",
  "links": []
}
```

Expected:

- Risk: `unknown`.
- Warning: no links or insufficient content.
