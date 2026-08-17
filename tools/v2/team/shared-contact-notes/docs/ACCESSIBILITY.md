# Shared Contact Notes — Accessibility

This document covers the WCAG 2.1 AA accessibility measures implemented in the Shared Contact Notes UI layer.

## Component Accessibility

### SharedContactNotes (Main Container)

- Semantic HTML: `<header>`, `<main role="main">`
- Page-level `<h1>` heading for screen reader context
- Descriptive subtitle provides context for assistive technology

### ContactNotesEmptyState

- `role="status"` announces empty state to screen readers
- `aria-live="polite"` ensures announcement without interruption
- `aria-label` provides clear context
- Icon uses `aria-hidden="true"` (decorative only)
- Button has explicit `aria-label`

### ContactNotesLoadingState

- `role="status"` + `aria-busy="true"` indicates loading in progress
- `aria-label` describes what is loading
- Skeleton placeholders provide visual progress indication
- Announcement text ("Loading notes...") for screen readers

### ContactNotesErrorState

- `role="alert"` immediately announces error to screen readers
- `Alert` component with `variant="destructive"` for visual distinction
- Descriptive error message for troubleshooting
- Retry button with `aria-label` for clear action

### ContactNotesList

- Semantic `<ul>` / `<li>` structure for list navigation
- `aria-label="Active notes"` / `aria-label="Archived notes"` sections
- Active and archived notes visually separated with headings and borders
- Summary display showing total note count
- "Add Note" button with accessible label

### ContactNoteEntry

- `<article>` role for each note card
- `aria-label` on article includes truncated content preview
- Icon-only buttons have `aria-label` for screen readers
- Action buttons: Edit, Archive, Delete — each with context-specific labels
- Color alone is not used for critical information (text labels accompany badges)
- Archived notes have reduced opacity + "Archived" badge for visual distinction

### ContactNoteForm

- `<label htmlFor="note-content">` properly associates label with textarea
- `aria-invalid` indicates validation errors
- `aria-describedby` links error message to input
- `role="alert"` on dynamic error messages
- Auto-focus on textarea for keyboard efficiency
- Submit/Cancel buttons with clear labels
- Disabled state on submit button prevents invalid submission
- `aria-label` on form provides context

## Keyboard Navigation

| Key           | Action                                |
| ------------- | ------------------------------------- |
| Tab           | Navigate between interactive elements |
| Enter / Space | Activate buttons                      |
| Escape        | Cancel form editing                   |

## Focus Management

- Textarea auto-focuses when form opens
- Focus remains within active view
- Interactive elements have visible focus rings (`focus-within:ring-2`, `focus:ring-2`)
- All interactive elements are keyboard accessible (native `<button>` elements)

## Color and Contrast

- Text colors use `text-slate-900` (headings), `text-slate-600` (body), `text-slate-500` (metadata)
- Backgrounds use `bg-white`, `bg-slate-50` for sufficient contrast
- Interactive states use blue (`text-blue-600`, `hover:text-blue-600`)
- Destructive actions use red (`hover:text-red-600`)
- Warning/caution actions use amber (`hover:text-amber-600`)
- No information conveyed by color alone

## Screen Reader Behavior

- Loading state: "Loading contact notes" + skeleton placeholders
- Empty state: "No shared notes" with guidance text
- Error state: "Failed to load contact notes" + error details
- Success: "Notes (count)" + "Active" / "Archived" section announcements
- Form submission: loading state announced via button text change to "Saving..."
