# Architecture Contract: Manager Review Queue

## Overview

This document defines the folder-local architecture, module boundaries, and integration constraints for the **Manager Review Queue** tool. This tool provides a dedicated queue for team managers to review, audit, and approve actions or escalated items inside their isolated context.

**Status:** V2 Later Tool  
**Audience:** Team  
**Isolation Level:** Strict folder-local ($rel/). Do not link to the main app, dashboard, routing, authentication, or Stellar core.

---

## 1. Internal Module Boundaries

To ensure this tool remains a self-contained mini-product, all future development must adhere to the following internal directory structure within `src/tools/v2/team/manager-review-queue/`:

- **`/components/`**: React components specifically for the Manager Review Queue UI (e.g., `ReviewList`, `AuditCard`, `ActionButtons`). These must not be exported for global use until a formal integration issue is filed.
- **`/services/`**: Local business logic and simulated API calls (e.g., `queueManager.ts`). Should use local fixtures and mock delays rather than interacting with the production database schema.
- **`/hooks/`**: Custom React hooks (e.g., `useReviewQueue.ts`) managing the local state of the queue.
- **`/types/`**: TypeScript interfaces defining the data model (e.g., `ReviewItem`, `AuditAction`).
- **`/__tests__/` or `/__fixtures__/`**: Folder-local test files and mock data ensuring the tool can be validated independently of the app-wide CI suites.
- **`index.ts`**: The sole public interface for this module. Only export the primary root component and essential types needed for future integration.

---

## 2. Data Ownership and Dependencies

### Ownership

- The **Manager Review Queue** module owns the CRUD operations for review items, audit histories, and resolution actions (Approve, Reject, Request Info).
- It **does not** own the Mail Rendering Engine, Inbox Architecture, Wallet Core, or global authentication states. It simply acts as a workflow mechanism that will eventually attach review metadata to those external entities.

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

- **Main App Shell:** Do not inject the Manager Review Queue component into the global navigation or sidebar.
- **Existing Database Schema:** Do not alter Prisma schemas or SQL migrations. Use mock data structures in `/types/` and `/__fixtures__/` instead.
- **Shared Design System:** Do not modify global CSS variables, tokens, or shared UI components in `/src/components/`. If a specific review layout style is needed, build it locally within `/components/ReviewLayout.tsx`.

### Future Integration

When this V2 tool is ready for release, a separate integration issue will be created. That issue will handle wiring this module's `index.ts` exports into the global state, navigation, and actual backend APIs. Until then, the Manager Review Queue must be able to run and be tested in complete isolation.
