# Architecture: Customer Support Macro Tool

## Goal

The Customer Support Macro Tool provides support agents with automated templates, quick-replies, and macro execution capabilities directly within the V1 mail interface context, without modifying core mail handling.

## Internal Module Boundaries

The tool is strictly isolated within `tools/v1/team/customer-support-macro-tool/`.

### Directory Structure

- `components/`: UI elements for the macro selector, macro editor, and preview panels. These components are "dumb" and only receive data via props.
- `services/`: Business logic for executing macros, parsing template variables, and fetching macro definitions from local storage or future remote APIs.
- `hooks/`: React hooks (e.g., `useMacros`, `useMacroExecution`) that connect `services/` to `components/`.
- `types/`: Strict TypeScript definitions for macro objects, execution context, and action payloads.
- `tests/`: Unit and integration tests for services and hooks using local fixtures.
- `docs/`: Additional documentation on macro syntax and template variables.
- `fixtures/`: Local mock data representing email threads and macros for isolated testing.

## Data Ownership

- **Macros Data:** Owned exclusively by this tool. The tool maintains its own state for active and saved macros.
- **Mail/Thread Context:** Read-only dependency. The tool reads the current email thread context (e.g., recipient, subject) to populate macro templates, but it does NOT own or mutate the mail objects directly.
- **Action Dispatch:** The tool outputs intent payloads (e.g., "Draft Reply", "Add Tag"). The actual execution of these intents on the mail server or local cache is handled by the main app shell via an injected dependency, preserving architectural isolation.

## Integration Constraints

- **Zero Core Modifications:** This tool cannot modify the main application shell, dashboard layout, authentication, wallet core, or the existing inbox architecture.
- **Dependency Injection:** Any interaction with the main app (e.g., sending an email, applying a label) must be done through dependency-injected callbacks provided to the tool's root component.
- **Design System:** The tool must use existing design system tokens or its own local CSS. It cannot pollute global styles.
