# Suspicious Sender Watchlist Specs

## Purpose

Shared threat database.

## Architecture and Folder Contract

This folder (`tools/v2/team/suspicious-sender-watchlist/`) is a self-contained tooling workspace. All work for this tool must stay within this folder.

### What Contributors May Change

Future contributors are allowed and encouraged to add or modify files strictly within this directory:

- **components/**: UI components specific to the watchlist.
- **services/**: Business logic for managing suspicious senders.
- **hooks/**: Custom React hooks for data fetching and state management local to this tool.
- **tests/**: Unit and integration tests for this tool.
- **docs/**: Local documentation, fixtures, and API contracts.

### What Contributors May NOT Change

To ensure isolation until integration is planned, contributors **must not** modify the following core systems:

- Main application shell
- Dashboard layout
- Navigation system
- Authentication
- Wallet core
- Mail rendering engine
- Existing inbox architecture
- Existing routing
- Stellar integration core
- Database schema
- Existing design system

_Note: If the tool requires a future connection to the main mail app, write that as a follow-up issue instead of adding the integration here._

## Data Ownership & Dependencies

- **Data:** All mock data and data structures should be defined locally using fixtures within this folder.
- **Dependencies:** The tool should rely on its own isolated services. Do not import services from the main application core unless explicitly specified in future integration phases.
- **Integration Constraints:** The tool must be buildable and testable in isolation. It should expose a clear, decoupled interface for future integration into the main application shell.

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
