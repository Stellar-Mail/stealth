# Response Time Tracker (V2)

## Goal

The Response Time Tracker is a contributor-friendly, isolated tool for measuring and displaying metrics related to team email response speeds. This is a V2 later-release tool designed specifically for the team audience.

**Note:** This tool is built as complete, isolated work. It is not yet linked to the main app, main application shell, dashboard layout, existing routing, or the existing inbox architecture.

## Setup

To work on this tool independently:

1. Ensure you have the standard repository dependencies installed (`npm install` / `bun install`).
2. Run tests and verify the UI strictly within this directory boundary (`$rel/`).
3. Use the localized mock fixtures provided in `test-plan.md` or local subdirectories to emulate the main application context.

## Usage

Currently, this module serves as an isolated feature package. When reviewing or working on the `Response Time Tracker`:

- Keep all modifications inside `src/tools/v2/team/response-time-tracker/`.
- Do not modify existing routing, the Stellar integration core, database schemas, or the design system unless explicitly stated in a follow-up integration issue.

## Fixtures

For development and testing, use strictly folder-local fixtures (e.g., mock email threads, fake response timestamps, dummy SLA policies). These fixtures should emulate the larger app environment without actually importing main app services that require complex setup.

## Known Limitations

- Not currently integrated with the main routing or navigation system.
- Not connected to the real production database schema or live tracking dispatchers.
- Lacks main app authentication wrappers.

## OSS Contributor Notes

- **Scope:** Keep your work small, reviewable, and limited to this specific folder (`$rel/`).
- **Dependencies:** Prefer folder-local components, services, and hooks over global shared utilities to minimize breaking changes.
- **Reviewability:** The contribution should be reviewable as a self-contained mini-product change. If this tool requires a future connection to the main mail app or metric service, that will be addressed in a follow-up issue rather than adding integration complexity here.
- **Testing:** Add test coverage locally or follow the guidelines in `test-plan.md`. The issue must remain isolated from app-wide tests.
