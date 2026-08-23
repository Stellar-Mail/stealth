# Onboarding Feature: Safety Boundaries & Contributor Handoff

This directory handles the profile-first, account-based onboarding flow. Users
configure their display identity, acknowledge recovery, set postage
requirements, and define contact policy boundaries. The flow is fully server
backed and resumable across refreshes and devices — no wallet extension is
required.

## 📂 Key Files & Data Contracts

A contributor must understand the following files:

- [OnboardingFlow.tsx](./OnboardingFlow.tsx): Orchestrates the 7 step slides, visual transitions (via Framer Motion), progress, restore, and completion states.
- [useOnboarding.ts](./useOnboarding.ts): Orchestrates state management, step navigation (`advance`/`retreat`), server-backed draft persistence (debounced), restore-on-mount, and idempotent final submission.
- [api.ts](./api.ts): Client API surface for `GET/PUT /api/v1/onboarding/draft` and `POST /api/v1/onboarding/complete`. All request/response schemas are `.strict()`.
- [types.ts](./types.ts): Defines the `OnboardingDraft` type, default values, step array, and converter/mapping logic.

### Data Contracts

- `OnboardingStep`: One of `"profile" | "stealth-address" | "recovery" | "sender-policy" | "postage" | "receipts" | "review"`.
- `OnboardingDraft`:
  ```typescript
  export type OnboardingDraft = {
    displayName: string;
    recoveryAcknowledged: boolean;
    unknownSenderRule: UnknownSenderPolicy; // "request" | "verified" | "block"
    minimumPostage: string; // XLM decimal string, e.g. "0.0001"
    receiptOnDelivery: boolean;
  };
  ```

---

## 🔒 Safety, Privacy & Security Assumptions

1.  **No Client-Supplied Wallet:**
    - Identity is the authenticated account (recovered via the session cookie server-side). The client never supplies, and the server never accepts, a `walletAddress` — unknown request fields are rejected with 422.
2.  **Privacy-Preserving Defaults:**
    - `unknownSenderRule` defaults to `"request"`. This ensures maximum safety for new users (unknown senders are held for approval rather than silently delivered or auto-blocked).
3.  **Server-Backed Draft Storage:**
    - Draft data is persisted per-user on the server (durable storage), keyed by userId. No `localStorage` caching. Resumable across refreshes and devices.
4.  **Defensive Decimal Parsing:**
    - `xlmToStroops` converts the user's XLM string to a Soroban-compatible stroop integer string (multiplied by 10^7).
    - Any invalid, non-numeric, or negative string defensively falls back to `"0"`.

---

## 🧪 Testing & Validation Links

Unit tests covering conversion boundaries, step arrays, and default states live in:

- [tests/unit/onboarding/onboarding.test.ts](../../../tests/unit/onboarding/onboarding.test.ts)

Run the test suite locally using:

```bash
npm test -- tests/unit/onboarding/onboarding.test.ts
```

---

## 📋 Lightweight QA Checklist for Reviewers

- [ ] **Resumability Check:** Refresh the page midway through onboarding. Ensure the wizard resumes on the correct step with all previous input fields pre-populated.
- [ ] **Cross-Device Resume:** Sign in on a second device, re-enter onboarding, and verify the draft is restored.
- [ ] **Boundary Inputs:** Try entering negative numbers, words, or very high decimal numbers in the `minimum-postage` input. Ensure the values are handled safely without crashing.
- [ ] **Duplicate Submission Safety:** Submit twice with the same payload and verify the idempotency replay path prevents duplicate policy writes.
