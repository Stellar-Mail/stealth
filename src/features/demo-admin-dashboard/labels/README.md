# Label manager

Admin tooling for creating, applying, and cleaning up labels across demo
messages in the Demo Admin Dashboard. Everything here is deterministic and uses
synthetic data only — no real mail, addresses, or secrets.

## What's included

- `types.ts` — `DemoLabel`, `LabeledDemoMessage`, and `LabelUsage` shapes.
- `labelNormalization.ts` — pure helpers: name normalization, id generation,
  add/remove, usage counts, and unused-label detection.
- `labelFixtures.ts` — deterministic demo labels and labeled messages.
- `LabelManager.tsx` — the UI for creating labels, applying them per message,
  reviewing usage counts, and spotting labels to clean up.
- `labelNormalization.test.ts` — unit coverage for the helpers.

## Usage

Import `LabelManager` from the feature barrel and render it. It manages its own
state and falls back to the bundled demo data when no props are passed.

- `labels` — optional starting labels (defaults to the bundled demo labels).
- `messages` — optional starting messages (defaults to the bundled demo data).
- `onChange` — optional callback fired after any label or message change.
- `className` — optional class names for the root element.

## Conventions

- Label ids are derived from names via `toLabelId`, so they stay stable and
  case-insensitive.
- A label is unused when no message references its id; those are surfaced for
  cleanup.
