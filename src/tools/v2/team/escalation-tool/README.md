# Escalation Tool (V2 Tool)

Welcome to the **Escalation Tool** module. This is a V2 later-release tool designed for the team audience. It is being built as a completely isolated mini-product to prevent regressions in the core application during development.

## 📖 Architecture & Guidelines

Before contributing to this folder, **you must read the [Architecture Contract](./architecture.md)**.

## 🚀 Quick Start for Contributors

1. **Stay Local:** All components, services, and hooks must be created inside `src/tools/v2/team/escalation-tool/`.
2. **Use Fixtures:** Do not connect to the real database or the main app's authentication state. Create local mock files for testing.
3. **No Global Mutations:** Do not modify the existing routing tree, dashboard layout, main mail rendering engine, or the shared design system.

## 🛠 Features (In Progress)

This tool will handle:

- Flagging high-priority emails or support tickets for escalation.
- Routing escalated items to specialized team members or administrators.
- Tracking resolution status and escalation reasons in an isolated context.

_Note: For questions regarding future integration with the global Stellar-Mail application shell, refer to the follow-up integration issues in the main repository tracker._
