# Username Reservation & Federation Mapping (Issue #1910 / BETA-003)

This document specifies how a canonical Stealth username is derived, reserved,
and mapped onto the two public-facing address forms used elsewhere in the
protocol. It complements [`README.md`](./README.md), which covers Stealth
address _resolution_; this document covers how a name becomes reservable and
resolvable in the first place.

## 1. Canonical form

A username is never stored or compared in the form a user typed it. It is
first reduced to a **canonical form** by the normalization pipeline defined in
`src/features/identity/username.ts`:

1. Unicode NFKC normalization (folds fullwidth/compatibility variants, e.g.
   fullwidth Latin, to their ordinary ASCII form).
2. Invisible/zero-width character stripping (soft hyphen, zero-width
   space/ZWNJ/ZWJ, word joiner, BOM).
3. Confusable folding: a curated table of common Cyrillic/Greek homoglyphs
   (e.g. Cyrillic "а" U+0430) is folded to its Latin lookalike.
4. Case folding (lowercase) and trimming.

Every lookup, availability check, and reservation runs the candidate through
this exact pipeline before touching storage, so "alice", "Alice", "ALICE",
and confusable look-alikes always resolve to the single canonical value
`alice`. Any character not recognized by the confusable table and not already
ASCII is rejected outright by the charset rule below — the pipeline never
guesses at an unknown homoglyph.

## 2. Validation rules

Applied to the canonical form:

| Rule                | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| Minimum length      | 3                                                     |
| Maximum length      | 30                                                    |
| Allowed characters  | `a-z`, `0-9`, `_`, `-`                                |
| Boundary characters | must start and end with a letter or digit             |
| Reserved words      | rejected outright (see the `RESERVED_USERNAMES` list) |

Format, length, and reserved-word violations are deterministic functions of
the input alone and are surfaced as request validation failures — they never
reach the reservation/availability storage layer, and never need to reveal
anything about existing reservations.

## 3. Address mapping

A reserved canonical username `<name>` has exactly two public forms:

| Form               | Pattern             | Purpose                                                                                                                                                                                 |
| ------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stealth address    | `<name>@stealth.me` | Human-facing, mail-style identity shown in the product.                                                                                                                                 |
| Federation address | `<name>*stealth.me` | [SEP-2 Stellar federation](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0002.md) address, resolvable via a `/federation?q=<name>*stealth.me&type=name` lookup. |

Both forms are derived deterministically from the same canonical name and are
persisted together on the reservation record — they can never drift apart or
be reserved independently. Building the public `/federation` HTTP resolver
endpoint itself (the SEP-2 server side) is tracked separately as BETA-026;
this reservation flow only guarantees the mapping exists and is atomic.

## 4. Atomicity

Reservation is a single "reserve if absent" operation keyed by the canonical
username (`ApiRepository.reserveUsernameIfAbsent`). Concurrent claims for the
same canonical username — including case or confusable variants of each
other — are guaranteed exactly one winner; every other caller receives a
deterministic `username_taken` (409) response that reflects the actual
winning owner, never its own losing payload. See
`src/server/api/stealth-coordinator.ts` for the Durable Object implementation
backing this guarantee in production, and
`src/server/api/memory-repository.ts` for the development equivalent.

## 5. API surface

| Method | Path                                                 | Auth                                    | Purpose                                                                                                                                                              |
| ------ | ---------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/identity/usernames/{username}/availability` | Public                                  | Returns `{ username, available }` for the canonical form of `{username}`. Never reveals an owner.                                                                    |
| `POST` | `/api/v1/identity/usernames`                         | Required (`x-stealth-address` / SEP-10) | Reserves `{ username }` for the authenticated actor; returns the full `UsernameRecord`, including both address forms. Supports `X-Idempotency-Key` for safe retries. |

See `openapi.json` (generated from `src/server/api/openapi.ts`) for the full
request/response schema.
