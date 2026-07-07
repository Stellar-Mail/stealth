# Email Tone Rewriter - Data Ownership

This document defines owned data, runtime state, fixture rules, and future
adapter boundaries for the folder-local Email Tone Rewriter.

## Owned Data

| Data                 | Owner                           | Source                           | Mutation Rule                                                     |
| -------------------- | ------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `RewriteRequest`     | `services/emailToneRewriter.ts` | Caller input or local fixtures   | Read-only input; the engine returns a new result object.          |
| `ToneId`             | `services/emailToneRewriter.ts` | Folder-local supported tone list | Changes require matching tests and specs updates.                 |
| `ToneRewrite`        | `services/emailToneRewriter.ts` | Deterministic rewrite output     | Returned to caller for review; never auto-sent or persisted.      |
| `preservedKeyPoints` | `services/emailToneRewriter.ts` | Source draft body                | Extracted as review metadata; not stored externally.              |
| `RewriteActionFlags` | `services/emailToneRewriter.ts` | Constant disabled action policy  | `canSend`, `canSave`, and `canMutate` remain false in this issue. |
| `GUARD_LIMITS`       | `services/guards.ts`            | Folder-local hardening constants | Bounds work before the engine runs.                               |
| Sanitized draft copy | `services/guards.ts`            | Caller input                     | New copied request; caller object is not mutated.                 |
| Fixture drafts       | `services/fixtures.ts`          | Synthetic local examples         | Used by tests and review only.                                    |
| UI state props       | `components/`                   | Caller state and rewrite results | Rendered locally; no persistence or mailbox mutation.             |

## Runtime State

The current tool owns only transient local state:

- caller-supplied subject and body text while a rewrite is requested;
- sanitized copies of the same text;
- deterministic rewrite results;
- preserved key-point arrays;
- UI-ready idle, loading, ready, and error states;
- synthetic fixture drafts for tests.

The tool does not own:

- live inbox messages;
- compose drafts outside this folder;
- sent mail;
- rewrite history stored on a server;
- user accounts;
- authentication sessions;
- wallet accounts;
- Stellar transactions;
- database rows;
- notification delivery state;
- provider credentials;
- AI prompts sent to external services;
- external model responses.

## Lifecycle

```text
Caller draft input
    -> sanitizeRewriteRequest()
    -> checkRequestLimits()
    -> rewriteEmailTone()
    -> ToneRewrite review result
    -> component renders output with send/save/mutate disabled
```

No step writes to server APIs, shared app stores, queues, databases, inbox
state, compose state, notification services, provider services, AI providers,
wallet state, or Stellar ledgers.

## Fixture Rules

- Fixture drafts are synthetic examples for tests and local development.
- Fixture text must not include real inbox content, customer details, private
  user messages, secrets, API keys, access tokens, wallet data, provider
  credentials, production URLs, or production email addresses.
- Tests may import fixtures but must not write back to fixture files.
- New fixtures should stay small, deterministic, and reviewable.

## Draft Privacy Rules

- Treat every caller-supplied draft as private untrusted text.
- Do not log raw draft content in production integrations.
- Do not send draft content to external AI providers or provider SDKs in this
  issue.
- Do not store draft content or rewrite history in this issue.
- Do not include production drafts in snapshots, fixtures, docs, or review
  notes.

## Result Ownership

The rewrite result is review metadata, not a send instruction:

- `rewrittenBody` is suggested text for user review.
- `preservedKeyPoints` are local review anchors.
- `wordCount`, `truncated`, and `changed` are local display metadata.
- `actions.canSend`, `actions.canSave`, and `actions.canMutate` remain false.

A future integration may copy a reviewed rewrite into a compose surface only
through an explicit adapter issue. That adapter must define user confirmation,
audit, retention, and error-handling rules before any send or save behavior is
enabled.

## Future Integration Adapter Boundary

If a later issue connects this tool to live app data, it must add an explicit
adapter or wrapper layer and review:

- user authentication and authorization;
- compose insertion behavior;
- inbox and mailbox read rules;
- draft save and send confirmation;
- privacy limits for draft text;
- retention and deletion behavior for rewrite history;
- audit logging without raw private content;
- provider and AI service boundaries if any remote rewrite is introduced;
- rate limits, retries, and failure display;
- accessibility and review-state requirements for mounted UI.

The current architecture issue documents those boundaries but does not
implement the adapter.

## Security Constraints

- Do not include secrets, tokens, API keys, wallet data, production IDs, or real
  user data in fixtures.
- Do not send, save, enqueue, persist, or mutate rewrite output automatically.
- Do not call external AI providers, provider SDKs, production APIs, webhooks,
  background jobs, or queues.
- Keep validation and guard errors structural and non-sensitive.
- Keep all changed files for this issue inside
  `tools/v1/individual/email-tone-rewriter/`.
