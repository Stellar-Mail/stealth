# UI and Accessibility

Folder-local UI surface for the Meeting Assignment Tool. Everything here lives
inside `tools/v2/team/meeting-assignment-tool/` and is not mounted in the main
app, router, or shared design system.

## Components

| Component                          | Responsibility                                                    |
| :--------------------------------- | :---------------------------------------------------------------- |
| `MeetingAssignmentPanel`           | Container that drives the workflow and renders the correct state. |
| `LoadingState`                     | Busy indicator shown while assignments are computed.              |
| `ErrorState`                       | Failure message with a retry action.                              |
| `EmptyState`                       | Shown when there are no meetings to assign.                       |
| `AssignmentSummaryCard`            | Totals: assigned, unassigned, and coverage percentage.            |
| `AssignmentList` / `AssignmentRow` | The per-meeting assignment results.                               |

The panel is powered by the `useMeetingAssignments` hook, which wraps the
existing `createMeetingAssignmentService` and exposes a
`LoadState<AssignmentResult>` plus a `reload` callback.

## States

- Loading: `LoadingState` with `role="status"` and `aria-live="polite"`.
- Error: `ErrorState` with `role="alert"` and a retry button.
- Empty: `EmptyState` when `assignments.length === 0`.
- Success: summary card plus the assignment list.

## Accessibility

- The panel is a labeled `section` (`aria-labelledby`) with a single `h2`.
- Status and error surfaces use `role="status"` / `role="alert"` with
  `aria-live` so screen readers announce transitions.
- The decorative spinner is marked `aria-hidden="true"`.
- All interactive controls are native `button` elements with visible text
  labels and a visible focus ring (`focus:ring-2 focus:ring-offset-2`), so they
  are reachable and operable by keyboard.
- The Reassign control is disabled while loading to prevent duplicate runs.
- Results use a real list (`ul` / `li`) and a description list (`dl` / `dt` /
  `dd`) for the summary, giving assistive technology meaningful structure.

## Visual style

- Layout uses Tailwind utility classes only; no shared design-system components
  are imported.
- Neutral gray surfaces, green for assigned/success, amber for unassigned, and
  red for errors.
- Spacing and rounded corners follow the utility scale already used across the
  tools workspace, so the surface stays consistent without changing global
  tokens.
