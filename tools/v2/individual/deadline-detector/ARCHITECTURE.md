# Deadline Detector — Architecture Contract

## Purpose

The Deadline Detector is a self-contained V2 later-release tool for **Individual** users. It detects likely deadlines (due dates and times) in message content and presents reviewable reminder candidates. Callers pass synthetic message objects in; the tool returns extracted deadlines without coupling to the main mail app, inbox, or reminder pipeline.

**Release tier:** V2 Later  
**Audience:** Individual  
**Status:** Architecture contract only — implementation deferred

---

## Ownership Boundary

All work for this tool **must remain exclusively within**:

```text
tools/v2/individual/deadline-detector/
```

This tool is a **self-contained mini-product**. It must not be wired into the main application shell, dashboard layout, navigation system, authentication, wallet core, mail rendering engine, existing inbox architecture, existing routing, Stellar integration core, database schema, or existing design system during this issue. Future integration is a separate follow-up issue.

---

## Module Boundaries

### Directory Structure

```text
deadline-detector/
├── ARCHITECTURE.md       # This file — architectural contract
├── README.md             # Tool overview and contributor entry point
├── specs.md              # Feature specification and behavior contract
├── components/           # Presentational and container React components
├── services/             # Deterministic logic for text extraction and detection
├── hooks/                # React hooks bridging components and services
├── types/                # Local data shapes and interfaces
├── fixtures/             # Local synthetic mock data (no real personal data)
├── tests/                # Unit and fixture-based validation tests
└── docs/                 # Folder-local architecture and style notes
```

### `components/`

**Responsibility:** Render the detection results, feedback states, and review actions. Components receive data and callbacks from hooks; they do not persist to external storage or call remote APIs directly.

**Planned components:**

| Component               | Responsibility                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DeadlineDetectorShell` | Root layout container. Composes child components, connects hooks, and manages the primary review workflow. |
| `MessagePreview`        | Renders a read-only preview of the passed-in source message, highlighting detected deadline phrases.       |
| `StatusFilter`          | Keyboard-accessible radio or toggle controls to filter detected, missed, or review-required results.       |
| `DeadlineResultCard`    | Displays an expected deadline, urgency badge, timezone, and actionable buttons.                            |
| `ReviewActionRow`       | Interactive UI to explicitly approve, ignore, or modify a detected deadline without emitting side-effects. |

**Rules:**

- No direct imports from `src/` (main app).
- Provide accessible empty, loading, error, and success states.
- Color must never be the only status signal.
- Styling should be folder-local or rely on already available CSS primitives; do not modify the shared design system.

### `services/`

**Responsibility:** Pure and deterministic business logic for date, time, and relative phrasing extraction. No React dependencies.

**Planned modules:**

| Module            | Responsibility                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `detectorService` | Orchestrates the detection rules over the input text and outputs normalized, classified deadlines (detected, needs-review, missed, ignored). |
| `dateParser`      | Parses ISO formats, US short dates, explicit 24-hour times, and relative phrases like "tomorrow", "next week", "by EOD".                     |

**Rules:**

- Services are entirely pure, side-effect free, and testable via Node or Vitest without a DOM.
- Must not communicate with external calendars, mailboxes, or APIs.

### `hooks/`

**Responsibility:** Manage component-level React state and UI transitions. Bridge UI events to detection services.

**Planned hooks:**

| Hook                   | Responsibility                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useDeadlineDetection` | Wraps `detectorService`, taking an array of local `DeadlineMessage` inputs to expose a ranked array of `ExpectedDeadline` outputs, loading states, and filter setters. |

**Rules:**

- Hooks must not write to any global context, URL, or global Redux/Zustand store.
- Do not trigger actual notification delivery or scheduling side effects.

### `tests/` and `fixtures/`

**Responsibility:** Verify the detection rules using controlled synthetic inputs and define the structural contract.

**Planned components:**

- `deadline-fixtures.test.mjs`: Tests `detectorService` against the local `sample-deadline-messages.json` fixture.

**Rules:**

- Fixtures must never include real user PII, real email addresses, or actual mail databases.
- Must run deterministically on CI without needing a backend environment.

### `types/`

**Responsibility:** Isolated type definitions for the module boundaries.

- `DeadlineMessage`: Local input shape (id, sender, subject, body, receivedAt, userTimezone).
- `ExpectedDeadline`: Local output shape (id, sourceMessageId, dueDate, status, urgency, confidence).

---

## Data Ownership and Dependencies

### Data Sources

This module **owns no persistent state**. All inputs are transient objects passed into the module (such as via React props to `DeadlineDetectorShell` or arguments to `detectorService`).

### Integration Constraints

- **Database Schema**: Must not modify Prisma schemas, migrations, or local SQLite structures.
- **Dependency Injection**: Dependencies are scoped to the folder. If external libraries are necessary for date parsing (e.g., `date-fns`), they must already be present in the workspace `package.json`. No new unapproved global dependencies.
- **Future Integration Plan**: When the tool is eventually integrated into the core Inbox, an explicit follow-up issue will define consent behavior, reminder-write permissions, privacy handling, and audit tracing. Until then, the output stays strictly local.
