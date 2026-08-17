# Config

Typed runtime configuration contract for networks, storage, session security, relay, contracts, and origin/CORS settings across deployment environments (`development`, `test`, `preview`, `production`).

## Architecture & Public vs. Secret Separation

Configuration is split strictly into **Public** and **Secret** layers:

- **Public Configuration (`PublicConfig`)**: Client-safe parameters (network URLs, public contract IDs, TTLs, CORS settings) containing **ZERO** secrets. Can be safely exposed to web app bundles or serialized in diagnostic matrices.
- **Secret Configuration (`SecretConfig`)**: Server-only parameters (`STEALTH_CURSOR_SECRET`, `STEALTH_RELAY_API_KEY`) that are strictly scrubbed from browser bundles, client states, error tracebacks, and logs (`[REDACTED]`).
- **Runtime Configuration (`BetaRuntimeConfig`)**: The unified contract combining Network, Storage, Session, Relay, Contract, and Origin parameters with environment bindings.

## Domain Categories

1. **Network**: `STEALTH_STELLAR_NETWORK`, `STEALTH_HORIZON_URL`, `STEALTH_SOROBAN_RPC_URL`, `STEALTH_NETWORK_PASSPHRASE`.
2. **Storage**: `STEALTH_STORAGE_DRIVER`, `STEALTH_KV_NAMESPACE_ID`, `STEALTH_KV`, `STEALTH_COORDINATOR`.
3. **Session & Security**: `STEALTH_CURSOR_SECRET`, `STEALTH_AUTH_CHALLENGE_LIFETIME_MS`, `STEALTH_AUTH_CLOCK_SKEW_MS`, `STEALTH_AUTH_NONCE_TTL_MS`, `STEALTH_QUOTE_LIFETIME_MS`.
4. **Relay**: `STEALTH_RELAY_URL`, `STEALTH_RELAY_API_KEY`, `STEALTH_RELAY_TIMEOUT_MS`.
5. **Contract**: `STEALTH_REGISTRY_CONTRACT_ID`, `STEALTH_POSTAGE_CONTRACT_ID`, `STEALTH_DOMAIN_TAG`, `STEALTH_PROTOCOL_VERSION`.
6. **Origin & CORS**: `STEALTH_APP_URL`, `STEALTH_CORS_ALLOWED_ORIGINS`, `STEALTH_CORS_ALLOWED_METHODS`, `STEALTH_CORS_ALLOWED_HEADERS`, `STEALTH_CORS_ALLOW_CREDENTIALS`.

## Environment Profiles

- `development`: Sensible local and testnet defaults. Memory storage permitted.
- `test`: Vitest and test runner defaults.
- `preview`: Staging verification profile with structural URL checks.
- `production`: Strict startup gate. All 6 domain areas must be configured with real values (no placeholder secrets, no placeholder KV IDs, no wildcard origins). Startup fails before serving any traffic if misconfigured.

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
