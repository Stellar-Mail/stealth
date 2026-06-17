# Demo Admin Dashboard

This folder contains the isolated demo-admin dashboard slice for maintainers who need to populate and review fake demo UI data. It intentionally avoids production mail flows, live network calls, real user records, and route/app-shell integration.

Contributors working on demo-admin issues should keep new dashboard code, local state helpers, fixtures, validators, UI components, test utilities, and documentation inside:

`src/features/demo-admin-dashboard/`

The rest of the app should only import stable entry points from this folder once the feature is ready to connect to the demo inbox. Avoid changing existing inbox, mail reader, calendar, sender-conversion, or protocol modules unless an issue explicitly asks for a minimal integration shim.

Primary goals:

- Create a safe admin surface for loading demo inbox data.
- Keep demo data editing separate from production mail flows.
- Make every demo data mutation previewable, reversible, and auditable.
- Provide fixtures and validation that keep the demo UI realistic and stable.

## Responsive Width Notes

| Width         | Breakpoint | Layout rule                                           | Review expectation                                               |
| ------------- | ---------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| 768px–1023px  | Tablet     | One-column data cards with controls stacked first     | No horizontal scrolling; touch controls remain above data cards. |
| 1024px–1439px | Laptop     | Two-column data cards plus a compact review rail      | Cards balance across two columns and width notes stay visible.   |
| 1440px+       | Desktop    | Three-column data cards plus an expanded review panel | Maintainers can scan data areas and layout checks side by side.  |

## Layout Checks

- Controls precede data cards on tablet widths.
- Laptop widths use a two-up card grid without requiring unrelated app-shell changes.
- Desktop widths keep responsive review notes visible next to the card grid.

## Validation

Run the unit tests:

```bash
npm run test
```

The fixture data in `fixtures/demoData.ts` and `fixtures/campaignSnapshotFixtures.ts` is deterministic, fake, and safe for public repository review.

To run only the demo-admin tests:

```bash
npx vitest run src/features/demo-admin-dashboard/__tests__/
```

---

## Integration

The `DemoAdminDashboard` component is exported from `./index.ts`. It is a self-contained shell that manages its own tab state and renders deterministic fake data.

### Usage

```tsx
import { DemoAdminDashboard } from "@/features/demo-admin-dashboard";

// Mount it anywhere a full-height admin surface is needed:
<DemoAdminDashboard className="h-screen" />;
```

### Props

| Prop        | Type     | Default | Description                          |
| ----------- | -------- | ------- | ------------------------------------ |
| `className` | `string` | `""`    | CSS class forwarded to the root node |

### Sections

The dashboard exposes these tabbed sections:

| Section     | Description                                                    | Data source                     | Status      |
| ----------- | -------------------------------------------------------------- | ------------------------------- | ----------- |
| Overview    | Summary stats cards, protocol scenario preset selector         | `presets.ts`, `demoData.ts`     | Implemented |
| Accounts    | Table of demo Stellar accounts and relay nodes                 | `presets.ts`                    | Implemented |
| Mail        | Table of demo inbox/request/spam mail fixtures                 | `presets.ts`                    | Implemented |
| Attachments | Table of file attachment fixtures linked to mail items         | `presets.ts`                    | Implemented |
| Events      | Table of calendar and protocol events                          | `presets.ts`                    | Implemented |
| Templates   | Pick a message template and insert it into the active drafts   | `templates/messageTemplates.ts` | Implemented |
| Campaigns   | Save/restore draft dataset snapshots and manage campaigns      | `campaignSnapshotFixtures.ts`   | Placeholder |
| Audit       | Timeline of demo protocol events (sessions, policies, postage) | `presets.ts`                    | Implemented |
| Analytics   | Privacy-preserving aggregate product analytics (future)        | TBD                             | Placeholder |

---

## Message templates (`./templates`)

The **Templates** section renders `TemplatePicker`: an admin surface for choosing a
pre-written message template and inserting it into the draft dataset that will populate
the demo inbox.

- `templates/messageTemplates.ts` — deterministic, fake template fixtures. Recipients use
  the reserved `*stealth.demo` handle or `example.com`/`example.org` domains so nothing
  references real people or live addresses (a test enforces this).
- `templates/templateSearch.ts` — `searchTemplates(templates, query)` is a ranked,
  case-insensitive substring search (name/subject hits outrank tag/description hits).
- `docs/CAMPAIGN_COPY_RULES.md` — campaign copy rules for demo messages and internal
  notes, with examples and a review checklist.
- `templates/templateToDraft.ts` — pure, non-mutating helpers that map a template onto the
  existing `Draft` shape (`./types/draft`) and `insertTemplate` / `removeDraft` the dataset,
  with duplicate-insert validation.
- `templates/TemplatePicker.tsx` — searchable list, detail preview (subject, recipients,
  body, tags), an **Insert draft** action that disables once a template is in the dataset,
  and the running draft dataset with per-row remove.

`TemplatePicker` accepts an optional `onDatasetChange(dataset: Draft[])` callback so a
parent can observe drafts as they accumulate.

### Follow-up integration (out of scope here)

Connecting the produced active `Draft[]` to the live demo inbox (e.g. dispatching `loadDraft` into the shared `draftReducer`, or seeding `src/components/mail/data.ts`) is a deliberate follow-up so that no files outside `src/features/demo-admin-dashboard/` change here.
