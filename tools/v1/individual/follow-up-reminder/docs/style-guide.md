# Follow-up Reminder -- UI Style Guide

This document describes the visual style and accessibility conventions used by
the folder-local UI components. It does not modify or depend on the shared
design system in `src/features/design-system/`.

## Colour Palette

All colours are applied via Tailwind utility classes.

| Token            | Usage                               | Tailwind Class                                  |
| ---------------- | ----------------------------------- | ----------------------------------------------- |
| Background       | Card / surface backgrounds          | `bg-white`, `bg-gray-50`                        |
| Foreground       | Primary text                        | `text-gray-800`, `text-gray-900`                |
| Muted            | Secondary / description text        | `text-gray-500`                                 |
| Border           | Card borders                        | `border-gray-100`, `border-indigo-200`          |
| Primary (indigo) | Interactive controls, branding      | `text-indigo-600`, `bg-indigo-600`              |
| Success (green)  | Complete, positive state            | `text-green-500`, `bg-green-50`, `bg-green-600` |
| Warning (amber)  | Alerts, warnings, medium confidence | `text-amber-700`, `bg-amber-50`, `bg-amber-500` |
| Error (red)      | Errors, destructive actions         | `text-red-500`, `bg-red-50`, `bg-red-600`       |
| Neutral (gray)   | Low confidence, secondary actions   | `text-gray-400`, `bg-gray-50`                   |

## Typography

- **Headings:** `text-2xl font-semibold` (`h2`), `text-lg font-medium` (`h3`)
- **Body:** `text-sm` (`p`), `text-xs` (metadata, secondary info)
- **Labels/Badges:** `text-xs font-semibold`
- **Monospace:** `font-mono text-xs` for state labels

Font family is inherited from the host environment (no local override).

## Component Sizing

- **Card container:** `p-6 border rounded-xl max-w-3xl mx-auto`
- **Content area:** `min-h-[300px]` with `p-4`
- **Reminder cards:** `p-5 border rounded-lg`
- **Buttons:** `px-4 py-2` (toolbar), `px-3 py-1.5` (card actions)
- **Badges / tags:** `px-2.5 py-0.5 rounded-full` (confidence), `px-2 py-0.5 rounded` (signal tags)

## Spacing

- **Section gap:** `mb-6` (between header/content), `mb-4` (between card sections)
- **Button gap:** `gap-2` (toolbar), `gap-2` (action groups)
- **List gap:** `space-y-3` (reminder list), `space-y-4` (card content)

## Focus & Keyboard

All interactive elements follow these conventions:

| Element         | Focus Style                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| Toolbar buttons | `focus:outline-none focus:ring-2 focus:ring-{color}-500 focus:ring-offset-2` |
| Card actions    | Same as above, with `focus:ring-offset-1`                                    |
| Card container  | `focus-within:ring-2 focus-within:ring-indigo-500`                           |
| Date input      | `focus:outline-none focus:ring-2 focus:ring-indigo-500`                      |
| Tab order       | Native DOM order (left-to-right, top-to-bottom)                              |

### Keyboard interactions

- **Enter / Space:** Activates buttons (native browser behavior)
- **Escape:** Cancels inline date editing
- **Tab:** Moves focus through interactive controls in document order

## Accessibility Patterns

| Pattern              | Implementation                                              |
| -------------------- | ----------------------------------------------------------- |
| Landmark region      | `role="region"` + `aria-labelledby` on root container       |
| Live region          | `aria-live="polite"` + `aria-atomic="true"` on content area |
| Loading indicator    | `role="status"` + `aria-busy="true"` + `aria-label`         |
| Error announcement   | `role="alert"` on error container                           |
| Empty state          | `role="status"` with `aria-live="polite"`                   |
| Button groups        | `role="group"` + `aria-label` for action clusters           |
| Toggle buttons       | `aria-pressed` for state control buttons                    |
| Icon decoration      | `aria-hidden="true"` on all decorative SVGs                 |
| List semantics       | `<ul>` + `aria-label` + `<li>` for reminder list            |
| Signal list          | `role="list"` + `aria-label` + `role="listitem"`            |
| Inline editing       | `autoFocus` on input, Escape to cancel, Enter to save       |
| Screen-reader labels | `aria-label` on all icon-only or ambiguous controls         |

## Animation & Transition

- **Spinner:** `animate-spin` (CSS rotation, 1s linear infinite)
- **State transitions:** No animations -- content updates immediately. The
  `aria-live` region handles screen-reader announcement.
- **Button hover:** `transition-colors` for smooth colour transitions
- **Card hover:** `hover:border-{color}-300` with `transition-all`

## Responsive Behaviour

- **Max width:** `max-w-3xl` (768px) for readability
- **Flex wrapping:** `flex-wrap` on button groups to handle narrow viewports
- **Cards:** Full width within the container; no multi-column layout

## Icons

All icons are inline SVGs with `aria-hidden="true"`. No external icon library
is imported. Icons used:

- **Bell (reminder):** General tool and idle state icon
- **Checkmark:** Empty state success indicator
- **Alert triangle:** Error and warning states
- **Calendar:** Due date display
- **Info circle:** Warning details
- **Spinner:** Loading indicator (`border-* + animate-spin`)
