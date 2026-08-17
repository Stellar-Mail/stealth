# Follow-up Sequence Builder (V2)

## Goal

The Follow-up Sequence Builder is a contributor-friendly, isolated tool for designing and managing automated email follow-up sequences. This is a V2 later-release tool designed specifically for the individual audience.

**Note:** This tool is built as complete, isolated work. It is not yet linked to the main app, main application shell, dashboard layout, existing routing, or the existing inbox architecture.

## Setup

To work on this tool independently:

1. Ensure you have the standard repository dependencies installed (`npm install` / `bun install`).
2. Run tests and verify the UI strictly within this directory boundary (`$rel/`).
3. Use the localized mock fixtures provided in `test-plan.md` or local subdirectories to emulate the main application context.

## Usage

Currently, this module serves as an isolated feature package. When reviewing or working on the `Follow-up Sequence Builder`:

- Keep all modifications inside `src/tools/v2/individual/follow-up-sequence-builder/`.
- Do not modify existing routing, the Stellar integration core, database schemas, or the design system unless explicitly stated in a follow-up integration issue.

## Fixtures

For development and testing, use strictly folder-local fixtures (e.g., mock sequence steps, fake delay timers, dummy recipient states). These fixtures should emulate the larger app environment without actually importing main app services that require complex setup.

## Known Limitations

- Not currently integrated with the main routing or navigation system.
- Not connected to the real production database schema or live cron dispatchers.
- Lacks main app authentication wrappers.

## OSS Contributor Notes

- **Scope:** Keep your work small, reviewable, and limited to this specific folder (`$rel/`).
- **Dependencies:** Prefer folder-local components, services, and hooks over global shared utilities to minimize breaking changes.
- **Reviewability:** The contribution should be reviewable as a self-contained mini-product change. If this tool requires a future connection to the main mail app or cron service, that will be addressed in a follow-up issue rather than adding integration complexity here.
- **Testing:** Add test coverage locally or follow the guidelines in `test-plan.md`. The issue must remain isolated from app-wide tests.
