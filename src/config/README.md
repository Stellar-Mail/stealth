# Config

Typed runtime configuration for networks, feature flags, API endpoints, and deployment environments.

## Authentication challenge validity

Authentication challenge timestamps are governed by two server environment variables:

- `STEALTH_AUTH_CHALLENGE_LIFETIME_MS` — maximum challenge age in milliseconds (default `300000`,
  five minutes). It must be a positive integer.
- `STEALTH_AUTH_CLOCK_SKEW_MS` — client/server clock-skew allowance in milliseconds (default `30000`,
  30 seconds). It must be a non-negative integer.

The accepted window is inclusive, from `issuedAt - clock skew` through
`issuedAt + lifetime + clock skew`. Validation is centralized in
`src/server/api/auth/challenge.ts`; authentication implementations should use its timestamp creator
and validator rather than comparing clocks directly.

## Authentication nonce expiration

`STEALTH_AUTH_NONCE_TTL_MS` controls how long a signed-authentication nonce remains consumable. The
default is `300000` milliseconds (five minutes). The value must be a positive integer number of
milliseconds; invalid configuration fails when the nonce service is initialized.
