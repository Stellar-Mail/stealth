# Email Template Library Visual Style

## Principles

- Keep the experience utility-first: fast scanning, clear actions, and no marketing layout.
- Do not change the shared design system, app shell, navigation, routing, or global styles.
- Use folder-local components that can be reviewed before integration.

## Layout

- Summary metrics sit above the work area for quick library health scanning.
- Template cards use an 8px radius, subtle borders, and compact metadata.
- The preview panel sits beside the template list on desktop and stacks below it on narrow screens.

## State Treatment

- Empty state includes a clear create action.
- Loading state uses static skeleton bars and no required animation.
- Error state uses a retry button and alert semantics.
- Success state is dismissible and announced politely.

## Responsive Behavior

- Summary metrics collapse from four columns to two columns and then one column.
- Template card actions stack vertically on desktop side rails and wrap on smaller screens.
- Long template names, subjects, and previews stay inside the card flow.
