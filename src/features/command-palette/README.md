# Command Palette Contributor Handoff

This module owns the existing app command surface: palette opening, query
matching, contextual quick actions, dangerous-action confirmation, shortcut
overlay, and keyboard routing. Keep changes focused on the current app shell
control plane and avoid adding a separate launcher or automation system here.

## Local File Map

- `CommandPalette.tsx` renders the modal, query field, grouped results,
  keyboard navigation, active-row scrolling, disabled-command help text,
  dangerous-action confirmation panel, and row activation callbacks.
- `search.ts` builds the grouped palette model, fuzzy-scores commands, folders,
  senders, proofs, and settings, and filters disabled commands out of keyboard
  selection.
- `shortcuts.ts` defines global shortcut metadata, maps key events to shortcut
  actions, and guards editable fields so typing in inputs, textareas, selects,
  contenteditable nodes, or role=textbox surfaces is not hijacked.
- `ShortcutOverlay.tsx` renders the searchable keyboard shortcut reference,
  conflict notes, and Escape/backdrop close behavior.
- `types.ts` defines command ids, groups, context, availability, confirmation
  copy, descriptors, and the pure `buildCommands` resolver.
- `tests/unit/command-palette/command-palette.test.ts` covers command
  availability, fuzzy search, grouped results, and keyboard-selectable rows.
- `tests/unit/command-palette/shortcuts.test.ts` covers shortcut guards and
  supported global shortcut routing.

## Data Contracts

`CommandContext` is the live app slice used by commands: the selected `Email`
or `null`, plus the current `MailFolder`. Commands must derive availability
from this context and return either enabled or a one-line help reason. Do not
hide disabled commands in the empty-query view; their help text teaches why the
action cannot run.

`CommandDescriptor` is the canonical command registry entry. It includes id,
group, label, description, icon, optional hint, dangerous/confirmation metadata,
keywords, and an availability function. `buildCommands` is pure and cheap so the
palette can recompute when selection, folder, or query changes.

`PaletteRow` separates command, folder, sender, proof, and setting rows.
Activating a row must route through the existing callbacks:
`onRunCommand`, `onNavigate`, `onSelectEmail`, or `onOpenSettings`. The palette
should not mutate mailbox, proof, settings, or payment state directly.

`SHORTCUT_DEFINITIONS` is the single source for shortcut labels, descriptions,
keys, searchable keywords, command linkage, and conflict notes. `getShortcutAction`
must stay conservative and return `null` when the target is editable or Alt is
pressed.

## User-Facing States

- Closed palette has no retained query or confirmation state.
- Empty query shows contextual command groups in protocol, delivery, message,
  navigation, and app order.
- Non-empty query searches commands, folders, senders, proofs, and settings.
- No results shows a quiet empty state for the query.
- Disabled command rows remain visible with help text and are skipped by
  keyboard navigation.
- Dangerous commands show a second confirmation panel before `onRunCommand`.
- Escape closes the palette, or cancels the confirmation panel first.
- Arrow Up/Down cycles selectable rows and Enter activates the current row.
- Shortcut overlay supports search, conflict notes, Escape/backdrop close, and
  reminds users that shortcuts pause while typing.

## Safety And Privacy Boundaries

The command palette is a router, not an executor. It must not directly approve
senders, block senders, refund postage, settle delivery, copy proofs, change
settings, send mail, or navigate external links. It should emit intent through
callbacks so the owning feature can apply confirmations, side effects, logging,
and error handling.

Commands such as block sender, refund postage, settle delivery, inspect proof,
and quote postage are trust-sensitive. Keep dangerous confirmation metadata on
the command descriptor and make sure new destructive or financial actions opt
into the confirmation path before running.

Search rows can expose sender names, addresses, proof hashes, folder names, and
settings labels. Do not add real customer mail, private keys, access tokens,
payment account details, live proof payloads, or production identifiers to
fixtures, docs, screenshots, or tests.

Shortcut routing must never steal normal typing. Preserve editable-target checks
for nested nodes and custom textboxes, and avoid adding bare-letter shortcuts
that conflict with common editing behavior unless they are suppressed in the
same way.

## QA Checklist

- Confirm `Ctrl/Cmd+K`, query entry, Arrow Up/Down, Enter, Escape, and backdrop
  close work without leaving stale query or confirmation state.
- Verify empty-query sections keep disabled command rows visible with useful
  help text, while keyboard selection only lands on enabled rows.
- Search for representative command, folder, sender, proof, and setting terms
  and confirm grouped results stay relevant.
- Run a dangerous command and verify the confirmation panel appears, Escape
  cancels it, and Enter/confirm runs the command once.
- Confirm shortcut overlay search returns labels, descriptions, key names,
  keywords, and conflict notes.
- Verify shortcuts do not fire while focused in inputs, textareas, selects,
  contenteditable elements, or role=textbox containers.
- Run `tests/unit/command-palette/command-palette.test.ts` and
  `tests/unit/command-palette/shortcuts.test.ts`, then run typecheck and lint
  when the local dependency install supports those commands.
