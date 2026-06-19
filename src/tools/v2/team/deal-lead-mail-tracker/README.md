# Deal/Lead Mail Tracker (V2)

## Goal

The Deal/Lead Mail Tracker is a contributor-friendly, isolated tool for tracking deals and leads via mail interactions. This is a V2 later-release tool designed specifically for the team.

**Note:** This tool is built as complete, isolated work and is not yet linked to the main app, main application shell, dashboard layout, or existing inbox architecture.

## Setup

To work on this tool independently:

1. Ensure you have the standard repository dependencies installed (`npm install` / `bun install`).
2. Run tests and verify the UI strictly within this directory boundary.
3. Use the localized mock fixtures provided in `test-plan.md` or local subdirectories to emulate the main application context.

## Usage

Currently, this module serves as an isolated feature package. When reviewing or working on the `Deal/Lead Mail Tracker`:

- Keep all modifications inside `src/tools/v2/team/deal-lead-mail-tracker/`.
- Do not modify existing routing, the Stellar integration core, database schemas, or the design system unless explicitly stated in a follow-up integration issue.

## Fixtures

For development and testing, use strictly folder-local fixtures (e.g., mock email payloads, fake wallet connections, dummy deal tracking states). These fixtures should emulate the larger app environment without actually importing main app services that require complex setup.

## Known Limitations

- Not currently integrated with the main routing or navigation system.
- Not connected to the real production database schema or live Stellar network.
- Lacks main app authentication wrappers.

## OSS Contributor Notes

- **Scope:** Keep your work small, reviewable, and limited to this specific folder (`$rel/`).
- **Dependencies:** Prefer folder-local components, services, and hooks over global shared utilities to minimize breaking changes.
- **Reviewability:** The contribution should be reviewable as a self-contained mini-product change. If this tool requires a future connection to the main mail app, that will be addressed in a follow-up issue rather than adding integration complexity here.
- **Testing:** Add test coverage locally or follow the guidelines in `test-plan.md`. The issue must remain isolated from app-wide tests.
