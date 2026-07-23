# Email Translator — Visual Style Guide

## Overview

This document describes the visual design system used in the Email Translator tool. The styling follows the existing project patterns without modifying the shared design system.

---

## Color Palette

### Primary Colors

- **Text Primary:** `slate-950` - Main headings and important text
- **Text Secondary:** `slate-900` - Body text and labels
- **Text Tertiary:** `slate-700` - Supporting text
- **Text Muted:** `slate-600` - Descriptions and helper text
- **Text Disabled:** `slate-400` - Disabled state indicators

### Background Colors

- **Primary Background:** `white` - Main content areas
- **Secondary Background:** `slate-50` - Page background and secondary surfaces
- **Hover Background:** `slate-100` - Interactive element hover states

### Border Colors

- **Default Border:** `slate-200` - Standard borders and dividers
- **Focus Border:** `slate-300` - Input borders
- **Active Border:** `slate-950` - Selected/active states

### State Colors

#### Error

- **Background:** `red-50`
- **Border:** `red-200`
- **Text:** `red-700` / `red-800`
- **Icon:** `red-700`

#### Warning/Info

- **Background:** `amber-50`
- **Border:** `amber-200`
- **Text:** `amber-800`

#### Success

- **Background:** `blue-50`
- **Text:** `blue-800`
- **Icon:** `blue-600`

---

## Typography

### Headings

- **Main Title (h1):** `text-2xl font-semibold text-slate-950`
- **Section Heading (h2):** `text-xl font-semibold text-slate-950`
- **Subsection (h3):** `text-sm font-semibold text-slate-900`

### Body Text

- **Primary:** `text-sm text-slate-900`
- **Secondary:** `text-sm text-slate-600`
- **Helper Text:** `text-xs text-slate-600`
- **Label:** `text-sm font-medium text-slate-900`

### Special Text

- **Uppercase Label:** `text-sm font-medium uppercase tracking-wide text-slate-500`
- **Badge:** `text-xs font-medium`

---

## Layout and Spacing

### Container

- **Max Width:** `max-w-5xl` (80rem / 1280px)
- **Padding:** `p-4 md:p-6` (1rem mobile, 1.5rem desktop)
- **Margin:** `mx-auto` (centered)

### Card/Section

- **Border Radius:** `rounded-lg` (0.5rem)
- **Border:** `border border-slate-200`
- **Background:** `bg-white` or `bg-slate-50`
- **Padding:** `p-4` (1rem)

### Spacing Scale

- **Gap Small:** `gap-2` (0.5rem)
- **Gap Medium:** `gap-3` (0.75rem)
- **Gap Large:** `gap-6` (1.5rem)
- **Space Stack:** `space-y-6` (1.5rem vertical rhythm)

---

## Components

### Buttons

#### Primary Button

```
className="inline-flex items-center gap-2 rounded-md border border-slate-950 bg-slate-950 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
```

**Properties:**

- Background: `slate-950`
- Hover: `slate-800`
- Text: `white`
- Padding: `px-6 py-2`
- Border radius: `rounded-md`

#### Secondary Button

```
className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
```

**Properties:**

- Background: `white`
- Hover: `slate-50`
- Border: `slate-300`
- Text: `slate-900`
- Padding: `px-4 py-2`

### Input Fields

#### Text Input / Textarea

```
className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
```

**Properties:**

- Border: `slate-300`
- Padding: `px-4 py-3`
- Focus outline: `slate-950`, 2px width, 2px offset
- Placeholder: `slate-400`

#### Label

```
className="block text-sm font-medium text-slate-900 mb-2"
```

### Language Selector

#### Button

```
className="relative w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
```

#### Dropdown List

```
className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white py-1 shadow-lg"
```

#### List Item

```
// Default
className="relative cursor-pointer select-none px-4 py-2.5 pr-10 text-sm text-slate-700"

// Focused
className="bg-slate-100 text-slate-900"

// Selected
className="font-medium"
```

### State Cards

#### Empty State

- Icon container: `size-14 rounded-lg border border-slate-200 bg-slate-50 text-slate-700`
- Icon size: `size-7`
- Max width: `max-w-lg`
- Padding: `px-4 py-12`

#### Loading State

- Spinner: `size-10 animate-spin text-slate-700`
- Layout: Similar to empty state

#### Error State

- Icon container: `border-red-200 bg-red-50 text-red-700`
- Otherwise matches empty state structure

---

## Icons

### Source

- **Library:** `lucide-react`
- **Default Size:** `size-4` (1rem / 16px)
- **Large Icons:** `size-7` (1.75rem / 28px) for state containers
- **Small Icons:** `size-3.5` (0.875rem / 14px) for inline badges

### Usage

- Mark decorative icons with `aria-hidden="true"`
- Default color: Inherits from parent
- State icons: Match state color (e.g., `text-red-700` for errors)

### Common Icons

- **Languages:** Main tool icon (languages selection)
- **Copy:** Copy to clipboard action
- **Check:** Success confirmation
- **AlertCircle:** Error state
- **Loader2:** Loading spinner (with `animate-spin`)
- **ChevronDown:** Dropdown indicator
- **ArrowRight:** Direction indicator
- **Sparkles:** Detection badge

---

## Interactive States

### Focus

- **Outline:** `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950`
- Only shown on keyboard focus (`:focus-visible`)
- 2px outline with 2px offset for clarity

### Hover

- **Buttons:** Darker background
- **List Items:** `bg-slate-100`
- Smooth transition: `transition-colors`

### Disabled

- **Opacity:** `opacity-50`
- **Cursor:** `cursor-not-allowed`
- Applied to button and input elements

### Active/Selected

- **Background:** `bg-slate-950`
- **Text:** `text-white`
- **Border:** `border-slate-950`

---

## Responsive Breakpoints

### Mobile First Approach

- Base styles apply to mobile (< 768px)
- `md:` prefix for tablet and desktop (≥ 768px)

### Adjustments

- **Padding:** `p-4 md:p-6`
- **Layout:** `flex-col md:flex-row`
- **Gap:** `gap-2 md:gap-3`

---

## Animations and Transitions

### Transitions

- **Property:** `transition-colors`
- **Duration:** Default (150ms)
- **Timing:** ease-in-out

### Animations

- **Spinner:** `animate-spin` (continuous rotation)
- **Copy Success:** Timeout-based icon swap (2 seconds)

---

## Badges

### Detection Badge

```
className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800"
```

**Properties:**

- Background: `blue-50`
- Text: `blue-800`
- Padding: `px-2 py-1`
- Font size: `text-xs`

---

## Z-Index Layers

- **Dropdown:** `z-10`
- Other elements use natural stacking order

---

## Shadow Usage

### Dropdown

- **Shadow:** `shadow-lg`
- Used for language selector dropdown to create elevation

---

## Best Practices

1. **Consistency:** Follow existing component patterns from similar tools
2. **Accessibility:** Maintain WCAG AA contrast ratios (minimum 4.5:1 for text)
3. **Responsiveness:** Test at mobile (320px), tablet (768px), and desktop (1280px+)
4. **Performance:** Use Tailwind's utility classes for optimal CSS size
5. **Maintainability:** Keep styles in component files, not external stylesheets

---

## File Locations

All styling is inline within component files using Tailwind CSS utility classes:

- `components/EmailTranslatorTool.tsx`
- `components/LanguageSelector.tsx`
- `components/TranslationInput.tsx`
- `components/TranslationOutput.tsx`
- `components/EmailTranslator*State.tsx`

No external CSS files or design system modifications required.
