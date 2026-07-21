# Follow-up Sequence Builder

V2 individual tool workspace for building multi-stage follow-up sequence plans
from email context.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/follow-up-sequence-builder/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Intended Use

- Accept normalized email context (subject, body, sender, received time).
- Detect follow-up requests, urgency level, and deadline mentions.
- Return a multi-step follow-up sequence with timed intervals and templates.
- Let a user review, edit, reorder, skip, or activate each step.
- Keep the tool advisory; it must not send email, create external calendar
  events, change labels, or mark messages read automatically.

## Sequence Steps

Each step in the sequence has:

- `order`: position in the sequence (1-based).
- `delayDays`: suggested days to wait before executing the step.
- `template`: suggested message subject or action label.
- `condition`: condition under which to execute the step.
- `stage`: always `pending` when returned by the engine.

## Urgency-Informed Intervals

| Urgency  | Step 1 | Step 2  | Step 3  |
| -------- | ------ | ------- | ------- |
| critical | 1 day  | 3 days  | 7 days  |
| high     | 2 days | 5 days  | 10 days |
| normal   | 3 days | 7 days  | 14 days |
| low      | 7 days | 14 days | 30 days |

## Testing Focus

Use `docs/test-plan.md` and `docs/fixtures.md` to cover urgent requests, normal
requests, FYI false positives, missing signals, duplicate detection, guard
rejections, bounded scanning, and deterministic output.
