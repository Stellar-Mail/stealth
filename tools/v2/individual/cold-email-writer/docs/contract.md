# Non-UI execution contract

## Service boundaries

| Entry point                                             | Intended caller                                 | Behavior                                                |
| ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| `safeWriteColdEmail(input: unknown, options?: unknown)` | API handlers, jobs, and other untrusted callers | Validates, sanitizes, enforces limits, and never throws |
| `writeColdEmail(input, options?)`                       | Trusted internal code                           | Pure deterministic writer; assumes valid input          |

The module is synchronous and has no network, storage, mailbox, clock,
randomness, UI, or framework dependencies. Generated output is a draft only;
delivery is explicitly outside this service boundary.

## Input and output

`ColdEmailWriterInput` requires a caller-owned `requestId`, sender and recipient
identities, an `offer`, a `valueProposition`, and a `callToAction`. Proof points
and the `professional`, `friendly`, or `direct` tone are optional.

`ColdEmailWriterOptions` controls subject inclusion and caps the generated body
at 1–300 words.

Successful execution returns `ColdEmailWriterOutput`: the echoed request ID,
nullable subject, plain-text body, resolved tone, and deterministic word/proof
metadata. The guarded entry point wraps this as:

```ts
{ status: "ok", result: ColdEmailWriterOutput }
```

Failures use:

```ts
{
  status: "error";
  code: ColdEmailWriterErrorCode;
  message: string;
  issues: ColdEmailWriterValidationIssue[];
}
```

## Stable error codes

| Code              | Meaning                                                |
| ----------------- | ------------------------------------------------------ |
| `invalid-input`   | Payload shape or field type is invalid                 |
| `invalid-options` | Options are malformed or outside supported bounds      |
| `input-too-large` | A field or collection exceeds a documented guard limit |
| `empty-content`   | A required string is empty after sanitization          |

## Fixtures

`services/fixtures.ts` exports typed `successFixtures` and `failureFixtures`.
Every failure fixture declares its expected stable error code, making the
contract reusable by backend adapters and tests.
