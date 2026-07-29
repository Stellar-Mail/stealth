# UI and Accessibility Surface

Local UI and accessibility surface for the **Team Security Flagging** tool
(issue #701). This surface is intentionally **isolated to this tool folder and
is not mounted in the main application**. It changes nothing in the shared
design system, navigation, routing, or mail rendering.

## Design approach: a headless view-model

The tool has no framework-specific UI. Instead of committing to React, native,
or a CLI up front, the surface is a **headless, framework-agnostic view-model**
(`ui/flag-queue-view-model.mjs`) with a matching type contract
(`ui/flag-queue-view-model.contract.ts`).

The view-model takes the current loading/data/error state and returns a
presentation-independent `FlagQueueView` object. A renderer of any kind maps
that object to DOM/native nodes. Because accessibility metadata lives in the
view object itself, it cannot be forgotten at render time.

## The four states

`buildFlagQueueView(input)` always returns exactly one state:

- **loading** - a `region` with `aria-busy=true` and a polite live region; a
  status focus target.
- **error** - an `alert` region with an assertive live region, a human-readable
  announcement, and a retry control as the focus target.
- **empty** - a non-busy region with guidance text and a focus target on the
  primary call to action.
- **success** - the flag rows plus a severity/status summary; focus lands on the
  selected row (or the first row).

## Keyboard model

The queue is a roving-tabindex list. `QUEUE_KEYBOARD_SHORTCUTS` documents the
full map:

- `ArrowDown` / `ArrowUp` - move focus between flags.
- `Home` / `End` - jump to the first / last flag.
- `Enter` / `Space` - open the focused flag.
- `e` / `r` / `d` - escalate / resolve / dismiss the focused flag.
- `/` - focus the queue search field.
- `Escape` - clear the current selection.

## Focus management

Exactly one row is in the tab order at a time (`tabIndex: 0`); all others are
`-1`. Selection moves that single tab stop, so arrow keys navigate within the
list while a single Tab press moves in or out of it. Each state exposes a
`focusTargetId` so the renderer knows where to place focus after a transition.

## Screen-reader support

- Every row carries an `ariaLabel` composed from severity, category, subject,
  sender, and status - never a raw, unlabeled value.
- The region's `ariaLive` politeness matches urgency: `polite` for normal
  updates, `assertive` for errors.
- `aria-busy` communicates loading without a spinner-only cue.

## Visual style (tool-local tokens)

Severity tones are exposed as **tool-local token names**
(`sev-critical`, `sev-high`, `sev-medium`, `sev-low`), not values pulled from or
written into the shared design system. A renderer maps these tokens to its own
palette. This keeps the visual language documented and consistent without
touching global styles.

## Usage

import { buildFlagQueueView } from "../ui/flag-queue-view-model.mjs";
const view = buildFlagQueueView({ phase: "loaded", flags });
if (view.state === "success") {
for (const row of view.items) {
// render row.ariaLabel, row.tabIndex, row.severity.tone, row.status.label
}
}

## Acceptance criteria mapping

- **Isolated / not mounted** - all files live under this tool folder; nothing
  imports the main app and the main app does not import this.
- **Labels, focus, keyboard** - accessible names on every control, roving
  tabindex, and a documented keyboard map.
- **Visual style documented without changing the design system** - tool-local
  severity tokens described above.
- **Files limited to the tool folder** - only `ui/`, `tests/`, and `docs/`
  inside `tools/v2/team/team-security-flagging/` change.
- **Self-contained** - covered by `tests/flag-queue-view-model.test.mjs`.
