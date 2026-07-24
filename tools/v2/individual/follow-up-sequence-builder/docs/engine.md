# Follow-up Sequence Builder -- core feature engine

This document describes the folder-local core engine for the Follow-up Sequence
Builder tool. The engine is self-contained and is not wired into the main app,
routing, inbox, wallet, Stellar core, database, or design system.

## What the engine does

`buildSequence(input, options?)` turns one normalized email context into a
multi-stage follow-up sequence plan. It is the only behavior a future UI needs
to call. The engine is pure and deterministic: the same input always yields the
same output.

## Inputs

`SequenceBuildInput`:

- `messageId` -- synthetic source message id.
- `subject` and `body` -- email text.
- `senderAddress`, optional `senderName`.
- `receivedAt` -- ISO-8601 timestamp.
- optional `timeZone` -- IANA timezone for context.
- optional `threadHint` -- caller-supplied sender or thread hint.

`SequenceBuildOptions`:

- `now` -- optional base timestamp override.
- `maxSteps` -- maximum number of follow-up steps (clamped to 10).
- `existingSequences` -- known sequence keys, used to avoid duplicate sequences.

## Output

`FollowUpSequence` with `id`, `title`, `sourceMessageId`, `confidence`,
`urgency`, `steps`, and `warnings`.

- `confidence` is `high`, `medium`, or `low`.
- `urgency` is `low`, `normal`, `high`, or `critical`.
- `steps` is an array of `FollowUpStep` objects, each with:
  - `order` -- sequence position starting at 1.
  - `delayDays` -- suggested days to wait before this step.
  - `template` -- suggested message subject or label.
  - `condition` -- condition under which to execute the step.
  - `stage` -- always `pending` for engine output.

## Urgency detection

The engine scans the input text for urgency keywords and deadline mentions:

| Level    | Example keywords                    |
| -------- | ----------------------------------- |
| critical | asap, urgent, immediately           |
| high     | time-sensitive, important, priority |
| normal   | soon, shortly (default)             |
| low      | no-rush contexts (FYI, whenever)    |

When a deadline (ISO date with "by", "due", "deadline", or "before") is present
without urgency keywords, the urgency is raised to `high`.

## Step templates

Each urgency level has a default set of step templates:

- **critical**: 1 day / 3 days / 7 days
- **high**: 2 days / 5 days / 10 days
- **normal**: 3 days / 7 days / 14 days
- **low**: 7 days / 14 days / 30 days

## States, loading, and errors

- The engine is synchronous and performs no IO, so it has no async loading state
  of its own. A host UI owns any loading indicator while it gathers input.
- Errors are surfaced as data, not exceptions. Low-confidence contexts, missing
  signals, and weak patterns produce `warnings` and a safe `low` result instead
  of throwing.
- When no actionable signal is detected, the engine returns an empty `steps`
  array with an explanatory warning.

## Duplicate avoidance

When `options.existingSequences` already contains the same `sourceMessageId`,
a warning is added to the output. The engine does not prevent sequence creation
at the data level; duplicate enforcement belongs to the caller.

## Security and performance

- No network calls, secrets, or production data are used.
- The engine never sends email, creates calendar events, changes labels, marks
  messages read, archives, or deletes messages.
- Signal scanning is bounded to the first 4000 characters so long messages stay
  fast.
- Fixtures use synthetic senders, message ids, and dates only.

## API surface

The tool's public surface is exported from `index.ts`: `buildSequence`,
`summarizeSequence`, `isSequenceDuplicate`, the related types, and the synthetic
`sampleInputs` fixtures.
