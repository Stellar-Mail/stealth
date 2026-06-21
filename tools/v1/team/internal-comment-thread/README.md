# Internal Comment Thread

Team-only internal annotations attached to messages in a shared inbox. Comments are visible exclusively to authorized team members and are never exposed to or delivered to the external sender under any circumstances.

---

## Purpose

Support and operations teams need a private channel to discuss context, next steps, known issues, and internal decisions about incoming messages without leaking any of that information back to the customer or external sender. This tool provides that isolated comment surface on top of Stealth's shared inbox primitives.

## Audience

- Teams operating shared support, ops, or community inboxes.
- OSS contributors implementing team collaboration features on the Stealth protocol.
- Maintainers who need audit trails of internal discussion that never leaves the team boundary.

## Setup

See [docs/setup.md](./docs/setup.md) for full instructions.

Quick start:

```bash
cd tools/v1/team/internal-comment-thread
bun install
bun dev
```

Configuration is through environment variables or a `.env` file in the tool root (see `docs/setup.md`).

## Usage

### Core workflows

1. **View message context** — Open a shared inbox message.
2. **Add internal comment** — Write a note visible only to the team.
3. **Browse team comments** — See all prior internal discussion on the same message/thread.
4. **Edit or delete own comments** — Subject to team policy (future).
5. **Never leak to sender** — No code path may include comment content in any reply, forward, or external notification.

### Example workflow

```
1. customer@example.com sends a message to support@stealth.xyz
2. The shared inbox surfaces the message for the team
3. Alice (team) adds internal comment: "Customer is on the old plan, see ticket #3192"
4. Bob (team) sees the comment, replies to customer using the shared identity
5. The external sender never sees Alice's or Bob's internal note
```

## Fixture Expectations

When testing, fixtures should cover:

- **Messages** — Sender address, subject, body, timestamp, delivery proof.
- **Internal comments** — Author (Stealth address), body, timestamp, reference to source (message or thread).
- **Visibility enforcement** — Every generated artifact must prove that comment text cannot reach an external address.
- **Team roster** — List of authorized team Stealth addresses.

## Known Limitations

- Attachment scope (single message vs. whole thread) is undecided.
- Reply structure (nested threads vs. flat list) is undecided.
- No editing of other members' comments yet.
- No @mentions or notifications inside the team.
- No attachment of files or images to comments.
- No search or filtering over comment history.
- Ephemeral state by default (in-memory storage; restart loses data unless a durable adapter is connected).

## OSS Review Notes

- All work stays inside `tools/v1/team/internal-comment-thread/`.
- Follow Stealth conventions: TypeScript, React (JSX), Prettier (100-char width, trailing commas).
- Every feature change must update the test plan in `tests/README.md`.
- Do not import from `src/` or from other tool folders.
- **Firm rule**: comment content must never appear in any payload, header, or log that could be delivered to an external sender. This rule is non-negotiable for this tool.
- Use Stealth protocol concepts (Stealth address, delivery proof) where applicable.
