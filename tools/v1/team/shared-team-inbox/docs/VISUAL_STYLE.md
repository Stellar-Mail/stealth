# Shared Team Inbox Visual Style

## Principles

- Keep the UI quiet and operational: dense enough for triage, but with clear ownership and status cues.
- Do not change the shared design system, application shell, navigation, or global styles.
- Use folder-local components that can be reviewed as a mini-product before integration.

## Layout

- The primary view is a constrained single-column work surface with summary metrics, filters, and message cards.
- Cards use an 8px radius, subtle borders, and `focus-within` states for keyboard context.
- Actions stay grouped on the right on large screens and stack under message content on narrow screens.

## Status Treatment

- Every status has both text and color treatment.
- Colors are semantic and balanced: slate for unassigned, sky for claimed, violet for in progress, amber for awaiting reply, and emerald for resolved.
- Counts are shown above the queue so reviewers can scan workload distribution without opening a message.

## Responsive Behavior

- Summary metrics move from six columns on desktop to three columns on tablet and one column on narrow screens.
- Filters wrap instead of shrinking labels.
- Message metadata uses two columns when space allows and a single column on mobile.

## States

- Empty state explains that the selected filter has no messages.
- Loading state uses simple skeleton bars and does not require animation.
- Error state uses a retry button with a clear accessible label.
- Success state is dismissible and announced politely to assistive technology.
