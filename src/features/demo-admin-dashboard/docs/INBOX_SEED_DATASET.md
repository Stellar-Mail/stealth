# Inbox Seed Dataset

A local starter dataset (`DemoDataset`) that mirrors the current demo inbox while
remaining fully owned by this admin-dashboard folder. Every address, hash, and
timestamp is fake, deterministic, and safe for public-repository review.

## Quick start

```ts
import { inboxSeedDataset, inboxSeedMetadata } from "@/features/demo-admin-dashboard";

// Full dataset (messages + senders)
console.log(inboxSeedDataset.id); // "inbox-seed-v1"
console.log(inboxSeedDataset.messages.length); // 21

// Precomputed metadata
console.log(inboxSeedMetadata.totalMessages); // 21
console.log(inboxSeedMetadata.uniqueSenders); // 19
console.log(inboxSeedMetadata.messagesWithProof); // 13
```

## What is included

| Export                  | Location                        | Description                                     |
| ----------------------- | ------------------------------- | ----------------------------------------------- |
| `inboxSeedDataset`      | `fixtures/inboxSeedDataset.ts`  | Aggregate `DemoDataset` with messages + senders |
| `inboxSeedMessages`     | `fixtures/inboxSeedDataset.ts`  | `DemoMessage[]` — 21 messages                   |
| `inboxSeedSenders`      | `fixtures/inboxSeedDataset.ts`  | `DemoSender[]` — 19 unique senders              |
| `inboxSeedMetadata`     | `fixtures/inboxSeedMetadata.ts` | Precomputed counts, label/sender lists          |
| `inboxSeedFolderMap`    | `fixtures/inboxSeedMetadata.ts` | Message id → original inbox folder              |
| `inboxSeedFolderCounts` | `fixtures/inboxSeedMetadata.ts` | Folder → total message count                    |

## Message coverage

The 21 seed messages exercise every folder in the original demo inbox:

| Folder    | Count | Message IDs                                                   |
| --------- | ----- | ------------------------------------------------------------- |
| priority  | 1     | `seed-msg-01`                                                 |
| verified  | 1     | `seed-msg-02`                                                 |
| pending   | 1     | `seed-msg-03`                                                 |
| inbox     | 2     | `seed-msg-04`, `seed-msg-16`                                  |
| requests  | 3     | `seed-msg-05`, `seed-msg-05b`, `seed-msg-05c`                 |
| encrypted | 4     | `seed-msg-06`, `seed-msg-06b`, `seed-msg-06c`, `seed-msg-06d` |
| receipts  | 1     | `seed-msg-07`                                                 |
| snoozed   | 1     | `seed-msg-08`                                                 |
| archive   | 1     | `seed-msg-09`                                                 |
| sent      | 1     | `seed-msg-10`                                                 |
| drafts    | 1     | `seed-msg-11`                                                 |
| scheduled | 1     | `seed-msg-12`                                                 |
| outbox    | 1     | `seed-msg-13`                                                 |
| spam      | 1     | `seed-msg-14`                                                 |
| trash     | 1     | `seed-msg-15`                                                 |

## Query helpers

Pure, non-mutating utility functions live in `utils/inboxSeedHelpers.ts`:

```ts
import { inboxSeedMessages, inboxSeedSenders } from "@/features/demo-admin-dashboard";
import { getMessagesByLabel, getTrustedSenders } from "@/features/demo-admin-dashboard";

const securityMessages = getMessagesByLabel(inboxSeedMessages, "Security");
const trusted = getTrustedSenders(inboxSeedSenders);
```

Available helpers:

- `getMessagesByLabel(messages, label)` — case-insensitive label filter
- `getMessagesBySender(messages, address)` — case-insensitive sender filter
- `getMessagesByProofStatus(messages, status)` — proof status filter
- `getMessagesByFolder(messages, folder)` — original inbox folder filter
- `getUnreadMessages(messages)` / `getStarredMessages(messages)`
- `getMessagesWithAttachments(messages)` / `getMessagesWithCalendarEvent(messages)`
- `getSnoozedMessages(messages)`
- `getTrustedSenders(senders)` / `getUntrustedSenders(senders)` / `getRelaySenders(senders)`
- `collectLabels(messages)` — sorted, de-duplicated label list
- `computeFolderDistribution(messages)` — folder → count map
- `findMessageById(messages, id)` / `findSenderByAddress(senders, address)`

## Safety guarantees

The seed dataset is safe for public repository review:

- **No real PII** — all names and email addresses are fictional.
- **No secrets** — no private keys, API tokens, or live wallet addresses.
- **No randomness** — all values are deterministic; importing the module
  always produces the same output. No `Math.random()`, `Date.now()`, or
  `crypto.randomUUID()`.
- **Safe domains only** — sender/recipient addresses use `@example.com`,
  `@example.org`, `*.stealth.demo`, or `*.stealth.network`.
- **Fake hashes** — all message hashes, payment hashes, diagnostic IDs, and
  signatures are mock hex strings. They are never submitted to a live network.

## Adding or modifying entries

1. Open `fixtures/inboxSeedDataset.ts`.
2. Add or edit a sender object at the top of the file (keep the pattern of
   module-level `const` variables).
3. Add or edit a message in the `inboxSeedMessages` array.
4. If the message belongs to a new folder, add an entry to
   `inboxSeedFolderMap` in `fixtures/inboxSeedMetadata.ts`.
5. Add or update tests in `__tests__/inboxSeedDataset.test.ts`.
6. Run the tests:
   ```bash
   npx vitest run src/features/demo-admin-dashboard/__tests__/inboxSeedDataset.test.ts
   ```

## Validation

Use `validateInboxSeedDataset(dataset)` to check the dataset for structural
soundness before exporting or publishing:

```ts
import { validateInboxSeedDataset } from "@/features/demo-admin-dashboard/validation";

const issues = validateInboxSeedDataset(inboxSeedDataset);
if (issues.length > 0) {
  console.log(issues);
}
```

The validator checks sender/recipient domain safety, duplicate IDs, proof
record consistency, and mandatory field presence.
