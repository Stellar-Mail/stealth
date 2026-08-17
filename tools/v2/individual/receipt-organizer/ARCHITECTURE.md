# Receipt Organizer - Architecture & Folder Contract

## Goal

The Receipt Organizer is an isolated, self-contained mini-product in the `tools/v2/individual/receipt-organizer/` folder. It is designed as a "V2" release tool and should be built independently from the main application.

## Internal Module Boundaries

The internal folder structure will adhere to the following boundaries:

- **`components/`**: Presentational and interactive React components localized entirely to the Receipt Organizer. These must not rely on the global UI/design system from the main app.
- **`services/`**: Local business logic, data fetching, processing, and receipt extraction logic. These must not import from the main application's core logic or database services.
- **`hooks/`**: Custom React hooks handling state for components within the receipt organizer tool.
- **`tests/`**: Localized unit and integration tests. Test fixtures must be self-contained in this folder.
- **`docs/`**: Folder-local documentation for specific feature sets or workflows.

## Data Ownership & Dependencies

- **Data Ownership**: The tool owns all its internal states and mock data for receipts. It should rely on local fixtures instead of the main application database schema.
- **Dependencies**: The tool may use external libraries defined in the root `package.json`, but it must not depend on core domain objects (like `Stellar` wallet context or core `Inbox` context) from the main application.
- **External Communications**: Any future backend or API integration should be mocked for now or implemented purely via isolated service calls inside the `services/` folder.

## Integration Constraints

- **Main App Shell**: Do not modify the main application shell.
- **Routing**: Do not add routing rules to the main app routing configuration.
- **Core App Files**: No modifications are permitted to `wallet core`, `mail rendering engine`, `inbox architecture`, or `Stellar integration core`.
- **Design System**: Use localized styles or isolated styling within `components/`. Do not bleed styles into or out of the main application.

## Rules for Future Contributors

**What You MAY Change:**

- Files restricted to `tools/v2/individual/receipt-organizer/`.
- Addition of localized components, hooks, tests, and mock data.
- Refinement of the receipt organizer's isolated UI and logic.

**What You MAY NOT Change:**

- Any file outside of `tools/v2/individual/receipt-organizer/`.
- Integration into the global state, main app routing, or existing database schema.
- Creating dependencies on the main app's authentication or email architecture.
