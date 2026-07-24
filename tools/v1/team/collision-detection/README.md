# Collision Detection

A self-contained V1 team tool workspace for detecting duplicate or colliding
team responses before a future integration wires it into the mail product.

**Release tier:** V1
**Audience:** Team
**Isolation boundary:** `tools/v1/team/collision-detection/`

## Purpose

Support teams can accidentally answer the same paid sender request or shared
thread more than once. This workspace prepares the collision-detection tool by
adding local safety and performance guards before any app-level integration.

The current implementation is intentionally small:

- `services/collisionGuards.ts` normalizes candidate responses, sanitizes unsafe
  text fields, caps attachments, and bounds how much history is inspected.
- `tests/collisionGuards.test.ts` verifies malformed input rejection, hostile
  text sanitization, bounded history processing, and stable duplicate-response
  fingerprints.
- `docs/SECURITY_AND_PERFORMANCE.md` records threat assumptions, unsafe inputs,
  and large-dataset performance notes for reviewers.

## Folder Structure

```text
collision-detection/
├── docs/
│   └── SECURITY_AND_PERFORMANCE.md
├── services/
│   └── collisionGuards.ts
├── tests/
│   └── collisionGuards.test.ts
├── README.md
├── specs.md
└── vitest.config.ts
```

## Usage

```ts
import { prepareCollisionInput } from "./services/collisionGuards";

const result = prepareCollisionInput(candidateResponses, {
  maxItems: 250,
  maxBodyChars: 8_000,
  maxAttachmentCount: 25,
});

if (!result.ok) {
  // Show validation errors before running collision analysis.
}
```

Each prepared candidate contains a stable `fingerprint` derived from the
sanitized thread id, recipient, subject, and body. Future detection logic can
compare fingerprints without reprocessing hostile raw payloads.

## Running Tests

From the repository root:

```bash
npx vitest run --config tools/v1/team/collision-detection/vitest.config.ts
```

The test config is folder-local and does not require wiring this tool into the
main app, router, inbox architecture, wallet core, database schema, or design
system.

## Review Boundary

Reviewers should expect this change to stay inside
`tools/v1/team/collision-detection/`. Any future integration with real mail,
team membership, routing, or persistence should be handled by a separate issue.
