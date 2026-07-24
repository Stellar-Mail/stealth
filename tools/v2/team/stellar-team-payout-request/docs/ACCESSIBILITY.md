# Accessibility

## Overview

The Stellar Team Payout Request tool follows an accessibility-first approach while remaining fully isolated from the main application.

## Supported States

- Empty
- Loading
- Error
- Success

## Keyboard Support

- Tab and Shift+Tab navigate interactive controls.
- Enter and Space activate buttons.
- Visible focus indicators are preserved.
- Forms use semantic labels.

## Screen Reader Support

- Loading uses `aria-busy="true"`.
- Error messages use `role="alert"`.
- Form controls are associated with labels.
- Section headings provide navigation landmarks.

## Focus Management

Interactive controls remain keyboard accessible and maintain logical tab order.

## Future Integration

If the tool is connected to the main application, focus should move to the first validation error after failed submission and to the confirmation message after successful request creation.
