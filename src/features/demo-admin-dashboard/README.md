# Demo Admin Dashboard

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

The dashboard exposes four tabbed sections:

| Section    | Description                                    |
|------------|------------------------------------------------|
| Overview   | Summary stats cards (accounts, messages, etc.) |
| Accounts   | Table of demo Stellar accounts                 |
| Mail       | Table of demo mail fixtures                    |
| Audit      | Timeline of demo protocol events               |

Future issues can add sections by:
1. Adding a new value to the `DashboardSection` union type in `./types.ts`.
2. Adding an entry to `NAV_ITEMS`, `SECTION_ICON`, and `SECTION_CONTENT` in `./DemoAdminDashboard.tsx`.
3. Optionally adding fake data constants at the module level.
