# Team Calendar Extraction — Visual Style and Accessibility

This document describes the visual design and accessibility decisions for the Team Calendar Extraction tool UI. The UI is isolated to this tool folder and does not depend on or modify the shared design system.

## Visual design

### Color palette

The UI uses a dark theme built on Tailwind CSS zinc/gray tones with accent colors for interactive elements and status indicators. All colors are applied through Tailwind utility classes scoped to the component tree — no global CSS or design tokens are modified.

| Element          | Tailwind classes                            | Purpose                                    |
| ---------------- | ------------------------------------------- | ------------------------------------------ |
| Background       | `bg-zinc-950/40`                            | Main section background with backdrop blur |
| Borders          | `border-zinc-800/80`                        | Card borders and dividers                  |
| Accent (primary) | `bg-sky-600 hover:bg-sky-500`               | Primary action buttons                     |
| Success          | `text-emerald-400`, `border-emerald-500/30` | Event validation, safe indicators          |
| Warning/Error    | `text-rose-400`, `bg-rose-500/5`            | Error alerts, blocked entries              |
| Text primary     | `text-zinc-100`                             | Headings and emphasis                      |
| Text muted       | `text-zinc-400`, `text-muted-foreground`    | Descriptions and secondary info            |
| Gradient heading | `from-sky-400 via-indigo-400 to-purple-400` | Tool title decoration                      |

### Typography

- **Headings**: Bold, uppercase tracking for section headings; gradient text for the main title.
- **Body**: Small (`text-xs`, `text-sm`) sans-serif for space efficiency.
- **Code/log output**: Monospace (`font-mono`) for the processing log and event descriptions.
- **Line clamping**: Event descriptions are clamped to 3 lines (`line-clamp-3`) with full content available via the `title` attribute.

### Spacing and layout

- The tool is centered in a `max-w-6xl` container with `px-4` horizontal padding.
- Sections are separated by `space-y-8` vertical rhythm.
- Cards use `p-5` or `p-6` padding with `rounded-xl` or `rounded-2xl` corners.
- The control panel uses a 2-column grid on medium screens (`md:grid-cols-2`) that collapses to single column on small screens.
- Event cards use a 2-column grid on medium screens (`md:grid-cols-2`).

## Component states

### Empty state

- **When**: No extraction has been run, or the `clear()` action has been called.
- **Visual**: Dashed border container with calendar emoji and "No events successfully extracted yet." text.
- **Behavior**: Focusable programmatically; receives focus when the tool resets.

### Loading state

- **When**: An extraction or ICS parse is in progress.
- **Visual**: Spinning border animation (`animate-spin`) with "Scanning content and executing threat-guards..." text.
- **Screen reader**: `role="status"` with `aria-live="polite"` announces the loading text.
- **Focus**: Focus moves to the loading region when processing starts.

### Success state

- **When**: Events have been successfully extracted and validated.
- **Visual**: Event cards displayed in a responsive grid with title, date/time, location, host, description, and attendees. A "Verified Safe" badge appears next to the section heading. Performance telemetry shows extracted counts.
- **Focus**: Focus moves to the event list heading when results arrive.

### Error state

- **When**: Extraction encounters warnings, parsing errors, or security rejections.
- **Visual**: A "Rejected / Blocked Entries" alert box appears with error details. The safety scanner badge displays the warning count.
- **Screen reader**: `role="alert"` with `aria-live="assertive"` immediately announces errors.
- **Focus**: Focus moves to the error region when errors are reported.

## Accessibility decisions

### Keyboard navigation

- All interactive controls are native HTML elements (`button`, `textarea`) that are keyboard accessible by default.
- Buttons are properly disabled during processing via the `disabled` attribute, preventing accidental activation.
- The custom ICS textarea has an associated `<label>` with `htmlFor` for keyboard and screen reader identification.

### Focus management

- **Loading → Success**: Focus moves to the event list heading so screen reader users hear the result count.
- **Loading → Error**: Focus moves to the error region containing the StatusIndicators component.
- **Idle → Loading**: Focus moves to the loading spinner status region.
- All focusable regions use `tabIndex={-1}` so they can receive programmatic focus without appearing in the natural tab order.

### ARIA roles and properties

- The root section uses `aria-labelledby` (pointing to the heading) and `aria-busy` (set during processing).
- Control panel groupings use `role="region"` with `aria-label` for screen reader navigation.
- The loading indicator uses `role="status"` with `aria-live="polite"`.
- The error alert uses `role="alert"` with `aria-live="assertive"` for immediate announcement.
- The processing log uses `role="log"` with `aria-live="polite"` for live region updates.
- Emoji icons use `aria-hidden="true"` to prevent screen reader duplication, except for the empty-state calendar emoji which uses `role="img"` with `aria-label`.
- Event list items use semantic `<ul>`/`<li>` structure.

### Screen reader considerations

- The "Reset Tool" button has an explicit `aria-label` for clarity.
- Feed and attack simulation buttons have `aria-label` descriptions of their function.
- The event list heading is visually hidden (`sr-only`) when the parent manages its own heading, avoiding duplicate announcements.
- Status messages in the log use a `>` prefix that is hidden from screen readers (`aria-hidden="true"`) to avoid reading punctuation.

## Isolation

All styling is expressed exclusively through local, namespaced Tailwind utility classes. No shared design-system tokens, themes, or global styles are modified. A host application that later integrates this tool can provide its own Tailwind theme or override individual classes.
