# Email Tone Rewriter - Module Boundaries

This document defines the internal contracts, public interfaces, and dependency rules for each module inside the Email Tone Rewriter tool. The tool is a V1, individual-audience mini-product that rewrites a draft email into a selected tone while preserving key facts. It is built in isolation and is not wired into the main application yet.

## 1. Module: Services (business logic)

Location: `services/` (for example, `services/emailToneRewriter.ts`, `services/guards.ts`, `services/fixtures.ts`).

Responsibility: encapsulates all framework-free logic - input validation, key-point extraction, sentence splitting, tone normalization, and rewrite generation. Services never import React and never reach outside this folder.

Public API:

    export function validateRewriteInput(input: Partial<ToneRewriteDraft>): string[];
    export function extractPreservedKeyPoints(bodyText: string): string[];
    export function rewriteEmailTone(input: ToneRewriteDraft): ToneRewriteResult | ToneRewriteErrorResult;

Dependencies:

- Allowed to import: TypeScript types from `../types/` (or co-located type declarations).
- Forbidden: React or hooks, presentational components, and main app stores or APIs.

## 2. Module: Types (shared contracts)

Location: top-level type declarations (for example, exported from `services.ts` or a dedicated `types/` module).

Responsibility: declares the shared TypeScript interfaces used across the tool. Owns no logic and imports nothing.

Public API:

    export type SupportedTone = "concise" | "friendly" | "formal" | "apologetic";
    export type RewriteStatus = "idle" | "loading" | "success" | "error";
    export interface ToneRewriteDraft { ... }
    export interface ToneRewriteResult { ... }
    export interface ToneRewriteErrorResult { ... }

Dependencies: no imports from `components/`, `services/`, `hooks/`, or the main application.

## 3. Module: Hooks (React integration)

Location: `hooks/` (for example, `hooks.ts`).

Responsibility: synchronizes the service with React components, managing the current draft input, the rewrite result, and loading or error state.

Public API:

    export function useEmailToneRewriter(): {
      result: ToneRewriteResult | ToneRewriteErrorResult | null;
      rewrite: (draft: ToneRewriteDraft) => void;
      reset: () => void;
    };

Dependencies:

- Allowed to import: React hooks, service functions from `../services/`, and types.
- Forbidden: presentational components and core app state contexts.

## 4. Module: Components (user interface)

Location: `components/`.

Responsibility: renders the visual elements of the tool (draft input, tone selector, rewrite action, result display, empty/loading/error states). Components stay presentational and delegate all actions to the hook.

Public API:

    // EmailToneRewriter.tsx
    export const EmailToneRewriter: React.FC;
    // EmailToneRewriterEmpty.tsx
    export const EmailToneRewriterEmpty: React.FC;
    // EmailToneRewriterLoading.tsx
    export const EmailToneRewriterLoading: React.FC;
    // EmailToneRewriterSuccess.tsx
    export const EmailToneRewriterSuccess: React.FC<{ result: ToneRewriteResult }>;
    // EmailToneRewriterError.tsx
    export const EmailToneRewriterError: React.FC<{ result: ToneRewriteErrorResult }>;

Dependencies:

- Allowed to import: hooks from `../hooks/`, types, and external presentational assets such as icons.
- Forbidden: core app features, layout navigation, or importing service functions directly.

## 5. Module: Tests (contract and unit coverage)

Location: `tests/` and root-level `services.test.ts`.

Responsibility: verifies the public API of services, hooks, and components against deterministic expectations.

Public API: test suites for `validateRewriteInput`, `extractPreservedKeyPoints`, `rewriteEmailTone`, hook state transitions, and component rendering.

Dependencies:

- Allowed to import: all modules within this folder.
- Forbidden: main app test utilities or global mocks from outside this folder.

## Import rules checklist

- [ ] Only import from files inside `tools/v1/individual/email-tone-rewriter/`.
- [ ] Maintain a one-way dependency flow: components -> hooks -> services -> types.
- [ ] No circular dependencies.
- [ ] All shared interfaces are imported from the types module.