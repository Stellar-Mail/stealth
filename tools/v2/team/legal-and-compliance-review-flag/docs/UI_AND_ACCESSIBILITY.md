# UI and Accessibility

Folder-local UI surface for the Legal and Compliance Review Flag tool. Everything
here lives inside tools/v2/team/legal-and-compliance-review-flag/ and is not
mounted in the main app, router, or shared design system.

## Components

| Component       | Responsibility                                                             |
| :-------------- | :------------------------------------------------------------------------- |
| ReviewFlagPanel | Container that owns form state and renders the active submit state.        |
| ReviewFlagForm  | Accessible form for reviewer, target resource, reason, severity, evidence. |
| EmptyState      | Shown before any flag has been raised.                                     |
| LoadingState    | Busy indicator shown while a flag is being validated.                      |
| ErrorState      | Typed failure message (code, message, offending fields) with retry.        |
| SuccessState    | Confirmation with flag id, status, timestamp, and audit trail.             |

The panel is powered by the useReviewFlagForm hook, which wraps the existing
createReviewFlag contract with a folder-local in-memory dependency. There is no
network, storage, or main-app dependency; a future integration issue can swap in
a real ReviewFlagDependency.

## States

- Idle: EmptyState, shown before the first submission.
- Submitting: LoadingState with role status and aria-live polite.
- Error: ErrorState with role alert; surfaces the discriminated ReviewFlagError.
- Success: SuccessState with role status; shows the ReviewFlagResult.

## Accessibility

- The surface is a labeled section (aria-labelledby) with a single h2 heading.
- Every input and control has an associated label via htmlFor, plus native
  required semantics on the mandatory fields.
- The evidence field is described by a hint through aria-describedby.
- Status and error surfaces use role status / role alert with aria-live so screen
  readers announce transitions, and the live region wraps the result area.
- The decorative spinner is marked aria-hidden true.
- All controls are native form elements with visible text labels and a visible
  focus ring (focus:ring-2 focus:ring-offset-2), so they are reachable and
  operable by keyboard.
- Inputs and the submit button are disabled while a submission is in flight to
  prevent duplicate flags.

## Visual style

- Layout uses Tailwind utility classes only; no shared design-system components
  are imported and no global tokens are changed.
- Neutral gray surfaces, green for success, and red for errors.
- Spacing and rounded corners follow the utility scale already used across the
  tools workspace, so the surface stays consistent with the other tools.
