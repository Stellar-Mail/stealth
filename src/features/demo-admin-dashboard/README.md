# Demo Admin Dashboard


This folder contains the isolated demo-admin dashboard slice for maintainers who need to populate and review fake demo UI data. It intentionally avoids production mail flows, live network calls, real user records, and route/app-shell integration.

## Responsive width notes

| Width         | Breakpoint | Layout rule                                           | Review expectation                                               |
| ------------- | ---------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| 768px–1023px  | Tablet     | One-column data cards with controls stacked first     | No horizontal scrolling; touch controls remain above data cards. |
| 1024px–1439px | Laptop     | Two-column data cards plus a compact review rail      | Cards balance across two columns and width notes stay visible.   |
| 1440px+       | Desktop    | Three-column data cards plus an expanded review panel | Maintainers can scan data areas and layout checks side by side.  |

## Layout checks

- Controls precede data cards on tablet widths.
- Laptop widths use a two-up card grid without requiring unrelated app-shell changes.
- Desktop widths keep responsive review notes visible next to the card grid.

## Validation

Run the local responsive helper test:

```bash
npx vitest run src/features/demo-admin-dashboard/__tests__/layout.test.ts
```

The fixture data in `fixtures/demoData.ts` is deterministic, fake, and safe for public repository review.

This folder is the implementation boundary for the admin dashboard used to populate and manage demo data in the Stealth demo inbox UI.

Contributors working on demo-admin issues should keep new dashboard code, local state helpers, fixtures, validators, UI components, test utilities, and documentation inside:

`src/features/demo-admin-dashboard/`

The rest of the app should only import stable entry points from this folder once the feature is ready to connect to the demo inbox. Avoid changing existing inbox, mail reader, calendar, sender-conversion, or protocol modules unless an issue explicitly asks for a minimal integration shim.

Primary goals:

- Create a safe admin surface for loading demo inbox data.
- Keep demo data editing separate from production mail flows.
- Make every demo data mutation previewable, reversible, and auditable.
- Provide fixtures and validation that keep the demo UI realistic and stable.

---

**Usage Example:**

```tsx

import { AdminPage, AdminPanel, AdminSection, demoStats } from '@/features/demo-admin-dashboard';

export default function DemoAdmin() {
  return (
    <AdminPage title="Stealth Demo Dashboard">
      <AdminPanel title="Statistics" description="Fake deterministic data">
        <div>Total Users: {demoStats.totalUsers}</div>
      </AdminPanel>

      <AdminSection title="Users" collapsible>
        {/* ... */}
      </AdminSection>
    </AdminPage>
  );
}

## Integration

The `DemoAdminDashboard` component is exported from `./index.ts`. It is a self-contained shell that manages its own tab state and renders deterministic fake data.

### Usage

```tsx
import { DemoAdminDashboard } from "@/features/demo-admin-dashboard";

The component has one optional prop, `className`, which is forwarded to the root element. Mount it anywhere a full-height admin surface is needed:

<DemoAdminDashboard className="h-screen" />
```

### Props

| Prop        | Type     | Default | Description                          |
|-------------|----------|---------|--------------------------------------|
| `className` | `string` | `""`    | CSS class forwarded to the root node |

### Sections

The dashboard exposes these tabbed sections:

| Section    | Description                                    |
|------------|------------------------------------------------|
| Overview   | Summary stats cards (accounts, messages, etc.) |
| Accounts   | Table of demo Stellar accounts                 |
| Mail       | Table of demo mail fixtures                    |
| Templates  | Pick a message template and insert it as a draft |
| Audit      | Timeline of demo protocol events               |

Future issues can add sections by:
1. Adding a new value to the `DashboardSection` union type in `./types.ts`.
2. Adding an entry to `NAV_ITEMS`, `SECTION_ICON`, and `SECTION_CONTENT` in `./DemoAdminDashboard.tsx`.
3. Optionally adding fake data constants at the module level.

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
- `templates/templateToDraft.ts` — pure, non-mutating helpers that map a template onto the
  existing `Draft` shape (`./types/draft`) and `insertTemplate` / `removeDraft` the dataset,
  with duplicate-insert validation.
- `templates/TemplatePicker.tsx` — searchable list, detail preview (subject, recipients,
  body, tags), an **Insert draft** action that disables once a template is in the dataset,
  and the running draft dataset with per-row remove.

`TemplatePicker` accepts an optional `onDatasetChange(dataset: Draft[])` callback so a
parent can observe drafts as they accumulate.

### Follow-up integration (out of scope here)

This issue keeps everything inside the feature folder. Connecting the produced `Draft[]` to
the live demo inbox (e.g. dispatching `loadDraft` into the shared `draftReducer`, or seeding
`src/components/mail/data.ts`) is a deliberate follow-up so that no files outside
`src/features/demo-admin-dashboard/` change here.
