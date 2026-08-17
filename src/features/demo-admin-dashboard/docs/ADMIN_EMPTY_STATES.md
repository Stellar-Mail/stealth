# Admin empty states

Reusable, friendly empty states for the demo admin panels (issue #201).

## What this provides

- `AdminEmptyState` — a centered empty-state block with an optional icon, a
  title, a description, and a CTA slot (the `action` prop). Pass a `kind` to use
  preset copy, or override `title` / `description` directly.
- `ADMIN_EMPTY_STATE_PRESETS` — preset copy for the five panels: messages,
  senders, attachments, events, and validation.
- `getAdminEmptyStatePreset(kind)` — returns the copy for a single kind.
- `ADMIN_EMPTY_STATE_KINDS` — the supported kinds, in display order.

## Usage

Render `AdminEmptyState` with a `kind` to get default copy, and pass a button
through the `action` prop to fill the CTA slot — for example, an empty messages
panel uses `kind="messages"` with an "Add demo messages" button in `action`.

## Scope

All code lives under `src/features/demo-admin-dashboard/`. Copy is static, fake,
and safe for public review — no real user data, network calls, or secrets.
Wiring these states into the individual panels is a deliberate follow-up.
