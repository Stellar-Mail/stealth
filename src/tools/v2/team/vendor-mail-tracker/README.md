# Vendor Mail Tracker

> **V2 · Team tool · Release tier: later**
> Campaign labels: GrantFox OSS · Maybe Rewarded · Official Campaign · Tooling Ecosystem · V2 Later Tool · Team Tool

A self-contained tool for tracking vendor mail threads — contracts, invoices,
compliance exchanges, and escalations — in one organized surface.

---

## What this tool does

Teams often manage ongoing email correspondence with vendors (billing, legal,
infra) across different inboxes and people. This tracker gives a shared,
structured view of:

- **Vendor directory** — domain, contact, category, contract dates, monthly spend
- **Mail threads per vendor** — status, priority, follow-up dates, excerpts
- **Filtering + sorting** — by status, priority, category, or free-text search
- **Board view** — Kanban columns by thread status
- **Quick actions** — resolve threads, dismiss unread markers, add new records

---

## Isolation contract

**This tool does not touch the main application.**

All work is contained in:

```
src/tools/v2/team/vendor-mail-tracker/
```

Files outside this folder are read-only (design system tokens, motion
presets, `cn` utility). Nothing from this folder is imported by the main
app shell, routing system, dashboard, wallet, inbox, or Stellar integration.

The "Open in Mail" action in the detail panel is intentionally disabled.
Integration with the mail engine is a follow-up issue.

---

## Folder structure

```
vendor-mail-tracker/
├── index.ts                     # Public exports (VendorMailTracker, Preview)
├── VendorMailTracker.tsx         # Root component — do not mount in main app
├── VendorMailTrackerPreview.tsx  # Isolated dev harness
├── types.ts                     # All local type definitions
├── fixtures.ts                  # Static mock data (no live API calls)
├── VISUAL_STYLE.md               # Visual language reference
├── README.md                    # This file
├── hooks/
│   └── use-vendor-tracker.ts    # All state, filtering, sorting, actions
└── components/
    ├── status-badge.tsx          # Thread status, priority, vendor status pills
    ├── stats-bar.tsx             # Summary metric cards
    ├── filter-bar.tsx            # Search + filter controls + view toggle
    ├── thread-row.tsx            # Single thread row (list view)
    ├── thread-list.tsx           # Sortable list with empty/loading/error states
    ├── board-view.tsx            # Kanban board (grouped by status)
    ├── thread-detail.tsx         # Right panel — thread metadata + actions
    ├── vendor-sidebar.tsx        # Left panel — vendor list with unread counts
    ├── add-vendor-dialog.tsx     # Modal form for adding a vendor
    └── add-thread-dialog.tsx     # Modal form for logging a thread
```

---

## States implemented

| State | Where | Notes |
|-------|-------|-------|
| Empty (no threads) | `ThreadList`, `BoardView` columns | Descriptive message + clear-filters CTA |
| Empty (filtered) | `ThreadList` | Distinguishes "no data" from "filtered out" |
| Loading | `ThreadList`, `VendorSidebar`, `ThreadDetail` | Skeleton screens (aria-busy) |
| Error | `ThreadList` | Error message via role="alert" |
| Success (action feedback) | `FeedbackViewport` toast | Resolve, add vendor, add thread |
| No thread selected | `ThreadDetail` | Placeholder with instructions |

---

## Accessibility

Designed to WCAG 2.1 AA intent. See `VISUAL_STYLE.md` for detailed notes.

Key points:
- Skip-to-content link at top of `<main>`
- All interactive elements keyboard-reachable and labeled
- Focus rings via `.glow-ring` (project standard)
- Dialogs trap focus with `role="dialog" aria-modal`
- Status/priority conveyed via text, not color alone
- `aria-live` regions for list updates and action feedback
- Reduced motion honored via `motionPresets`

Full WCAG validation requires manual testing with screen readers.

---

## Development preview

This tool has no route in the main app yet. To preview during development:

1. Temporarily add an isolated route or import `VendorMailTrackerPreview`
   in a scratch file.
2. Run `npm run dev`.
3. Remove the temporary wiring after review.

Example ad-hoc mount:

```tsx
// Temporary dev-only file — do not commit
import { VendorMailTrackerPreview } from "@/tools/v2/team/vendor-mail-tracker";

export default function DevPreview() {
  return <VendorMailTrackerPreview />;
}
```

---

## Future integration (follow-up issue)

When the V3 integration issue is filed, it should:

1. Add a route in `src/routes/tools/vendor-mail-tracker.tsx`
2. Wire the "Open in Mail" action to the mail engine
3. Connect `addVendor` / `addThread` to a persistent data store
4. Add the tool to the main navigation (team tools section)
5. Sync vendor domains with the existing contacts/sender system

**Do not combine that work with this issue.**

---

## OSS contributor notes

- All changes for this feature stay inside `src/tools/v2/team/vendor-mail-tracker/`
- Fixtures are static — no backend required to review the UI
- Tests can be added as `*.test.tsx` in this folder without modifying the main test suite
- The `use-vendor-tracker.ts` hook is fully unit-testable in isolation
