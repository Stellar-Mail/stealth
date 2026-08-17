# Accessibility (a11y) Guidelines

## Overview

This document outlines the accessibility considerations built into the Manager Review Queue local UI components. The components have been designed to meet WCAG 2.1 AA standards, ensuring keyboard operability and screen reader compatibility.

## Screen Reader Support

- **ARIA Live Regions**: The `ErrorState` component uses `aria-live="assertive"` to announce critical errors immediately. The `LoadingState` and `SuccessState` components use `aria-live="polite"` to update users without interrupting their current flow.
- **Labels**: All interactive elements (buttons) have explicit `aria-label` attributes to ensure context (e.g., "Approve request [ID]" rather than just "Approve").
- **Landmarks**: The list of review items is contained within a `role="region"` with a clear `aria-label="Review Queue Items"`.
- **Hidden Text**: Loading states provide `.sr-only` text ("Please wait while we load the review items.") to explicitly describe the visual spinner.

## Keyboard Interaction

- **Focus Management**: All buttons are inherently focusable. Focus styles are prominently defined using Tailwind's `focus:ring-2`, `focus:ring-offset-2`, and `focus:outline-none` to guarantee high visibility.
- **Group Focus**: The `ReviewQueueItem` uses `focus-within:ring-2` to highlight the entire card when any button within it receives focus, making it easier for keyboard users to track their position in the queue.
- **Logical Tab Order**: The tab sequence follows the natural visual reading order: Title -> Submitter -> Action Buttons (Approve, Reject, Escalate).

## Future Considerations

- If bulk actions are introduced later, proper keyboard multi-selection patterns (Space/Enter to toggle) must be implemented with corresponding `aria-selected` states.
