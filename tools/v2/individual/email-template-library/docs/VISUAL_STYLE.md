# Visual Style

## Layout

The tool uses a constrained workspace panel with a compact header, optional
category filters, and a primary content area that switches between three view
modes: list (template cards), preview (single template details), and render
(form for variable substitution). Navigation between views is explicit via back
buttons and action buttons, maintaining clear user context.

## Color

- **Slate** is the neutral base for text, borders, backgrounds, and primary actions.
- **Blue** marks category badges and informational elements (blue-50 background,
  blue-700 text).
- **Red** marks error states (red-50/red-200 backgrounds, red-700/red-900 text).
- **White** is used for card backgrounds and form elements against the slate-50
  workspace background.

Color is always paired with visible text labels, icons, or other non-color
indicators so status never depends on hue alone.

## Components

### Template Cards

- Use `8px` rounded corners (`rounded-lg`) with light borders (`border-slate-200`).
- Include an icon container on the left with semantic icons (FileText).
- Selected cards use darker borders (`border-slate-950`) and tinted backgrounds
  (`bg-slate-50`).
- Variable chips use monospace font (`font-mono`) with neutral backgrounds
  (`bg-slate-100`).
- Category badges use colored backgrounds (`bg-blue-50`) with icon and text.

### Preview Panel

- Uses similar card styling with a header section separated by a border.
- Displays subject and body in monospace code blocks (`font-mono`) with neutral
  backgrounds (`bg-slate-50`).
- Variables are shown as a definition list (`<dl>`) with key-value pairs.

### Render Form

- Uses standard form controls with consistent styling across inputs.
- Input borders use `border-slate-300` with `focus:border-slate-950` and
  `focus:ring-2` for clear focus states.
- Submit button spans full width for mobile-friendly interaction.
- Rendered output appears below the form with clear visual separation via
  top border.

### Buttons

- Primary actions use dark backgrounds (`bg-slate-950`) with white text.
- Secondary actions use white backgrounds with dark text and borders.
- All buttons include icon and text labels for clarity.
- Disabled states use reduced opacity (`opacity-50`) and `cursor-not-allowed`.

### State Components

- Empty states center content with large decorative icons (`size-14`).
- Loading states use pulse animations on skeleton elements.
- Error states use alert-style layouts with prominent error icons.

## Typography

- **Headers**: `text-2xl font-semibold` for main tool title, `text-lg font-semibold`
  for section headers.
- **Body**: `text-sm` for most content with `leading-6` for paragraph line height.
- **Labels**: `text-sm font-medium` for form labels and section titles.
- **Monospace**: `font-mono` for variable keys, template content, and code blocks.
- **Uppercase**: `uppercase tracking-wide` for tool tier designation.

## Motion

- Transitions use `transition-colors` for hover and focus states (default timing).
- Loading skeletons use `animate-pulse` for subtle loading indication.
- No critical information depends on animation or motion.
- Motion is kept minimal to reduce distraction and maintain accessibility.

## Responsive Behaviour

- The main container uses `max-w-5xl` constraint with responsive padding (`p-4 md:p-6`).
- Category filters stack vertically on narrow screens using `flex-col md:flex-row`.
- Template cards use flexible layouts that adapt to container width.
- Form inputs are full width (`w-full`) for mobile-friendly interaction.
- Text content uses `break-words` and `whitespace-pre-wrap` to prevent overflow.
- Multiple-column layouts collapse to single column below medium breakpoint.
- Touch targets maintain adequate size (minimum 44x44px equivalent) via padding.

## Icons

All icons are from `lucide-react` with consistent sizing:

- `size-4` (16px) for inline button icons
- `size-5` (20px) for card header icons
- `size-7` (28px) for empty state icons
- All decorative icons use `aria-hidden="true"`

## Spacing

- Card padding: `p-4` for compact cards, `p-6` for detail views
- Section gaps: `space-y-6` for major sections, `space-y-4` for related content
- Form field gaps: `space-y-4` for consistent vertical rhythm
- Inline gaps: `gap-2`, `gap-3`, or `gap-4` depending on context
- Border radius: `rounded-md` (6px) for inputs and chips, `rounded-lg` (8px) for cards

## Contrast and Accessibility

- Text colors maintain WCAG AA contrast ratios:
  - `text-slate-950` on white backgrounds
  - `text-slate-600` for secondary text on white/light backgrounds
  - `text-white` on dark (`bg-slate-950`) backgrounds
- Focus indicators use `outline-2` with `outline-offset-2` for clear visibility
- Border weights use `border` (1px) consistently
- Shadow use is minimal: `shadow-sm` for subtle card elevation only
