# Architecture Contract

## Overview

This document defines the folder-local architecture for the "Team Task Board from Emails" tool. It establishes the internal module boundaries and integration constraints required to keep this tool as a self-contained mini-product before any future connection to the main application.

## Internal Module Boundaries

To maintain isolation, the tool must organize its code strictly within `tools/v2/team/team-task-board-from-emails/` using the following boundaries:

- **Components (`/components`)**: React components responsible for rendering the task board, columns, and individual task cards. These must be self-contained and must not import from the main app's design system or core component libraries unless explicitly passed as props in a future integration phase.
- **Services (`/services`)**: Business logic for extracting tasks from emails, parsing metadata, and managing the board state. These services must rely on injected data rather than directly fetching from the main app's database or inbox architecture.
- **Hooks (`/hooks`)**: Custom React hooks for managing local state, UI interactions, and drag-and-drop mechanics within the task board.
- **Tests (`/tests`)**: Folder-local automated tests (e.g., fixture validations) to ensure extraction logic and board state management function correctly in isolation.
- **Docs (`/docs`)**: Documentation detailing the tool's behavior, testing plans, review notes, and this architecture contract.

## Data Ownership

- **Local State**: The tool owns its internal representation of the board state (columns: `new`, `triage`, `blocked`, `done`) and the tasks within them.
- **Data Source**: The tool expects email data to be provided to it (e.g., via props or a localized service wrapper) rather than fetching it directly from the core app's mail rendering engine or database.
- **Persistence**: Any data persistence mechanism must be mocked or localized for the scope of this tool. Write operations to the main database are strictly forbidden in this phase.

## Dependencies

- **Internal**: Modules within this folder may freely depend on each other.
- **External**: The tool may only depend on generic third-party libraries already present in the project (e.g., React).
- **Prohibited Dependencies**: The tool must not import from or depend on:
  - Main app shell or routing logic
  - Existing inbox architecture or mail rendering engine
  - Authentication, Wallet Core, or Stellar Core
  - Existing Design System or core UI components

## Integration Constraints

Contributors must adhere to the following constraints:

- **No Core App Modifications**: Do not touch files outside of `tools/v2/team/team-task-board-from-emails/`.
- **Future Integration**: The tool must be designed so that a future integration issue can connect it to the main app by simply importing its top-level component or service and passing the required data/callbacks.
- **Reviewability**: The entire module must remain small, reviewable, and fully functional using local fixtures without needing the main application running.
