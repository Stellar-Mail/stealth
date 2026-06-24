# Onboarding Feature: Safety Boundaries & Contributor Handoff

This directory handles the user onboarding modal flow, gating app access until the user configures their identity, recovery settings, postage requirements, and contact policy boundaries.

## 📂 Key Files & Data Contracts

A contributor must understand the following files:

- [OnboardingModal.tsx](./OnboardingModal.tsx): Orchestrates the 7 step slides, visual transitions (via Framer Motion), and handles progress status.
- [useOnboarding.ts](./useOnboarding.ts): Orchestrates state management, step navigation history (`direction`), `localStorage` persistence, and formatting for contract submission.
- [useFreighter.ts](./useFreighter.ts): Wraps Freighter wallet extension connection states (`connected`, `connecting`, `unavailable`, `error`).
- [types.ts](./types.ts): Defines the `OnboardingDraft` type, default values, step array, and converter/mapping logic.

### Data Contracts

- `OnboardingStep`: One of `"identity" | "recovery" | "address" | "unknown-sender-rules" | "minimum-postage" | "receipt-preference" | "policy-review"`.
- `OnboardingDraft`:
  ```typescript
  export type OnboardingDraft = {
    walletAddress: string | null;
    recoveryAcknowledged: boolean;
    unknownSenderRule: UnknownSenderPolicy; // "request" | "verified" | "block"
    minimumPostage: string; // XLM decimal string, e.g. "0.0001"
    receiptOnDelivery: boolean;
  };
  ```

---

## 🔒 Safety, Privacy & Security Assumptions

1.  **Wallet Read-Only Isolation:**
    - The `IdentityStep` only requests read-only public key access via Freighter.
    - No transaction signing, seed phrases, or private key handling occur during this onboarding flow.
2.  **Privacy-Preserving Defaults:**
    - `unknownSenderRule` defaults to `"request"`. This ensures maximum safety for new users (unknown emails are held for approval rather than silently delivered or auto-blocked).
3.  **Local Storage Security:**
    - Draft data is cached to `localStorage` under `stealth-onboarding-v1` for flow resumes.
    - No sensitive/private user data is written.
    - The key is cleared upon successful onboarding completion via `useOnboarding.submit`.
4.  **Defensive Decimal Parsing:**
    - `xlmToStroops` converts the user's XLM string to a Soroban-compatible stroop integer string (multiplied by 10^7).
    - Any invalid, non-numeric, or negative string defensively falls back to `"0"`.

---

## 🧪 Testing & Validation Links

Unit tests covering conversion boundaries, step arrays, and default states live in:

- [tests/unit/onboarding/onboarding.test.ts](../../../tests/unit/onboarding/onboarding.test.ts)

Run the test suite locally using:

```bash
bun test tests/unit/onboarding/onboarding.test.ts
```

---

## 📋 Lightweight QA Checklist for Reviewers

- [ ] **Resumability Check:** Refresh the page midway through onboarding. Ensure the wizard resumes on the correct step with all previous input fields pre-populated.
- [ ] **Wallet Disconnection Handling:** Ensure that if Freighter is unavailable, an installation link is correctly rendered, and if the user denies the connection, a clear error status displays.
- [ ] **Boundary Inputs:** Try entering negative numbers, words, or very high decimal numbers in the `minimum-postage` input. Ensure the values are handled safely without crashing.
- [ ] **Complete Submission Validation:** Upon completing the final step, verify that the `localStorage` key `stealth-onboarding-v1` is cleared.
