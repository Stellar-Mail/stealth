# Config

Typed runtime configuration for networks, feature flags, API endpoints, and deployment environments.

## Authentication nonce expiration

`STEALTH_AUTH_NONCE_TTL_MS` controls how long a signed-authentication nonce remains consumable. The
default is `300000` milliseconds (five minutes). The value must be a positive integer number of
milliseconds; invalid configuration fails when the nonce service is initialized.
