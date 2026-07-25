# Architecture: Shared Team Inbox

## Overview

The Shared Team Inbox is a V1 team tool designed as a self-contained mini-product. This document outlines its internal module boundaries, data ownership, and constraints to ensure it remains isolated from the core application until explicitly integrated.

## Module Boundaries

The tool is organized into the following strict module boundaries:

- **`/components`**: Folder-local React UI components. Must not depend on the global design system unless explicitly allowed by the contract.
- **`/services`**: Core business logic and data fetching. All backend communications or mocked operations must be encapsulated here.
- **`/hooks`**: React hooks specifically for the Shared Team Inbox data lifecycle.
- **`/types`**: Domain-specific TypeScript interfaces.
- **`/tests`**: Unit and integration tests isolated to this folder.
- **`/docs`**: Local architecture, specs, and contract documentation.

## Data Ownership

- **State Management**: State is strictly local to the folder (e.g., via Context or local hooks). It does not hook into global state stores like Redux or global React Query caches without a strict integration layer.
- **Mock Data**: Until integration is complete, all data requests must use folder-local deterministic fixtures. No live data or production secrets should be referenced.
- **Dependencies**: The module is prohibited from importing from internal core application services (e.g., wallet core, Stellar integration core, existing inbox architecture).

## Integration Constraints

- **Routing**: This tool does not define global routes. It exposes a single entry point component (`index.ts`) that can be mounted by the host application when required.
- **App Shell**: Modifications to the main application shell, dashboard layout, or navigation system are strictly prohibited.
- **Extensibility**: All functionality should be exposed via a defined folder-local API surface, ensuring the tool can be safely tested and reviewed as an isolated component.
