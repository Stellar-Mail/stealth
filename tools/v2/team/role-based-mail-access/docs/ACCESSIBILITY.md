# Accessibility (a11y) Design - Role-Based Mail Access UI

The Role-Based Mail Access Control Plane has been constructed with strict adherence to access guidelines (WCAG 2.1 AA) and supports screen readers, high-contrast layouts, and keyboard operations.

---

## 1. WAI-ARIA Roles and Notifications

Assistive technologies receive immediate updates during layout status shifts:

- **Authorization Result Alerts**: Verification results are annotated with `role="alert"` and `aria-live="assertive"`. This guarantees screen readers instantly broadcast validation failure warnings or permission notifications.
- **Verification Loading Indicators**: Loader animations are annotated with `role="status"` and `aria-live="polite"` so screen readers acknowledge that an active verification transaction is underway without interrupting the user.
- **Grids and Tables**: The dynamic permission matrix table uses the `role="grid"` structure, with each configuration cell labelled explicitly (e.g. `aria-label="Allow write permission for role agent"`).

---

## 2. Keyboard & Focus Management

- **Visual Indicators**: Focused fields (inputs, selectors, checkboxes, buttons) are outlined using clear contrast boundaries.
- **Focused Warning Placement**: Validation warnings are mapped directly beneath the input field. Red error borders visually highlight which field caused the check failure.
- **Tabbing Flow**: Navigation order maps sequentially through:
  1. Top utility triggers (Threat Scan, Reset Logs).
  2. Sample request presets.
  3. Permission control checkboxes.
  4. Team and attachment limit bounds inputs.
  5. Verifier email/thread inputs and submit triggers.
  6. Historical logs.
- **Checkbox Support**: Spacebar key toggles permission switches.

---

## 3. High Contrast Theme Support

- **Base Colors**: A deep dark mode contrast (`bg-zinc-950` base, white text) keeps text readable.
- **Outcome Badges**:
  - **Granted Clearance**: Light emerald green text on dark emerald green background (`bg-emerald-500/10 text-emerald-400`).
  - **Denied Clearance**: Light amber warning text on dark amber background (`bg-amber-500/10 text-amber-400`).
  - **Payload Threat Blocked**: Bright red error text on dark red background (`bg-rose-500/10 text-rose-400`).
