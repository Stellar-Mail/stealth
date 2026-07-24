# Contribution Contract & Specifications

## Strict Isolation Guidelines

This folder (`tools/v1/team/customer-support-macro-tool/`) is a self-contained mini-product for the V1 launch.

### What Contributors MAY Change:

- Anything inside this folder (`customer-support-macro-tool/`).
- Local UI components in `components/`.
- Macro execution and parsing logic in `services/`.
- Internal types and tests.
- Local mock fixtures for testing.
- Local docs.

### What Contributors MAY NOT Change:

- Do not import directly from or modify the main application shell.
- Do not modify the existing inbox architecture, routing, or data fetching strategies.
- Do not touch the wallet core, Stellar integration core, or authentication logic.
- Do not alter the global database schema or design system.
- Do not build integrations into the main mail app inside this folder (handle integrations via follow-up issues).

## Integration Interface

To integrate this tool into the main app in the future, the main app will import the root component from `index.ts`. The root component must accept all required context (e.g., current thread ID, sender email, user permissions) and callbacks (e.g., `onMacroExecute`) as React props.

## Testing Strategy

- **Isolation:** Prefer local fixtures and local docs over deep mocking of the main application.
- **Unit Testing:** Test macro parsing, variable substitution, and state transitions completely in isolation using mock thread contexts.
- **Coverage:** Keep work small and reviewable. Ensure changes inside this folder can be reviewed as a self-contained product change without needing the main app running.
