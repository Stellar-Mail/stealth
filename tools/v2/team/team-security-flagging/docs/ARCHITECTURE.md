# Architecture — Team Security Flagging

## Overview

Team Security Flagging is a V2, team-audience tool for reporting, classifying, and tracking
security incidents in team email. All work is isolated inside
`tools/v2/team/team-security-flagging/`. Nothing is wired into the main app yet; a future
integration issue must explicitly permit that.

---

## Layer map and module boundaries

| Layer             | Files                                              | Responsibility                                                                                     | Must NOT depend on                              |
| ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Types             | `types.ts`                                         | Pure TypeScript interfaces and union types. Zero runtime output.                                   | Anything                                        |
| Core service      | `services/security-flagging.service.mjs`           | Validation, sanitization, auto-classification, status transition guards, severity helpers. No I/O. | DOM, React, router, database, network, clock    |
| Execution service | `services/security-flagging-execution.service.mjs` | Orchestration: validate → authorize → deduplicate → persist. Calls caller-supplied boundaries.     | DOM, React, router, any infrastructure directly |
| Contract          | `contract/execution-contract.d.ts`                 | Stable TypeScript declaration of the public execution boundary. All stable codes live here.        | Nothing (type-only `.d.ts`)                     |
| Barrel            | `index.ts`                                         | Re-exports the public surface of the execution service and the contract.                           | Services or contract directly — only re-exports |

### Internal import rules

- `security-flagging-execution.service.mjs` imports from `security-flagging.service.mjs` only.
- `security-flagging.service.mjs` has no local imports (self-contained).
- `contract/execution-contract.d.ts` has no imports.
- `types.ts` has no imports.
- Nothing outside `tools/v2/team/team-security-flagging/` is imported by any file in this tool.

### Dependency graph

index.ts
└── services/security-flagging-execution.service.mjs
└── services/security-flagging.service.mjs
(no imports)
contract/execution-contract.d.ts (type-only, standalone)
types.ts (type-only, standalone)

---

## Public API surface

`index.ts` exports:

| Export                                        | Source            | Stability                                              |
| --------------------------------------------- | ----------------- | ------------------------------------------------------ |
| `executeSecurityFlagging(input, deps)`        | execution service | Stable                                                 |
| `createSecurityFlaggingExecutor(deps)`        | execution service | Stable                                                 |
| `SecurityFlaggingErrorCode`                   | execution service | Stable — branch on `.error.code`, not `.error.message` |
| Types from `contract/execution-contract.d.ts` | contract          | Stable                                                 |

---

## Data ownership

| Data                                         | Owned by                                  | Notes                                                                   |
| -------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| Validation rules and limits                  | `LIMITS` in core service                  | Single source of truth for all length caps and allowed enum values      |
| `SecurityFlagError` (domain error)           | Core service                              | Thrown by validators; caught and re-wrapped by the execution service    |
| `SecurityFlaggingErrorCode` (contract codes) | Execution service + contract              | These codes are stable; callers branch on them                          |
| `SecurityFlaggingRecord` shape               | Contract                                  | The execution service builds the record; the contract declares its type |
| ID generation, clock, persistence            | Caller via `SecurityFlaggingDependencies` | The tool never touches these directly                                   |

---

## Dependency injection contract

`SecurityFlaggingDependencies` is the only way external behavior enters the tool.
Callers supply all five boundaries:

| Dependency          | Type                                                                   | Responsibility                                        |
| ------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| `authorizeReporter` | `(email) => boolean \| Promise<boolean>`                               | Decide if the reporter may create flags               |
| `findActiveFlag`    | `({ emailId, threadId }) => string \| null \| Promise<string \| null>` | Return an existing flag ID, or null                   |
| `persistFlag`       | `(record) => void \| Promise<void>`                                    | Store the assembled flag record                       |
| `generateId`        | `() => string`                                                         | Produce a unique flag ID (e.g. `crypto.randomUUID()`) |
| `now`               | `() => Date`                                                           | Supply the current timestamp                          |

This design makes the execution service fully deterministic in tests — no real database,
network, or clock is required.

---

## Status lifecycle

​
new ──► under-review ──► escalated ──► resolved
│ │ │
└────────────┴───────────────┴──► dismissed

`resolved` and `dismissed` are terminal. `validateStatusTransition(from, to)` throws
`SecurityFlagError` for any disallowed move. The allowed-transition map is the single
source of truth and must not be changed without a dedicated architecture issue.

---

## Auto-classification

`classifyEmail(signal)` scans the combined `subject + snippet + bodyPreview + senderEmail`
against a keyword `SIGNAL_MAP` covering six threat categories
(`phishing`, `credential-theft`, `malware`, `social-engineering`, `data-breach`,
`suspicious-sender`). Severity and confidence are derived from the total matched count:

| Matched signals     | Severity | Confidence    |
| ------------------- | -------- | ------------- |
| 0                   | low      | low           |
| 1                   | medium   | medium        |
| 2–3                 | high     | medium → high |
| 4+ (or 3+ phishing) | critical | high          |

Classification is keyword-based and deterministic. It has no NLP model, sender-reputation
lookup, or link-analysis step. False positives and false negatives are expected at the edges.

---

## Error model

| Type                        | Purpose                                      | Where thrown / returned                                     |
| --------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `SecurityFlagError`         | Domain validation failure; carries `.field`  | Core service validators                                     |
| `SecurityFlaggingErrorCode` | Stable contract code; callers branch on this | Execution service output (`{ ok: false, error: { code } }`) |

Callers must branch on `error.code` (stable). `error.message` is human-readable and not
guaranteed to stay the same across releases.

---

## Integration constraints

These constraints apply to all future contributors:

- **Must NOT** modify the main app shell, routing, inbox architecture, wallet core,
  Stellar integration, authentication, database schema, or design system in this issue.
- **Must NOT** import from outside `tools/v2/team/team-security-flagging/`.
- **Must NOT** use the DOM, React, or any presentation library inside the service layer.
- **Must NOT** remove or rename stable error codes in `SecurityFlaggingErrorCode`.
- **Must NOT** remove or reorder status transition rules without a dedicated architecture issue.

---

## What future contributors may add (within this folder)

- New keyword categories in `SIGNAL_MAP` (additive, non-breaking).
- Additional fixture cases in `fixtures/`.
- New test scenarios in `tests/`.
- Additional documentation in `docs/`.
- A UI layer (`components/`, `hooks/`) under a future Feature or UI issue.
- Persistence integration under a future integration issue.
