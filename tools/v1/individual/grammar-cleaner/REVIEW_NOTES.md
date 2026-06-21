# Review Notes

This issue adds a folder-local UI and accessibility surface for the isolated
Grammar Cleaner tool.

## What Changed

- Added `components/GrammarCleanerPanel.tsx` with empty, loading, error, and
  success states.
- Added accessible labels, `aria-describedby`, a status live region, and a
  focusable cleaned-preview output.
- Updated `README.md` and `specs.md` so the tool folder has a clean launch
  contract.
- Added `docs/ui-accessibility-notes.md` for visual style, keyboard, focus, and
  screen-reader review notes.

## Review Checklist

- All files remain inside `tools/v1/individual/grammar-cleaner/`.
- No main app, routing, inbox, wallet, database, compose, Stellar, or shared
  design-system integration is introduced.
- The UI exposes labeled controls and keyboard-accessible actions.
- Empty, loading, error, and success states are represented.
- The preview behavior is deterministic and does not send, save, or persist
  draft content.
