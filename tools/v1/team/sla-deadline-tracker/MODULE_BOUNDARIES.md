# SLA Deadline Tracker — Module Boundaries

This document defines the internal contracts, public interfaces, and dependency
rules for each module inside the SLA Deadline Tracker tool. The tool is a V1,
team-audience mini-product for response-SLA monitoring. It is built in
isolation and is not wired into the main application yet.

## 1. Module: Types (shared contracts)

Location: `types/index.ts`.

Responsibility: declares the shared TypeScript interfaces used across the tool.
Owns no logic and imports nothing.

Public API:

    export interface SlaTrackedItem {
      id: string;
      label: string;
      startedAt: string;       // ISO-8601
      deadlineAt: string | null;
      responded: boolean;
      respondedAt: string | null;
    }

    export interface SlaPolicy {
      responseBudgetMs: number;
      warnWindowMs: number;
    }

    export type SlaStatus = "responded" | "on-track" | "due-soon" | "breached";

    export interface SlaEvaluation {
      itemId: string;
      status: SlaStatus;
      remainingMs: number;
      breached: boolean;
      responded: boolean;
    }

    export interface SlaSummary {
      total: number;
      responded: number;
      onTrack: number;
      dueSoon: number;
      breached: number;
    }

Dependencies: no imports from `services/`, `hooks/`, `components/`, or the main
application.

## 2. Module: Services (business logic)

Location: `services/slaTracker.ts`.

Responsibility: encapsulates all framework-free SLA logic — per-item status
evaluation, aggregate summarization, and deadline computation. The engine is
pure and deterministic; time is injected (`now`) so evaluations are
reproducible. Services never import React and never reach outside this folder.

Public API:

    export function evaluateSla(
      item: SlaTrackedItem,
      policy: SlaPolicy,
      now: number,
    ): SlaEvaluation;

    export function summarizeSla(
      items: readonly SlaTrackedItem[],
      policy: SlaPolicy,
      now: number,
    ): SlaSummary;

    export function computeDeadline(
      startedAt: string,
      policy: SlaPolicy,
    ): string;

Dependencies:

- Allowed to import: TypeScript types from `../types/`.
- Forbidden: React or hooks, presentational components, main app stores or
  APIs, any networking, and any use of `Date.now()` inside the engine (callers
  supply `now`).

## 3. Module: Fixtures (deterministic sample data)

Location: `fixtures/sla.fixture.ts`.

Responsibility: provides deterministic sample items and a standard policy for
tests. No production data, no network.

Public API:

    export const STANDARD_SLA_POLICY: SlaPolicy;
    export const FIXED_NOW: number;
    export const SAMPLE_ITEMS: SlaTrackedItem[];

Dependencies: allowed to import types from `../types/` only.

## 4. Module: Tests

Location: `tests/slaTracker.test.ts`.

Responsibility: unit coverage for the engine — every `SlaStatus` branch,
determinism, large-array single-pass behavior, and deadline math.

Dependencies: allowed to import `../services/`, `../fixtures/`, `../types/`.
Forbidden to import anything outside the folder or the main app.

## 5. Module: Hooks (React integration) — PLANNED, not implemented

Location: `hooks/` (future).

Responsibility (when built): synchronize the service with React components,
managing the item list, loading/error state, and time-relative refreshes. Hooks
must obtain `now` from a clock source and pass it into the engine; they must not
introduce their own SLA math.

Intended public shape:

    export function useSlaTracker(
      items: SlaTrackedItem[],
      policy: SlaPolicy,
    ): { summary: SlaSummary; evaluations: SlaEvaluation[]; refresh: () => void };

Dependencies (when built): allowed to import React hooks, the service from
`../services/`, and types from `../types/`. Forbidden: presentational
components and core app state contexts.

## 6. Module: Components (user interface) — PLANNED, not implemented

Location: `components/` (future).

Responsibility (when built): renders status badges, deadline lists, and
breach alerts. Components stay presentational and delegate all logic to the
hook.

Dependencies (when built): allowed to import hooks from `../hooks/` and types
from `../types/`. Forbidden: core app features, layout navigation, or importing
service functions directly.

## 7. Public API surface

Location: `index.ts` — re-exports the engine and types. Future UI/integration
work should import **only** from `index.ts`, never from `services/` internals.

## Import rules checklist

- [ ] Only import from files inside `tools/v1/team/sla-deadline-tracker/`.
- [ ] Maintain a one-way dependency flow: components → hooks → services → types.
- [ ] No circular dependencies.
- [ ] All shared interfaces are imported from `types/`.
- [ ] No path may ever import from `src/`, the app shell, routing, inbox
      architecture, wallet/Stellar core, or the design system.
- [ ] The engine never calls `Date.now()`; `now` is always supplied by the
      caller.
