# Email-to-Todo Converter Review Notes

## Scope

- Folder boundary: `tools/v1/individual/email-to-todo-converter/`
- No main app, routing, inbox, wallet, database, or design-system integration.

## What Changed

- Created `services/emailToTodo.ts` -- core pure engine with all conversion logic (buildTaskDraft, detectPriority, suggestDueDate, buildTaskTitle, buildTaskNotes, hasConvertibleContent) and associated types/constants.
- Created `services/guards.ts` -- security and validation layer with sanitizeText, validateEmailInput, sanitizeEmailInput, checkInputLimits, and the hardened safeBuildTaskDraft entry point.
- Created `services/fixtures.ts` -- 7 deterministic synthetic fixtures covering direct request, urgent, newsletter, empty subject, blank content, medium priority, and label scenarios.
- Created `vitest.config.ts` -- local vitest configuration for the tool.
- Refactored `ui/emailToTodoView.ts` -- now only contains view-model helpers (describeConverter, resolveStatusMessage) and re-exports types from services.
- Refactored `ui/EmailToTodoConverter.tsx` -- updated to use safeBuildTaskDraft from the guard layer instead of direct engine calls.
- Refactored `ui/index.ts` -- updated exports to re-export from services.
- Replaced `tests/emailToTodoView.test.ts` with `tests/emailToTodo.test.ts` and `tests/guards.test.ts` for comprehensive coverage.
- Updated `README.md` to reflect the new architecture.

## Acceptance Coverage

- **Architecture**: Layered services/guards/ui structure matching the established tool pattern (follow-up-reminder).
- **Feature**: Core conversion logic (title extraction, notes, priority detection, due date suggestion, draft building).
- **Security/Performance**: Input validation, text sanitization, size/word limits, safe entry point.
- **Testing/Docs**: 100+ test cases across engine, guards, fixtures, and view-model. Updated README with architecture overview.

## Known Limitations

- Priority detection is keyword-based only; no ML or NLP.
- Due date suggestion uses a simple day offset; no calendar-awareness or business-day logic.
- The UI component is isolated and not wired into any routing or navigation system.
