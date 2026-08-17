# Test Plan: Follow-up Sequence Builder

This document outlines the testing strategy for the Follow-up Sequence Builder tool. Because this tool is built as an isolated V2 component and is not yet linked to the main app, tests should strictly remain localized within `src/tools/v2/individual/follow-up-sequence-builder/`.

## 1. Unit Testing Strategy

Once the core logic is implemented, the following unit tests must be added:

- **Sequence Construction:** Ensure that users can add, remove, and reorder nodes (e.g., Email Step, Delay Step, Condition Step) within a sequence array.
- **Validation Engine:** Test functions that validate sequence integrity (e.g., preventing a sequence from having no start node, ensuring valid delay inputs).
- **State Management:** Verify that internal states representing the sequence builder canvas correctly transition based on mocked drag-and-drop or click actions.

## 2. Component Testing (UI)

If frontend components are developed, they should be tested using isolated rendering (e.g., via React Testing Library):

- **Canvas View:** Render the drag-and-drop Sequence Builder UI using local fixture data and verify that sequence nodes are displayed correctly without relying on the main app shell.
- **Node Configuration:** Simulate user interactions opening a node's configuration sidebar (like setting "Wait for 2 days") and assert that the localized state updates accordingly.

## 3. Fixtures and Mocks

To maintain isolation from the rest of the application, contributors must create and use local mock data:

- **`__fixtures__/mockSequences.ts`**: Sample JSON payloads containing complex and simple sequence configurations.
- **`__fixtures__/mockBuilderState.ts`**: Snapshot states of the builder for testing initial renders and updates.
- **Service Mocks**: If the module requires external triggers (like mocking a generic mailing dispatcher), stub these interfaces directly inside the test files.

## 4. Acceptance Criteria for Tests

Before considering a PR complete for this tool:

- [ ] Test files exist strictly inside the `follow-up-sequence-builder` folder.
- [ ] No tests depend on global `stealth` testing configurations or app-wide test suites unless explicitly provided by the framework (e.g., standard Playwright/Vitest config).
- [ ] Tests execute successfully using standard test commands (e.g., `bun test` or equivalent) on the specific folder path.

## 5. Review Guidelines for OSS Contributors

When validating test coverage:

1. Ensure the scope of tests does not exceed the `$rel/` directory boundaries.
2. Confirm that mock data accurately reflects what would be expected from the real sequence dispatch engine, without actually importing it.
3. Validate that adding or running tests here does not break existing app-wide continuous integration pipelines.
