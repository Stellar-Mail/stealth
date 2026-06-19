# Proof Inspector — Contributor Handoff

This document names every file a contributor must understand before modifying the proof inspector surface, calls out safety and privacy constraints, and provides a lightweight QA checklist.

---

## Relevant files

| File | Role |
|---|---|
| `src/features/proof-inspector/ProofInspectorModal.tsx` | Full-screen modal. Owns search input, format validation, result display, and the "Copy Proof Diagnostic Report" action. |
| `src/features/proof-inspector/index.ts` | Public barrel — only `ProofInspectorModal` is exported. Do not export internal helpers from here. |
| `src/components/mail/provenance.ts` | Pure functions. Owns `getEmailProvenance(email)` and all `ProvenanceDetails` / `ProvenanceItemDetails` types. All mock hashes and deterministic addresses are generated here. |
| `src/components/mail/ProvenanceInspector.tsx` | Slide-over detail panel. Reads a `ProvenanceItemDetails` object (produced by `provenance.ts`) and renders key-value pairs plus a raw JSON viewer with copy action. |
| `src/components/mail/ProvenancePanel.tsx` | Wraps the six-step provenance timeline and each expandable section. Calls `getEmailProvenance` and passes `inspector` objects down to `ProvenanceInspector`. |
| `src/components/mail/data.ts` | Defines the `Email` type — the shared data contract between the mail list and every proof/provenance component. |
| `tests/unit/mail/provenance.test.ts` | Unit tests for `getEmailProvenance` timeline outputs (verified vs bridged paths). |
| `tests/unit/mail/proof-inspector.test.ts` | Unit tests for the `MockProofRecord` data contract shape produced inside `ProofInspectorModal`. |

---

## Data contracts

### `Email` (from `src/components/mail/data.ts`)

Fields that proof and provenance logic branch on:

| Field | Type | Effect on proof display |
|---|---|---|
| `id` | `string` | Seed for all deterministic mock hashes and addresses. |
| `email` | `string` | Treated as sender identifier; if it matches `/^G[A-Z2-7]{55}$/` it is used as-is, otherwise a deterministic Stellar address is derived from it. |
| `folder` | `string` | `"spam"` / bridge → postage and receipt steps marked `skipped`. `"requests"` → postage status `"pending"`. All others → `"settled"`. |
| `senderPolicy` | `string \| undefined` | `"verify"` maps sender rule to `"default"` in `MockProofRecord`. |
| `postageAmount` | `string \| undefined` | Displayed as XLM in the modal (`value / 10_000_000`). Falls back to `"10000000"` (1 XLM). |
| `unread` | `boolean` | Controls `readAt` — `null` when `true`, `"Delivered + Read"` when `false`. |

### `MockProofRecord` (internal to `ProofInspectorModal`)

This interface is **not exported**. It is computed from `emails` via `useMemo` using deterministic string operations — **no real cryptographic material is ever produced or consumed**.

Key fields: `messageHash`, `paymentHash`, `diagnosticId`, `contractAddress`, `postageStatus`, `senderRule`, `relayNode`, `latency`, `signature`.

The `email` field on a `MockProofRecord` holds a reference back to the original `Email` object. The "Copy Proof Diagnostic Report" action explicitly sets `email: undefined` before serialising to JSON to prevent personal data leaking into the clipboard payload.

### `ProvenanceDetails` / `ProvenanceItemDetails` (from `src/components/mail/provenance.ts`)

`ProvenanceDetails` has six sections: `senderIdentity`, `relaySource`, `messageHash`, `payloadCommitment`, `postageRecord`, `receiptRecord`. Each section has an `inspector: ProvenanceItemDetails` sub-object that is passed directly to `ProvenanceInspector` for the detail slide-over.

---

## Safety notes

### All proof data is demo/mock

**Every hash, address, signature, and contract ID in this surface is deterministically generated from the email `id` field. No real cryptographic keys, no real Stellar transactions, and no live network calls are made.** The `getDeterministicHash` function in `provenance.ts` uses a simple LCG — it is not a secure hash function and must never be used outside of demo UI generation.

The relay node hostname (`relay-us-east-1.stealth.network`, `relayNN.stealth.network`) and the Stellar.Expert link in the modal footer are illustrative placeholders pointing at fabricated data.

### Privacy assumptions

- The modal intentionally omits the full message subject (masks characters 5–20 with `•`) in diagnostic mode.
- Plaintext body content is never surfaced in the inspector.
- The clipboard copy action for the proof diagnostic report strips the `email` field from the JSON output.
- `ProvenanceInspector` receives a `ProvenanceItemDetails` object that contains only the fields listed in `keyValuePairs` and `rawJson` — it never receives the full `Email`.
- Do not add sender name, subject, or body to any new `keyValuePairs` entries without a deliberate privacy review.

### Trust and security-sensitive behaviour

- The "Verify on Stellar Explorer" link and the footer `Stellar.Expert` link are constructed from mock payment hashes. If this surface is ever wired to live data, those URLs must be sanitised and the `href` must be validated before rendering.
- Format validation in the search bar (`addressRegex`, `hashRegex`, `uuidRegex`) is UI feedback only. It does not perform real-time network lookups or verify existence of a record.
- `isVerified` in `provenance.ts` is derived from the `folder` field and a name heuristic — it does not represent a cryptographically verified state from any external source.
- No credentials, private keys, or session tokens are stored or passed through any component in this area.

### Scope guardrails

- Do not introduce network requests, localStorage reads, or crypto-API calls inside `ProofInspectorModal` or `provenance.ts` without a separate security review.
- Do not rename `MockProofRecord` to anything that implies real proof validation (e.g. `ProofRecord`, `VerifiedRecord`) unless actual on-chain verification is wired up.
- Keep demo data generation inside `provenance.ts`. Do not duplicate the deterministic hash/address logic into `ProofInspectorModal`.

---

## User-facing states

| State | Trigger | Component |
|---|---|---|
| Empty / suggestions | Modal opened, no search submitted | `ProofInspectorModal` — shows up to 4 quick-shortcut tiles from `proofRecords`. |
| Format validation feedback | Any query text typed | Inline `validationMsg` below the search input (success / warning / error). |
| No results | Search submitted, no records match | `ShieldAlert` panel with three recommended next steps. |
| Record found | Search submitted, one or more records match | Four metadata sections + copy report button + footer CTAs. |
| Provenance detail slide-over | User clicks an inspector row in `ProvenancePanel` | `ProvenanceInspector` modal over the main view. |

---

## QA checklist

Before merging any change that touches this area, verify:

- [ ] **Mock data only** — no real keys, hashes, or addresses appear in the UI or clipboard output for a fresh demo session.
- [ ] **Subject masking** — the subject in the "Record found" header masks characters 5–20 with `•`.
- [ ] **Clipboard privacy** — "Copy Proof Diagnostic Report" JSON does not include the `email` object or any fields from it.
- [ ] **Format validator** — entering a 56-char `G`-prefix string shows the success state; a 55-char string shows the error with the correct length count; a plain word shows the warning.
- [ ] **Bridged / spam path** — an email with `folder: "spam"` shows `postageStatus: "refunded"` and both postage and receipt timeline steps are `skipped` in the provenance panel.
- [ ] **Requests path** — an email with `folder: "requests"` shows `postageStatus: "pending"`.
- [ ] **No result state** — a nonsense query (e.g. `"zzz"`) shows the "Proof Record Not Found" panel.
- [ ] **Open Message CTA** — clicking "Open Message" calls `onOpenMessage` with the matched email and then calls `onClose`.
- [ ] **Provenance panel** — each of the six sections has a working "Inspect" detail slide-over; "Copy JSON" in the slide-over copies `rawJson` to clipboard.
- [ ] **TypeScript** — `bun x tsc --noEmit` passes with no new errors.
- [ ] **Lint** — `bun run lint` passes with no new warnings in touched files.
- [ ] **Unit tests** — `bun test tests/unit/mail/` passes.

---

## Related files and docs

- [`src/components/mail/data.ts`](../../src/components/mail/data.ts) — `Email` type and demo mail data.
- [`tests/unit/mail/provenance.test.ts`](../../tests/unit/mail/provenance.test.ts) — Timeline unit tests for `getEmailProvenance`.
- [`tests/unit/mail/proof-inspector.test.ts`](../../tests/unit/mail/proof-inspector.test.ts) — Data contract tests for `MockProofRecord` shape.
- [`docs/security/metadata-policy.md`](../security/metadata-policy.md) — Platform-wide metadata privacy policy.
- [`protocol/messages/envelope_spec.md`](../../protocol/messages/envelope_spec.md) — Envelope format spec referenced by relay and hash fields.
