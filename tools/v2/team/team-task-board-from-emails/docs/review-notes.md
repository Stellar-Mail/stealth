# Review Notes — Team Task Board from Emails

## Validated in This Contribution

### Folder-Local Scope

- All source files are inside `tools/v2/team/team-task-board-from-emails/`.
- No imports from `@/components/ui/*`, `@/features/*`, or any main-app module.
- No live network calls, secrets, or production data introduced.

### TypeScript & Build

- `types.ts` compiles with strict TypeScript (project uses `strict: true`).
- `services/taskBoardService.ts` imports only folder-local fixtures and its own types.
- Barrel export via `index.ts` exposes the public API without leaking internals.

### Core Logic

`extractTaskFromEmail()` is a pure heuristic function that:

1. **ID Generation**: Converts the email ID to a task ID (e.g., `email-onboarding-001` -> `task-onboarding-001`).
2. **Title Extraction**: Automatically matches subject/body text to extract a clean action-oriented title (e.g., "Create contractor access for Mira").
3. **Owner Assignment**: Detects department/role mentions or sender domains (e.g., `Ops`, `Legal`, `Support`, `Finance`, or defaults to `unassigned`).
4. **Due Date Resolution**: Extracts explicit dates (`YYYY-MM-DD`) or resolves relative dates like "before Friday" relative to `receivedAt`.
5. **Status Column Routing**: Routes tasks to columns: `new`, `triage`, `blocked`, or `done` based on completion/blocker keywords or unassigned owners.
6. **Priority Selection**: Rates task urgency: `high` (if blocked, due soon, or invoice approval), `low` (if completed), or `medium`.
7. **Human Review Flag**: Marks cards as `reviewRequired = true` when status is `blocked` or owner is `unassigned`.

`groupTasksByStatus()` groups list of task cards into the board layout (`new`, `triage`, `blocked`, `done`).

### State Coverage

| State             | Where handled                                                                        |
| ----------------- | ------------------------------------------------------------------------------------ |
| Loading           | `createTaskBoardService()` async methods wrapper with configurable delay (`delayMs`) |
| Error (simulated) | `failureRate` option throws `Error("... simulated")`                                 |
| Empty             | Empty emails input array resolves to empty board columns                             |
| Success (Read)    | `getBoard()` and `getTasks()` return formatted board columns and tasks respectively  |
| Success (Write)   | `updateTask()`, `addTask()`, `deleteTask()` update in-memory active board state      |

### Fixtures

- `fixtures/sample-task-emails.json` contains:
  - Onboarding setup email (routes to `new`, medium priority, owner `Ops`, Friday due date).
  - Invoice email (routes to `triage`, high priority, owner `unassigned`, explicit due date).
  - Blocked contract email (routes to `blocked`, high priority, owner `Legal`, requires review).
  - Follow-up email (routes to `done`, low priority, owner `Support`).

### Test Coverage

3 tests via `node:test` (no external test runner):

1. **Fixture Schema Validation**: Verifies fixture structure and contract rules.
2. **Deterministic Extraction**: Runs the heuristic extractor on fixture emails and asserts the results match `expectedCards` exactly.
3. **Column Grouping**: Tests that `groupTasksByStatus` correctly splits tasks.

## Out of Scope (Future Issues)

- Wiring components or routing into the main application.
- Direct connection to production mail databases or real inbox APIs.
- Authentication/authorization permissions for shared team mailboxes.
- UI drag-and-drop mechanics or board layout frontend components.
