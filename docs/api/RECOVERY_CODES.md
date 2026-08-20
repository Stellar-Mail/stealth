# One-Time Recovery Codes (BETA-010 / Issue #1917)

This document is the authoritative statement of the recovery-code behavior
implemented by BETA-010, including the session-revocation semantics that the
issue requires to be "documented".

## Threat model

Recovery codes are emergency credentials: the user generates them while they
still have access, stores them offline, and later uses a single code to regain
account access after losing their password/keys. Because a leaked code is
difficult to detect, the design bakes in short material lifetimes and broad
revocation:

- Only PBKDF2-SHA256 hashes of codes are stored. The plaintext codes exist only
  in the machine's memory and in the single API response returned at
  generation time. They cannot be listed, downloaded again, or recovered
  server-side.
- Every code is single-use. After a successful redemption the matching hash is
  consumed atomically; an exhausted set is reported as `exhausted` by the
  status model.
- Redemption failures are uniform: a missing account, an exhausted set, a
  malformed code, and an already-used code all produce
  `401 unauthorized "Invalid or already used recovery code"`, so responses
  never reveal which condition held.

## Endpoints

| Method | Path                               | Auth                              | Purpose                                                    |
| ------ | ---------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| `GET`  | `/api/v1/auth/recovery/status`     | session cookie                    | Recovery-status safety model (never exposes code material) |
| `POST` | `/api/v1/auth/recovery/regenerate` | session cookie + recent login     | Replace the code set; returns plaintext codes exactly once |
| `POST` | `/api/v1/auth/recovery/redeem`     | none (the code is the credential) | Consumes one code and issues a fresh session               |

All mutation endpoints accept an `x-idempotency-key` header and are safe
against duplicate requests: a replayed key returns the stored response of the
original request instead of running the mutation again.

## Recent-login check (regeneration)

Regenerating codes is a privilege-sensitive action: anyone holding a valid
session could otherwise silently replace the user's recovery material and
lock the user out. Therefore `POST /auth/recovery/regenerate` requires the
presenting session to have authenticated with a password (or via a prior
recovery) within the last **15 minutes** (`RECOVERY_REGENERATION_LOGIN_WINDOW_MS`).
Sessions that predate this feature, or whose login is older than the window,
receive `403 forbidden` and an audit event. Signing in again (or using a
recovery code, which counts as a fresh authentication) refreshes the marker.

## Session revocation semantics

- **Using a code** (`POST /auth/recovery/redeem`) revokes **all** existing
  sessions for the account and issues a brand-new session. The account holder
  is assumed to have lost access; every previously issued session token is
  treated as potentially compromised and is discarded.
- **Generating or regenerating codes** (`POST /auth/recovery/regenerate`)
  revokes **every other** session for the account — the presenting session is
  recreated and preserved, so the actor stays signed in while all other
  devices are logged out.

Both cases are emitted as audit events
(`auth.recovery_code_redeemed`, `auth.recovery_codes_regenerated`,
`auth.user_other_sessions_revoked`), each with a success/denied result and a
non-sensitive reference (`user:<userId>`), so log review reconstructs the
revocation timeline without secrets.

## Storage

One record per account, `recoveryCodeSet` (registered schema version 1):

```ts
{
  userId,                 // owning account
  status,                 // "active" | "exhausted"
  codes: [{ hash, salt, usedAt }],  // PBKDF2-SHA256 hash + salt per code
  generatedAt, updatedAt, version
}
```

Writes go through the repository's optimistic-concurrency contract
(`setRecoveryCodeSet(set, expectedVersion)`): exactly one of N racing writers
wins, so a code can never be consumed twice and a concurrent regeneration can
never be silently overwritten. The `recoveryCodeSet` record type is registered
with the adapter-boundary validator like every other record family.

## Status model

The status payload (`GET /auth/recovery/status`) is:

```ts
{
  status: ("none" | "active" | "exhausted", totalCodes, remainingCodes, generatedAt);
}
```

It deliberately contains no hash material, no codes, and no identifiers beyond
the aggregate counters — the UI can answer "is recovery ready?" without ever
being able to expose secrets.

## Code format

Ten codes per set, each `XXXX-XXXX-XXXX-XXXX` (16 base32 characters = 80 bits
of entropy). Input normalization ignores case and separators, so
`abcd-efgh-jklm-nopq` is accepted. Downloads are manual: the UI offers a
`stealth-recovery-codes.txt` export produced client-side from the
single-generation response.
