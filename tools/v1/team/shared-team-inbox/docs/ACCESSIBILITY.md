# Shared Team Inbox Accessibility Notes

## Keyboard Operation

- The status filter uses native radio inputs so arrow-key and Tab behavior follows browser defaults.
- Message actions are native buttons with visible `focus-visible` rings.
- Each message card uses `focus-within` styling so keyboard users can keep context while moving across action buttons.
- The tab order follows the reading order: heading, filters, message content, then message actions.

## Screen Reader Support

- The tool has a single `main` landmark labelled by the page heading.
- Loading and success states use polite live regions; the error state uses `role="alert"`.
- Status badges include accessible labels, and the visible text repeats the state so color is not the only cue.
- Message lists use `role="list"` and `role="listitem"` because the card layout is not a native list element.
- Action groups are labelled with the message subject so repeated buttons such as Claim, Open, and Reply stay distinguishable.

## Follow-up Integration Notes

- If this UI is mounted in the main app later, the integration should move focus to the top-level heading when opening the tool route.
- If bulk assignment is added later, use a native checkbox table or an ARIA grid pattern with documented keyboard behavior.
