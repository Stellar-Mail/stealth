# Architecture Contract: Escalation Tool

## Overview

This document defines the folder-local architecture, module boundaries, and integration constraints for the **Escalation Tool**. This tool provides teams with a mechanism to flag, escalate, and route high-priority emails or support tickets to specialized team members or administrators.

**Status:** V2 Later Tool  
**Audience:** Team  
**Isolation Level:** Strict folder-local ($rel/). Do not link to the main app, dashboard, routing, authentication, or Stellar core.

---

## 1. Internal Module Boundaries

To ensure this tool remains a self-contained mini-product, all future development must adhere to the following internal directory structure within `src/tools/v2/team/escalation-tool/`:

- **`/components/`**: React components specifically for the Escalation Tool UI (e.g., `EscalationButton`, `EscalationModal`, `PriorityBadge`). These must not be exported for global use until a formal integration issue is filed.
- **`/services/`**: Local business logic and simulated API calls (e.g., `escalationRouter.ts`). Should use local fixtures and mock delays rather than interacting with the production `stealth` database schema.
- **`/hooks/`**: Custom React hooks (e.g., `useEscalationState.ts`) managing the local state of the tool.
- **`/types/`**: TypeScript interfaces defining the data model (e.g., `EscalationTicket`, `PriorityLevel`).
- **`/__tests__/` or `/__fixtures__/`**: Folder-local test files and mock data ensuring the tool can be validated independently of the app-wide CI suites.
- **`index.ts`**: The sole public interface for this module. Only export the primary root component and essential types needed for future integration.

---

## 2. Data Ownership and Dependencies

### Ownership

- The **Escalation Tool** module owns the CRUD operations for escalation metadata (Priority Level, Assigned Owner, Escalation Reason, Resolution Status).
- It **does not** own the Mail Rendering Engine, Inbox Architecture, or the Wallet Core. It simply acts as a workflow mechanism that will eventually attach metadata to those external entities.

### Dependencies

- **Allowed:** React, local generic utility functions (if copied or safely imported without side effects), standard HTML/CSS/Tailwind utilities.
- **Forbidden:** Importing state from the global Redux/Zustand store, depending on the global routing context (`routeTree.gen.ts`), or calling live backend APIs or Stellar SDK transactions directly from this folder.

---

## 3. Integration Constraints for Future Contributors

**What contributors MAY change:**

- Add new features or UI states within this directory.
- Refactor local `/components` or `/services` within this directory.
- Add local unit and component tests.

**What contributors MAY NOT change:**

- **Main App Shell:** Do not inject the Escalation Tool component into the global navigation or sidebar.
- **Existing Database Schema:** Do not alter Prisma schemas or SQL migrations. Use mock data structures in `/types/` and `/__fixtures__/` instead.
- **Shared Design System:** Do not modify global CSS variables, tokens, or shared UI components in `/src/components/`. If a specific alert style is needed, build it locally within `/components/EscalationAlert.tsx`.

### Future Integration

When this V2 tool is ready for release, a separate integration issue will be created. That issue will handle wiring this module's `index.ts` exports into the global state, navigation, and actual backend APIs. Until then, the Escalation Tool must be able to run and be tested in complete isolation.
