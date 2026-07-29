# Stellar Team Payout Request

A self-contained UI surface for creating and reviewing Stellar team payout requests. This tool is scaffolded as an isolated module — it is **not wired into the main app** and has zero dependencies on the application shell, routing, authentication, wallet core, or shared design system.

## Visual Style Reference

This tool references the app's existing design tokens **read-only** via CSS custom properties. No shared design tokens are modified or overridden.

### Colors

| Token                                | Usage                               |
| ------------------------------------ | ----------------------------------- |
| `--background`                       | Container background                |
| `--foreground`                       | Primary text                        |
| `--card`                             | Card and panel background           |
| `--border`                           | Borders and dividers                |
| `--muted-foreground`                 | Secondary text                      |
| `--primary` / `--primary-foreground` | Primary action buttons              |
| `--accent`                           | Interactive hover states            |
| `--destructive`                      | Error state accents                 |
| `--ring`                             | Keyboard focus ring                 |
| `--shadow-elegant`                   | Card elevation                      |
| `--gradient-glass`                   | Empty state illustration background |

### Status Indicators

The interface displays local request status using semantic badges.

| Status  | Purpose                          |
| ------- | -------------------------------- |
| Draft   | Request is being prepared        |
| Ready   | Ready for future submission      |
| Success | Request created successfully     |
| Error   | Validation or processing failure |

### Spacing

Uses Tailwind's default spacing scale (`gap-1` through `gap-6`, `p-3`, `p-4`, `px-6`, `py-16`). No custom spacing tokens are introduced.

### Typography

Inherits the application's interface font.

| Element         | Style                   |
| --------------- | ----------------------- |
| Page heading    | `text-sm font-semibold` |
| Section heading | `text-lg font-semibold` |
| Labels          | `text-sm font-medium`   |
| Body text       | `text-sm`               |
| Status badges   | `text-xs font-medium`   |

### Border Radius

Uses the existing design language:

- `rounded-md`
- `rounded-lg`
- `rounded-xl`
- `rounded-full`

No custom radius values are introduced.

---

# Component States

## Empty

Displayed before a payout request has been created.

Contains:

- introductory illustration
- description
- "Create payout request" action

## Loading

Displays skeleton placeholders while the request is being prepared.

The loading container exposes:

- `aria-busy="true"`
- visually hidden loading announcement

## Error

Displays:

- descriptive error message
- Retry button

The container uses:

```
role="alert"
```

to announce failures immediately.

## Success

Displays:

- payout summary
- recipient
- payout amount
- memo
- request status
- confirmation message
- "Create another request" action

---

# Accessibility

The UI follows an accessibility-first approach.

## Semantic HTML

Uses:

- `<section>`
- `<header>`
- `<form>`
- `<label>`
- `<button>`
- `<dl>`
- `<dt>`
- `<dd>`

before introducing ARIA.

## ARIA

Used only where appropriate:

- `aria-label`
- `aria-labelledby`
- `aria-live="polite"`
- `aria-busy`
- `role="alert"`

## Keyboard Support

- Tab / Shift+Tab navigate controls
- Enter submits buttons
- Space activates buttons
- Escape may be used by future modal workflows

## Focus Management

Visible focus indicators are preserved.

Interactive controls follow a logical tab order.

Future integration should move focus to:

- the first validation error after failed submission
- the confirmation heading after successful request creation

## Color Contrast

The interface relies on the repository's existing design tokens and maintains WCAG AA contrast expectations.

---

# Local UI Workflow

The isolated workflow is:

```
Empty
      ↓
Payout Form
      ↓
Loading
      ↓
Success
```

or

```
Loading
      ↓
Error
      ↓
Retry
```

No communication with the real Stellar network occurs in this isolated tool.

---

# Running Tests

```bash
bun test tools/v2/team/stellar-team-payout-request/tests
```

Current tests cover:

- payout engine behavior
- security validation
- fixture validation
- local service behavior

Future UI tests can be added alongside the components introduced by this issue.

---

# Folder Structure

```text
tools/v2/team/stellar-team-payout-request/
├── components/
├── docs/
├── fixtures/
├── services/
├── tests/
├── types/
├── index.ts
├── README.md
└── specs.md
```

---

# Ownership Boundary

All work for this tool must remain inside:

```text
tools/v2/team/stellar-team-payout-request/
```

Do **not** modify:

- application routing
- dashboard
- authentication
- wallet core
- Stellar integration
- mail rendering
- database schema
- shared design system

unless explicitly permitted by a future integration issue.

---

# Follow-Up

> **Suggested follow-up issue:** Connect the local payout request UI to the real Stellar payout workflow, backend services, and application routing once integration work is approved.

---

# Contributor Notes

This issue implements only the isolated UI surface and accessibility behavior.

Reviewers should verify that:

- all implementation remains inside `tools/v2/team/stellar-team-payout-request/`
- keyboard navigation functions correctly
- labels and accessibility semantics are present
- empty, loading, error, and success states are implemented
- no integration with the main application has been introduced

Future routing, backend integration, Stellar transaction submission, authentication, and persistence should be completed in separate issues.
