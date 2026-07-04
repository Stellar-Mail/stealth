# Proof Inspector — Contributor Handoff

> Covers the proof inspection surface: the Proof Inspector modal, the Provenance Inspector,
> provenance data contracts, trust-state derivation, and copy-proof actions.
> Scoped to existing app code. Do **not** add a new standalone tool folder for this area.

---

## 1. Files a Contributor Must Understand

| File                                                   | Role                                                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/proof-inspector/ProofInspectorModal.tsx` | Full-screen modal that lets a user search for, browse, and copy cryptographic proof records (message hash, payment hash, diagnostic ID, contract address).   |
| `src/features/proof-inspector/index.ts`                | Barrel re-export — only public surface: `ProofInspectorModal`.                                                                                               |
| `src/components/mail/provenance.ts`                    | Pure data layer. Exports `getEmailProvenance(email)` which assembles the full `ProvenanceDetails` object, and all related TypeScript interfaces. No React.   |
| `src/components/mail/ProvenanceInspector.tsx`          | Small modal that renders a single `ProvenanceItemDetails` record (title, key-value pairs, raw JSON viewer, copy-JSON button). Opened from `ProvenancePanel`. |
| `src/components/mail/trust-state.ts`                   | Derives ordered `TrustState[]` from an `Email` object. Shared logic used on every surface that renders sender badges.                                        |
| `src/components/mail/trust-state.test.ts`              | Vitest unit tests for `getTrustStates` and `getPrimaryTrustState`. The only existing automated test file for this area.                                      |
| `src/components/mail/data.ts`                          | `Email` type and all enum literals (`MailFolder`, `SenderPolicy`, `PayloadStatus`, etc.) that the proof/provenance layer depends on.                         |

---

## 2. Data Contracts

### `Email` (source of truth — `data.ts`)

Key fields consumed by proof/provenance:

| Field            | Type                        | Used for                                                                                                      |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`                    | Deterministic seed for all mock hashes and addresses                                                          |
| `email`          | `string`                    | Raw sender identifier; may be a Stellar address (`G…`), a federated address (`user*domain`), or a plain email |
| `folder`         | `MailFolder`                | Drives `postageStatus`, `isVerified`, SMTP-bridge detection                                                   |
| `senderPolicy`   | `SenderPolicy \| undefined` | Highest-priority trust signal; `undefined` = sender never converted                                           |
| `postageAmount`  | `string \| undefined`       | Used as `paid` trust signal and for XLM display                                                               |
| `verifiedSender` | `boolean \| undefined`      | Explicit verification flag                                                                                    |
| `labels`         | `string[] \| undefined`     | Secondary signals: `"Bridge"`, `"Bridged"`, `"Paid"`, `"Encrypted"`                                           |
| `unread`         | `boolean`                   | Read-receipt state in `MockProofRecord.readAt`                                                                |

### `ProvenanceDetails` (assembled in `provenance.ts`)

Six sub-records, each carrying a nested `inspector: ProvenanceItemDetails` for the drill-down modal:

```
senderIdentity    — resolved Stellar public key, federation trace
relaySource       — relay node ID, domain, pubkey, routing signature
messageHash       — SHA-256 digest of message body, payload size
payloadCommitment — Curve25519 envelope commitment hash, ephemeral key
postageRecord     — Stellar tx hash, escrow contract address, status
receiptRecord     — Soroban contract ID, delivery event, gas cost
```

`ProvenanceItemDetails` shape (consumed by `ProvenanceInspector.tsx`):

```ts
{
  title: string;
  description: string;
  keyValuePairs: { label: string; value: string; isCode?: boolean }[];
  rawJson: string; // pre-serialised JSON string
}
```

### `MockProofRecord` (internal to `ProofInspectorModal.tsx`)

Built by `useMemo` from the `emails` prop. Every field is **deterministically faked** from
`email.id` — never fetched from a network or database. See §3 for the safety note.

### `TrustState` (from `src/features/design-system/components/trust-badge`)

Ordered values: `"blocked" | "allowed" | "verified" | "encrypted" | "bridged" | "paid" | "unknown"`.  
Priority is first-index-wins; `getTrustStates` always de-duplicates before returning.

---

## 3. Safety, Privacy, and Security Notes

### All proof data is fake demo data

`ProofInspectorModal` and `provenance.ts` **generate every hash, address, and contract ID
deterministically from `email.id`** using a simple LCG (`getDeterministicHash`) and a
character-table address builder (`getDeterministicStellarAddress`).

- No live ledger is queried. No real keys exist.
- The "Verify on Stellar.Expert" links are informational only; they will not resolve a real transaction.
- The relay domain `relay-us-east-1.stealth.network` and all `relayNN.stealth.network` values are placeholder strings, not live infrastructure.

**Do not replace this demo data with real user keys, private keys, wallet seeds, or live
customer mail without a full security review.**

### Message body is intentionally withheld

`ProofInspectorModal` excludes the `email` object from the copied diagnostic JSON
(`email: undefined` in the `JSON.stringify` call) to avoid leaking body or metadata
through the clipboard. `ProvenanceInspector` only surfaces `rawJson` fields pre-assembled
in `provenance.ts`, which never embed the message body.

The subject preview in the found-state is partially masked (`i > 4 && i < 20 → "•"`). This
is a UX privacy hint, not a cryptographic protection.

### Trust derivation is client-only

`getTrustStates` is **pure and synchronous** — no async verification, no server round-trip.
Changes to priority order silently affect every surface rendering sender badges. Always add a
test case to `trust-state.test.ts` before changing the ordering logic.

### Search validation is cosmetic

The query-format validation (Stellar address regex, 32-byte hash regex, UUID regex) gives
real-time user feedback but **does not gate the search**. A query that fails validation still
executes. Do not treat it as a security control.

### Clipboard access

Both components use `navigator.clipboard.writeText`, which requires a secure context (HTTPS
or `localhost`) and a user gesture. The buttons silently do nothing where the API is
unavailable. Do not add a DOM-based fallback outside React's lifecycle.

---

## 4. User-Facing States a Contributor Must Understand

### `ProofInspectorModal` states

| State                | Trigger                                     | What renders                                              |
| -------------------- | ------------------------------------------- | --------------------------------------------------------- |
| **Idle / shortcuts** | `!hasSearched`                              | Quick-shortcut grid of first 4 proof records              |
| **Found**            | `hasSearched && searchResults.length > 0`   | 4-section detail grid + footer CTAs                       |
| **Not found**        | `hasSearched && searchResults.length === 0` | Rose-bordered panel with 3 next-step actions              |
| **Validation hint**  | query has content                           | Inline `<p>` below search bar (success / warning / error) |

Only `searchResults[0]` (first match) is displayed. Multi-result display is not implemented.

### `ProvenanceInspector` states

| State           | Trigger                    |
| --------------- | -------------------------- |
| Renders nothing | `!open` or `!details`      |
| Full modal      | `open && details !== null` |

Stateless except for the 2-second `copied` flash on the JSON copy button.

### Postage status badges

Derived in `ProofInspectorModal` from `email.folder`:

| Folder        | `postageStatus` |
| ------------- | --------------- |
| `"requests"`  | `"pending"`     |
| `"spam"`      | `"refunded"`    |
| anything else | `"settled"`     |

`provenance.ts` uses the same `isSmtpBridge` / `isRequest` flags for its `postageStatus`
text. Keep the two derivations in sync if you change folder logic.

---

## 5. Links to Existing Files and Tests

- Unit tests: [`src/components/mail/trust-state.test.ts`](../../src/components/mail/trust-state.test.ts)
- Email type + folder enum: [`src/components/mail/data.ts`](../../src/components/mail/data.ts)
- Metadata privacy policy: [`docs/security/metadata-policy.md`](../security/metadata-policy.md)
- Sender assurance levels: [`docs/product/sender-assurance-levels.md`](../product/sender-assurance-levels.md)
- Postage pricing model: [`docs/protocol/postage-pricing-model.md`](../protocol/postage-pricing-model.md)

---

## 6. QA Checklist

Before merging any change to a file in this area, verify:

### Functional

- [ ] Opening `ProofInspectorModal` with no `initialQuery` shows the quick-shortcut grid.
- [ ] Submitting a query with a known `messageHash` fragment surfaces the found-state with all four sections populated.
- [ ] Submitting an unknown query shows the not-found panel with three next-step items.
- [ ] "Copy Proof Diagnostic Report" puts valid JSON on the clipboard and the `email` object (body, metadata) is absent from it.
- [ ] "Open Message" closes the inspector and opens the correct email.
- [ ] The Stellar.Expert footer link is present only when a record is selected.
- [ ] Closing the modal (×, backdrop click, Close button) resets `query`, `hasSearched`, and `validationMsg`.
- [ ] `ProvenanceInspector` renders all key-value pairs and the raw JSON panel for every provenance section.
- [ ] The copy-JSON button shows the "Copied" tick for ~2 s then reverts.

### Trust states

- [ ] `npx vitest run` passes all cases in `trust-state.test.ts` without modification.
- [ ] A sender with `senderPolicy: "allow"` and `folder: "verified"` shows `"allowed"` as the primary badge.
- [ ] A plain inbox message with no labels or policy shows only `"unknown"`.

### Type safety

- [ ] `npx tsc --noEmit` reports zero errors in the changed files.
- [ ] `npm run lint` reports no new warnings.

### Privacy / safety

- [ ] No real email address, private key, wallet seed, or live customer data appears in any changed file.
- [ ] Clipboard copy paths exclude the full `Email` object (body, attachments, raw metadata).
- [ ] No new outbound network call (`fetch`, `axios`, `XHR`) is introduced without explicit reviewer sign-off.
