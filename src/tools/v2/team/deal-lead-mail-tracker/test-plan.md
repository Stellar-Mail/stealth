# Test Plan: Deal/Lead Mail Tracker

This document outlines the testing strategy for the Deal/Lead Mail Tracker tool. Because this tool is built as an isolated V2 component and is not yet linked to the main app, tests should strictly remain localized within `src/tools/v2/team/deal-lead-mail-tracker/`.

## 1. Unit Testing Strategy

Once the core logic is implemented, the following unit tests must be added:

- **Mail Parsing Validation:** Ensure that incoming mock mail payloads correctly extract sender details, intent (Deal vs Lead), and any associated timeline/budget parameters.
- **Classification Engine:** Test functions that determine whether a record is a `Deal` or a `Lead` based on folder-local configuration or predefined rules.
- **State Management:** Verify that internal states (e.g., `New`, `Contacted`, `Negotiating`, `Closed`) correctly transition based on mocked actions.

## 2. Component Testing (UI)

If frontend components are developed, they should be tested using isolated rendering (e.g., via React Testing Library):

- **Dashboard View:** Render the Tracker UI using local fixture data and verify that elements are displayed correctly without relying on the main app shell.
- **Interaction Tests:** Simulate user interactions (like marking a Lead as a Deal) and assert that the internal state updates accordingly.

## 3. Fixtures and Mocks

To maintain isolation from the rest of the application, contributors must create and use local mock data:

- **`__fixtures__/mockMails.ts`**: Sample email JSON payloads containing typical Deal/Lead negotiation language.
- **`__fixtures__/mockTrackerState.ts`**: Snapshot states of the tracker database for testing initial renders and updates.
- **Service Mocks**: If the module requires external services (like a dummy auth token or a mocked Stellar transaction), stub these interfaces directly inside the test files.

## 4. Acceptance Criteria for Tests

Before considering a PR complete for this tool:

- [ ] Test files exist inside the `deal-lead-mail-tracker` folder.
- [ ] No tests depend on global `stealth` testing configurations or app-wide test suites unless explicitly provided by the framework (like Playwright config).
- [ ] Tests execute successfully using standard test commands (e.g., `bun test` or equivalent) on the specific folder path.

## 5. Review Guidelines for OSS Contributors

When validating test coverage:

1. Ensure the scope of tests does not exceed the `$rel/` directory boundaries.
2. Confirm that mock data accurately reflects what would be expected from the real mail rendering engine, without actually importing it.
3. Validate that adding or running tests here does not break existing app-wide continuous integration pipelines.
