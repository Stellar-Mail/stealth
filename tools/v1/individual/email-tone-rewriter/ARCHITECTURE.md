# Email Tone Rewriter — Architecture Contract

> **V1 · Individual · Isolated Mini-Product**
>
> This document is the canonical architecture contract for the Email Tone Rewriter
> tool. It defines the folder structure, module responsibilities, data flow,
> dependency rules, and change constraints. All contributors must read this
> document before modifying any file inside this folder.

---

## 1. Purpose

The Email Tone Rewriter is a self-contained, V1 individual-audience tool that
rewrites a draft email into a requested tone while preserving the user's
meaning, factual claims, and requested actions. The result is always reviewable
before any send or save action.

**Key design decisions:**

- **Pure, local, rule-based** — no external AI providers, no network calls, no
  mailbox mutations.
- **Deterministic** — the same input always produces the same output.
- **Isolated** — all code lives inside this folder; no integration with the main
  app shell, routing, inbox, wallet, Stellar core, or design system until a
  future integration issue explicitly allows it.

---

## 2. Folder Structure

```
tools/v1/individual/email-tone-rewriter/
├── ARCHITECTURE.md              ← This file. Central architecture contract.
├── DATA_OWNERSHIP.md            ← Data model, lifecycle, storage boundaries.
├── INTEGRATION_CONSTRAINTS.md   ← Isolation rules and future integration policy.
├── MODULE_BOUNDARIES.md         ← Internal module contracts and dependency rules.
├── README.md                    ← Contributor setup, usage, known limitations.
├── REVIEW_NOTES.md              ← Reviewer checklist for this isolated work.
├── specs.md                     ← Core behavior contract and scope definition.
├── styles.css                   ← Folder-local CSS (no shared design system).
├── index.ts                     ← Public API surface for the tool.
├── services.ts                  ← (Legacy) Core service implementation.
├── services.test.ts             ← (Legacy) Core service tests.
├── components/
│   ├── index.ts                 ← Component barrel export.
│   ├── EmailToneRewriter.tsx    ← Main orchestrator component.
│   ├── EmailToneRewriterEmpty.tsx
│   ├── EmailToneRewriterLoading.tsx
│   ├── EmailToneRewriterSuccess.tsx
│   └── EmailToneRewriterError.tsx
├── services/
│   ├── emailToneRewriter.ts     ← Core rewrite engine.
│   ├── fixtures.ts              ← Deterministic test fixtures.
│   ├── guards.ts                ← Input validation and safety guards.
│   ├── metrics.ts               ← Performance instrumentation.
│   └── transformers.ts          ← Text transformation utilities.
├── tests/
│   ├── components.test.ts       ← Component rendering tests.
│   ├── emailToneRewriter.test.ts← Engine unit tests.
│   └── guards.test.ts           ← Guard function tests.
└── docs/
    ├── fixtures.md              ← Representative rewrite fixtures.
    ├── test-plan.md             ← Unit and component test scenarios.
    ├── threat-model.md          ← Security assumptions and mitigations.
    ├── performance.md           ← Performance model and hard limits.
    └── visual-style.md          ← Visual design and accessibility notes.
```

---

## 3. Module Responsibilities

| Module         | Location             | Responsibility                                                               |
| -------------- | -------------------- | ---------------------------------------------------------------------------- |
| **Types**      | `services/` types    | Shared TypeScript interfaces (`ToneRewriteDraft`, `ToneRewriteResult`, etc.) |
| **Services**   | `services/`          | Pure business logic: validation, key-point extraction, tone rewriting        |
| **Guards**     | `services/guards.ts` | Input safety checks: size limits, character sanitization, field validation   |
| **Hooks**      | (future)             | React integration layer bridging services to components                      |
| **Components** | `components/`        | Presentational UI: draft input, tone selector, result display, states        |
| **Tests**      | `tests/`             | Unit and component test suites                                               |
| **Docs**       | `docs/`              | Architecture, test plan, threat model, performance, visual style             |

### Dependency flow (one-way)

```
Components → Hooks → Services → Types
                ↓
            (no circular dependencies)
```

- Components **must not** import services directly.
- Services **must not** import React, hooks, or components.
- All modules **must not** import anything from outside this folder.

---

## 4. Data Flow

```
User Draft (subject, bodyText, tone, maxSentences?)
        │
        ▼
  safeRewriteEmailTone (guards.ts)
        │
        ├── Rejected → ToneRewriteErrorResult (validation errors)
        │
        ▼
  rewriteEmailTone (emailToneRewriter.ts)
        │
        ├── 1. validateRewriteInput → validation errors or pass
        ├── 2. extractPreservedKeyPoints → facts + action sentences
        ├── 3. applyTone → tone-specific transformations
        ├── 4. assemble → opener + body + closer
        │
        ▼
  ToneRewriteResult (rewrittenBody, preservedKeyPoints, sendDisabled, saveDisabled)
```

**Key invariant:** `sendDisabled` and `saveDisabled` are always `true`. This tool
never sends or saves mail.

---

## 5. Data Ownership

See [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) for the complete data model,
lifecycle, storage boundaries, and mutation rules.

**Summary:**

- All state is local in-memory (React state).
- No database, blockchain, cookies, or external storage.
- Fixtures are deterministic, fake, and safe for public review.
- Each rewrite call is stateless and independent.

---

## 6. Integration Constraints

See [INTEGRATION_CONSTRAINTS.md](./INTEGRATION_CONSTRAINTS.md) for the complete
isolation rules and future integration policy.

**Hard rules:**

- All code stays inside `tools/v1/individual/email-tone-rewriter/`.
- No imports from or into the main app shell, routing, inbox, wallet, Stellar
  core, database, or design system.
- No routes, navigation entries, or global providers are registered.
- No external AI providers, network clients, or persistence layers.

---

## 7. Module Boundaries

See [MODULE_BOUNDARIES.md](./MODULE_BOUNDARIES.md) for the detailed public API
contracts, allowed dependencies, and forbidden imports for each module.

---

## 8. What Contributors May Change

Contributors may modify any file inside this folder, provided they:

1. Preserve the one-way dependency flow (Components → Hooks → Services → Types).
2. Keep all imports folder-local.
3. Keep `sendDisabled` and `saveDisabled` always `true`.
4. Keep the tool deterministic (no randomness, clock, or locale dependence).
5. Add new tones by extending the `SupportedTone` union and adding entries to
   `toneOpeners`, `toneClosers`, and `applyTone`.
6. Add new guards in `services/guards.ts` for additional safety checks.
7. Add new components in `components/` following the existing state pattern
   (empty, loading, success, error).
8. Update docs when changing behavior, data model, or constraints.

## 9. What Contributors May NOT Change

Contributors must **never**:

1. Import from or modify files outside this folder.
2. Wire the tool into the main app shell, routing, navigation, or dashboard.
3. Call external AI providers, network APIs, or persistence layers.
4. Remove or bypass the safety guards in `services/guards.ts`.
5. Set `sendDisabled` or `saveDisabled` to `false`.
6. Add real user data, secrets, or private keys to fixtures or tests.
7. Modify the shared design system, database schema, or Stellar integration core.

---

## 10. Security & Performance

- **Threat model:** See [docs/threat-model.md](./docs/threat-model.md).
- **Performance model:** See [docs/performance.md](./docs/performance.md).
- **Hard limits:** `maxSubjectChars: 200`, `maxBodyChars: 20000`,
  `maxBodyWords: 4000`, `maxLengthConstraint: 2000` (defined in `guards.ts`).
- **Sanitization:** ASCII control characters, zero-width characters, and BOM
  characters are stripped; text is normalized to NFC.

---

## 11. Testing Strategy

See [docs/test-plan.md](./docs/test-plan.md) for the complete test scenarios.

**Coverage targets:**

- All supported tones produce correct rewrites.
- Validation rejects empty drafts, unsupported tones, and invalid constraints.
- Key points (dates, names, amounts, links, action items) are preserved.
- Length constraints are applied without dropping required facts.
- Output is deterministic for repeated calls with the same input.
- `sendDisabled` and `saveDisabled` are always `true`.
- Guards reject oversized or malicious inputs before the engine runs.

---

## 12. Future Integration Path

When a future integration issue links this tool, the following changes become
allowable:

1. Importing the tool's public API (`index.ts`) from the main app.
2. Adding a route or navigation entry for the tool.
3. Reading the selected message from the inbox as draft input.
4. Saving rewritten drafts back to the mailbox.
5. Adding a global provider or context if needed.

All such changes must be proposed and reviewed in a separate, explicitly-linked
integration issue. No integration work is permitted in V1.

---

## 13. Change Log

| Date       | Change                                         | Author |
| ---------- | ---------------------------------------------- | ------ |
| 2026-07-29 | Initial architecture contract for V1 isolation | —      |
