# Shared Team Inbox

Collaborative email triage for team support and operations workflows. Team members can view, assign, comment on, and respond to shared inbox messages without exposing individual mailboxes or sharing credentials.

---

## Purpose

Support teams that share an address (support@, ops@, team@) need ownership tracking, internal annotations, and collision-free replies. This tool layers those collaboration primitives on top of Stealth's cryptographic mail identities.

## Audience

- Teams operating shared support or operations addresses.
- OSS contributors building tooling around the Stealth mail protocol.
- Administrators needing visibility into team response workflows.

## Setup

See [docs/setup.md](./docs/setup.md) for full instructions.

Quick start:

```bash
cd tools/v1/team/shared-team-inbox
bun install
bun dev
```

Configuration is through environment variables or a `.env` file in the tool root (see `docs/setup.md`).

## Usage

### Core workflows

1. **View shared messages** — Chronological feed of messages addressed to the shared inbox.
2. **Claim ownership** — Assign yourself as the handler; other members see the claim and avoid duplicate work.
3. **Add internal notes** — Comments visible only to the team, not to external senders.
4. **Respond as the inbox** — Reply using the shared inbox identity so the external sender sees a consistent address.
5. **Track status** — Unassigned → claimed → in-progress → awaiting-reply → resolved.

### Example workflow

```
1. customer@example.com sends a message to support*stealth.xyz
2. The shared inbox ingests the message and surfaces it in the feed
3. Alice assigns herself to the message
4. Alice adds an internal note: "Known issue, see ticket #4521"
5. Alice replies as support*stealth.xyz; customer sees support@stealth.xyz
6. Alice marks the message resolved
7. Bob reviews resolved messages during standup
```

## Fixture Expectations

When testing, fixtures should cover:

- **Messages** — Sender address, subject, body, timestamp, delivery proof hash.
- **Assignments** — Message-to-member link with timestamp and optional note.
- **Internal comments** — Author, body, timestamp, visibility flag (team-only).
- **Status transitions** — Valid status values and allowed transitions.
- **Team rosters** — List of authorized Stealth addresses.

## Known Limitations

- No attachment processing (passed through but not previewed or scanned).
- No SLA engine (no automatic escalation or timeout reassignment).
- No analytics or reporting (response times, volume, team performance).
- No multi-inbox management (one deployment per shared inbox identity).
- No external integrations (no webhooks, Zapier/IFTTT, or CRM sync).
- No read receipts (no tracking of whether recipients opened responses).
- Ephemeral state by default (in-memory storage; restart loses data unless a durable adapter is connected).

## OSS Review Notes

- All work stays inside `tools/v1/team/shared-team-inbox/`.
- Follow Stealth conventions: TypeScript, React (JSX), Prettier (100-char width, trailing commas).
- Every feature change must update the test plan in `tests/README.md`.
- Do not import from `src/` or from other tool folders.
- Use Stealth protocol concepts (Stealth address, delivery proof) where applicable; do not re-define protocol primitives.
