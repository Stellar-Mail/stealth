# Stellar Team Payout Request — Architecture Contract

**Release Tier:** V2 (later-release)  
**Audience:** Team  
**Ownership:** `tools/v2/team/stellar-team-payout-request/`  
**Issue:** [#664](https://github.com/Stellar-Mail/stealth/issues/664)

---

## Purpose

The Stellar Team Payout Request tool lets team members create and track XLM payout requests
via the Stellar network. It is a **self-contained mini-product** built for V2 release.

It must not be wired into the main application until a dedicated integration issue explicitly
permits it.

---

## Folder Structure

```
tools/v2/team/stellar-team-payout-request/
├── ARCHITECTURE.md          ← this file (module boundary contract)
├── README.md                ← ownership overview
├── specs.md                 ← contributor scope definition
├── index.ts                 ← public API barrel export
├── .env.example             ← environment variable template
│
├── types/
│   └── index.ts             ← all tool-local TypeScript types
│
├── services/
│   ├── index.ts             ← service barrel export
│   ├── payout.service.ts    ← payout request lifecycle + validation
│   └── stellar.service.ts   ← Stellar Horizon REST abstraction
│
├── hooks/
│   ├── index.ts             ← hook barrel export
│   ├── use-payout-request.ts   ← create/cancel/reset payout lifecycle
│   └── use-stellar-account.ts  ← connect/fetch Stellar account state
│
├── components/
│   ├── index.ts                          ← component barrel export
│   ├── stellar-payout-request-tool.tsx   ← root container component
│   ├── payout-form.tsx                   ← new payout request form
│   ├── payout-status.tsx                 ← single payout status card
│   ├── empty-state.tsx
│   ├── loading-state.tsx
│   ├── error-state.tsx
│   └── success-state.tsx
│
├── fixtures/
│   └── payouts.fixtures.ts  ← deterministic mock data for tests/demo
│
├── tests/
│   ├── TEST_PLAN.md
│   └── payout-fixtures.test.mjs   ← unit tests for services & fixtures
│
└── docs/
    ├── API.md
    ├── SETUP.md
    ├── REVIEW_GUIDE.md
    └── KNOWN_ISSUES.md
```

---

## Module Boundaries

### `types/`

**Owns:** All TypeScript interfaces, type aliases, and error classes used within the tool.

**Constraints:**
- Do not import from main app types or external wallet types.
- Types exported here may be imported by any other module in this tool.
- Never import React or component libraries in this module.

### `services/`

**Owns:** Business logic, data transformation, validation, and Stellar Horizon HTTP calls.

**Responsibilities:**
- `payout.service.ts` — in-memory CRUD for `PayoutRequest`, plus `validatePayoutRequest`.
- `stellar.service.ts` — thin wrapper around Horizon REST API (account lookup, fee
  estimation, transaction submission stub).

**Constraints:**
- Do not import React hooks or components.
- Do not call the main app's Stellar client (`src/services/stellar/`).
- `stellar.service.ts` uses plain `fetch`; the full `stellar-sdk` is not imported at
  the tool layer. A future integration issue may swap this for the shared client.
- Services are singletons; tests must call `.clear()` before each test run.

### `hooks/`

**Owns:** React hooks that wrap services and manage local component state.

**Constraints:**
- Hooks may import from `services/` and `types/` only.
- Do not connect to main app authentication, stores, or router.
- All state is component-local; no global store mutations.

### `components/`

**Owns:** React UI components rendered by this tool.

**Constraints:**
- Components may import from `hooks/`, `services/`, and `types/`.
- Use Tailwind CSS utility classes already in the project. Do not modify
  `src/styles.css` or shared design system internals.
- Every interactive element must have keyboard focus support and ARIA labels.
- Components are not wired into `src/routes/` or the app shell.

### `fixtures/`

**Owns:** Deterministic test data and testnet-only keypair references.

**Constraints:**
- Only testnet public keys may be committed. Secret keys must never be committed.
- Secrets are referenced by environment variable name only (e.g., `VITE_TEST_KEYPAIR_SECRET_A`).
- Fixtures are safe to import in tests and demos; never in production paths.

### `tests/`

**Owns:** Unit tests for services, validation, and fixture integrity.

**Constraints:**
- Tests run with `vitest`; `.mjs` files run in the project test suite.
- Tests must not call external networks; mock Horizon responses locally.
- Tests must be independent and order-agnostic.

### `docs/`

**Owns:** API reference, setup guide, review guide, and known issues.

**Constraints:**
- Documentation-only. No executable code.
- Do not duplicate content from `ARCHITECTURE.md`.

---

## Data Ownership

| Data | Owner | Storage |
|------|-------|---------|
| `PayoutRequest` records | `payout.service.ts` | In-memory `Map` |
| Stellar account state | `use-stellar-account` hook | React component state |
| Form input state | `payout-form.tsx` | React component state |
| Transaction results | Returned inline | Not persisted |

This tool does **not** own:
- User identity / authentication tokens
- Wallet key material (secrets must come from caller context)
- Database schema
- Inbox message data

---

## Integration Constraints

### ✅ Permitted

- Import from any module within `tools/v2/team/stellar-team-payout-request/`
- Use public Tailwind CSS classes already in the project
- Call Stellar Horizon testnet REST API for account lookups
- Import React and common React utilities (`useState`, `useCallback`, etc.)

### ❌ Prohibited until a future integration issue

| Prohibited target | Reason |
|-------------------|--------|
| `src/router.tsx` / `src/routes/` | Main app routing |
| `src/features/mail/` or inbox | Mail rendering engine |
| `src/services/stellar/` | Stellar integration core |
| `src/stores/` | Global state management |
| `src/components/ui/` internals | Design system internals |
| Database schema files | Data persistence layer |
| Main app authentication | Identity system |

---

## Architecture Diagram

```
┌─ UI Layer ──────────────────────────────────────────────────────┐
│  StellarPayoutRequestTool  (root container)                      │
│  ├─ PayoutForm             (input: recipientEmail, amount, memo) │
│  ├─ PayoutStatusDisplay    (shows single payout state card)      │
│  └─ State components       (Empty, Loading, Error, Success)      │
└────────────────────────────────────────────────────────────────-┘
              │ uses                  │ uses
              ▼                       ▼
┌─ Hooks Layer ────────────────────────────────────────────────────┐
│  usePayoutRequest        (create / cancel / reset lifecycle)      │
│  useStellarAccount       (connect / fetch Stellar account)        │
└──────────────────────────────────────────────────────────────────┘
              │ calls                 │ calls
              ▼                       ▼
┌─ Services Layer ─────────────────────────────────────────────────┐
│  payoutService           (in-memory CRUD + validation)            │
│  stellarService          (Horizon REST: accounts, fee, tx submit) │
└──────────────────────────────────────────────────────────────────┘
              │ typed by
              ▼
┌─ Types Layer ────────────────────────────────────────────────────┐
│  PayoutRequest, PayoutFormData, StellarAccount, ...              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Contributor Guidelines

### What contributors CAN do

- ✅ Add or improve components, services, hooks, or tests inside this folder
- ✅ Add new type definitions to `types/index.ts`
- ✅ Add fixtures and test cases
- ✅ Improve accessibility, error handling, and validation
- ✅ Add documentation in `docs/`

### What contributors MUST NOT do

- ❌ Modify the main app shell, routing, or inbox architecture
- ❌ Modify wallet core or the shared Stellar integration
- ❌ Modify the design system or shared UI components
- ❌ Commit Stellar secret keys (even testnet)
- ❌ Create files outside `tools/v2/team/stellar-team-payout-request/`
- ❌ Wire this tool into `src/routes/` before a future integration issue

---

## Security Assumptions

- All Stellar interactions use the **testnet** during V2 development.
- Secret keys are never stored in code or fixtures. They are loaded from
  environment variables at runtime (see `.env.example`).
- Input validation is enforced in `validatePayoutRequest` before any service
  call. Components also validate client-side for fast feedback.
- Memo content is capped at 28 bytes per Stellar protocol limits.
- No user-supplied data is passed to shell commands or SQL queries.

---

## Future Integration Path

When a future issue authorises main-app integration:

1. Create a route in `src/routes/` that renders `StellarPayoutRequestTool`.
2. Wire `useStellarAccount` to the real wallet keypair (via shared Stellar service).
3. Replace `payoutService` in-memory store with an API call to the backend.
4. Connect `validatePayoutRequest` results to shared form primitives if desired.
5. Update `ARCHITECTURE.md` to reflect the new integration boundary.

Do not perform any of these steps in this issue.

---

## Code Review Checklist

- [ ] All changes are inside `tools/v2/team/stellar-team-payout-request/`
- [ ] No imports from prohibited dependencies
- [ ] New logic has test coverage
- [ ] ARCHITECTURE.md respected (no boundary violations)
- [ ] No secrets committed
- [ ] Accessibility requirements met (keyboard nav, ARIA labels)
- [ ] TypeScript compiles without errors (`bun x tsc --noEmit`)
