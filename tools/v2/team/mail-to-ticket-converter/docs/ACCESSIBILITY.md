# Mail-to-Ticket Converter Accessibility Notes

This UI is not mounted into the main app. It is a folder-local review surface for future mail-to-ticket work.

## Screen Reader Support

- Loading and empty states use `role="status"` with polite live regions.
- Error state uses `role="alert"` with an assertive live region.
- The draft count is exposed through a status region when success data is available.
- Draft list and detail areas are labeled so users can understand the queue/detail relationship.

## Keyboard Support

- Draft selection, retry, create, context request, and dismiss actions are native buttons.
- Buttons keep visible `focus-visible` rings.
- The action cluster uses `role="group"` with a draft-specific label.
- The selected draft is exposed with `aria-current`.

## Integration Boundary

- No route, dashboard, inbox, auth, wallet, database, mail rendering, ticket provider, notification, or design-system integration is included.
- Future integration should preserve the same labels, focus behavior, and state announcements.
