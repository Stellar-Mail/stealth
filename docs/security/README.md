# Security

Threat models, abuse cases, key-handling assumptions, audit notes, and privacy/security reviews.

## Browser boundary verification (BETA-078)

The application server applies security headers to every response, including static routes,
not-found responses, API errors, and CORS preflights. Production uses an explicit CORS origin
allowlist and HSTS; preview remains host-only for cookies so preview credentials cannot bleed into
the production domain.

Required production variables:

- `STEALTH_ENV=production`
- `STEALTH_APP_URL=https://app.stealth.mail`
- `STEALTH_CORS_ALLOWED_ORIGINS=https://app.stealth.mail`
- `STEALTH_COOKIE_DOMAIN=app.stealth.mail` (optional; set only when subdomain sharing is required)

Preview must use its own origin, for example `https://app-preview.stealth.mail`, and should omit
`STEALTH_COOKIE_DOMAIN`. Never use a wildcard origin with credentialed requests.

Repeatable repository checks:

```text
pnpm exec vitest run tests/unit/api/cors-routes.test.ts tests/unit/api/handler.test.ts tests/unit/api/response.test.ts
pnpm exec vitest run tests/unit/security/headers.test.ts tests/unit/api/auth/session-service.test.ts
pnpm lint
pnpm build
```

The browser policy intentionally permits `same-origin-allow-popups` for wallet/OAuth-style popup
return flows, while `frame-ancestors 'none'` and `X-Frame-Options: DENY` prevent embedding. Test
evidence must contain only redacted cookie values, request IDs, and response headers; never record
session tokens, recovery codes, wallet seeds, private keys, or production credentials.

- [Signed API authentication protocol v1](./api-authentication-v1.md) — Canonical request signing,
  challenge timing, nonce replay protection, errors, and executable interoperability vectors.

- [Metadata Privacy and Threat Model Policy](./metadata-policy.md) — Comprehensive data inventory, minimization rules, retention owners, and stable identifier threat review.
