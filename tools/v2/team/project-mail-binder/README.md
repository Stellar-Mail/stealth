# Project Mail Binder

A self-contained UI surface for grouping mail by project. This tool is scaffolded as an isolated module — it is **not wired into the main app** and has zero dependencies on the application shell, routing, or shared design system files.

## Visual Style Reference

This tool references the app's existing design tokens **read-only** via CSS custom properties. No tokens are forked or overridden.

### Colors

| Token                                | Usage                               |
| ------------------------------------ | ----------------------------------- |
| `--background`                       | Container background                |
| `--foreground`                       | Primary text                        |
| `--card`                             | Card/panel background               |
| `--border`                           | Borders and dividers                |
| `--muted-foreground`                 | Secondary/descriptive text          |
| `--primary` / `--primary-foreground` | CTA buttons                         |
| `--accent`                           | Hover/selected card backgrounds     |
| `--destructive`                      | Error state icon and accents        |
| `--ring`                             | Focus ring color                    |
| `--shadow-elegant`                   | Container and primary button shadow |
| `--shadow-glow`                      | Selected card glow effect           |
| `--gradient-glass`                   | Empty state illustration background |

### Project Color Indicators

Each project has a `color` field mapped to oklch values:

| Name     | Dot                    | Background          |
| -------- | ---------------------- | ------------------- |
| `blue`   | `oklch(0.65 0.15 250)` | 10% opacity variant |
| `purple` | `oklch(0.6 0.18 290)`  | 10% opacity variant |
| `green`  | `oklch(0.7 0.16 155)`  | 10% opacity variant |
| `amber`  | `oklch(0.75 0.15 80)`  | 10% opacity variant |
| `rose`   | `oklch(0.65 0.2 15)`   | 10% opacity variant |
| `cyan`   | `oklch(0.75 0.12 200)` | 10% opacity variant |

### Spacing

Uses Tailwind's default spacing scale: `gap-1` through `gap-6`, `p-3`/`p-4`/`px-6`/`py-16`. No custom spacing tokens.

### Typography

Inherits `--font-interface` (Inter) from the global design system. Scale:

| Element               | Size                     | Weight                           |
| --------------------- | ------------------------ | -------------------------------- |
| Tool heading (h1)     | `text-sm`                | `font-semibold`                  |
| Section headings (h2) | `text-lg` or `text-base` | `font-semibold`                  |
| Card titles (h3, h4)  | `text-sm`                | `font-semibold` or `font-medium` |
| Body / descriptions   | `text-xs` or `text-sm`   | normal                           |
| Badges                | `text-xs`                | `font-medium`                    |

### Border Radius

`rounded-md` (buttons, inputs), `rounded-lg` (cards), `rounded-xl` (container), `rounded-full` (badges, color dots), `rounded-2xl` (illustration box).

## Component States

### Empty

Displayed when no project binders exist. Shows a decorative illustration, heading ("No project binders yet"), description text, and a CTA button ("Create your first project binder").

### Loading

Three animated skeleton cards matching the success layout structure. Container has `aria-busy="true"` and a visually hidden "Loading projects…" announcement.

### Error

Error icon with a descriptive message and a "Retry" button. The error container has `role="alert"` for immediate screen reader announcement.

### Success

Two views:

1. **Project list** — cards with color indicators, name, description, and mail count badge. Keyboard-navigable with arrow keys, Enter/Space to select.
2. **Project detail** — shows selected project info and its bound emails. Back button and Esc key to return.

## Accessibility

- **Semantic HTML first**: `<section>`, `<header>`, `<h1>`–`<h4>`, `<ul>`/`<li>`, `<button>`, `<time>`
- **ARIA only when needed**: `aria-label`, `aria-live="polite"`, `aria-busy`, `aria-selected`, `aria-current`, `role="alert"`, `role="listbox"`/`role="option"`
- **Keyboard model**:
  - `Enter`/`Space` — activate buttons, select project
  - `ArrowUp`/`ArrowDown` — navigate project list
  - `Escape` — close detail view, deselect
- **Focus management**: visible focus rings (`ring-2` / `box-shadow`), auto-focus on detail panel mount
- **Color contrast**: all text/background combinations exceed WCAG AA (4.5:1 for normal text, 3:1 for large text) — verified against the oklch token values

## Core Logic Service

The core feature logic (introduced in Issue #640) is implemented as a set of pure functions wrapped by a `LocalBinderService` for predictable async testing and UI integration.

### Assumptions about Feature Scope

Because the exact "Mail Binder" scope wasn't strictly defined, we assumed a minimalistic CRUD-style feature set:

- Organizing mail items into named collections ("binders" or "projects").
- Basic operations to **Create** and **Delete** projects.
- Operations to **Bind** and **Unbind** mail items to projects.
- Maintaining relationships between mails and projects without needing real external IDs.
- Deterministic behavior: generating test IDs without relying on global unmockable `Math.random` or `Date.now()`.

### API Surface & State Modeling

The `LocalBinderService` models its results as a **discriminated union (`BinderState`)** instead of bare promises or throwing errors. This allows the UI to drive its state directly from the service output, natively supporting `empty`, `loading`, `error`, and `success` views without intermediate mapping.

#### `BinderState` Shapes

- `BinderStateEmpty`: `{ status: "empty" }`
- `BinderStateLoading`: `{ status: "loading" }`
- `BinderStateError`: `{ status: "error", message: string }`
- `BinderStateSuccess`: `{ status: "success", projects: BinderProject[], mails: BinderMail[] }`

#### Exported Service Methods (`LocalBinderService`)

| Method                        | Inputs                                                         | Returns                | Possible Errors                          |
| ----------------------------- | -------------------------------------------------------------- | ---------------------- | ---------------------------------------- |
| `getState()`                  | None                                                           | `Promise<BinderState>` | None                                     |
| `createProject(params)`       | `CreateProjectParams` (name, desc, color)                      | `Promise<BinderState>` | Invalid initial state, empty name        |
| `deleteProject(id)`           | `ProjectId`                                                    | `Promise<BinderState>` | Invalid initial state, project not found |
| `bindMail(projectId, params)` | `ProjectId`, `BindMailParams` (subject, sender, date, snippet) | `Promise<BinderState>` | Invalid initial state, project not found |
| `unbindMail(mailId)`          | `MailId`                                                       | `Promise<BinderState>` | Invalid initial state, mail not found    |

_Under the hood, all logic flows through predictable, pure functions found in `core.ts`. The service handles simulating network latency and state mutation isolation._

## Running Tests

```bash
npx vitest run tools/v2/team/project-mail-binder/
```

Tests cover:

- Core pure function business rules (create, delete, bind, unbind)
- `LocalBinderService` async operations and error boundary
- State builder shape and determinism
- Type guard correctness
- Fixture data validation (field shapes, referential integrity, date validity)
- Accessibility constant integrity (labels, key mappings)

## Folder Structure

```
tools/v2/team/project-mail-binder/
├── components/
│   ├── EmptyState.tsx
│   ├── ErrorState.tsx
│   ├── LoadingState.tsx
│   ├── ProjectDetail.tsx
│   ├── ProjectList.tsx
│   ├── ProjectMailBinder.tsx
│   └── index.ts
├── fixtures/
│   └── projects.ts
├── tests/
│   └── project-mail-binder.test.ts
├── index.ts
├── types.ts
├── README.md
└── specs.md
```

## Ownership Boundary

All work for this tool must stay inside:

```
tools/v2/team/project-mail-binder/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Follow-Up

> **Suggested follow-up issue**: Mount `ProjectMailBinder` in the app shell (add route, nav entry, and wire to real mail data via the existing mail service).
