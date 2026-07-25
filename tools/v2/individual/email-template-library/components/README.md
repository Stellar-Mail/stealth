# Email Template Library Components

This directory contains the UI components for the Email Template Library tool.
All components are isolated to this tool folder and do not modify the main
application shell, routing, or design system.

## Component Overview

### EmailTemplateLibraryTool

**Main component** that orchestrates the entire template library workflow.

**Features:**

- Three view modes: list, preview, and render
- Category-based filtering
- Template selection and navigation
- Integration with template service layer

**Props:**

- `templates?: EmailTemplate[]` - Array of available templates
- `errorMessage?: string` - Error message to display in error state
- `initialState?: 'loading' | 'error' | 'ready'` - Initial view state
- `onRenderTemplate?: (templateId: string, values: Record<string, string>) => void` - Callback for template rendering
- `renderResult?: RenderTemplateResult` - Rendered template output to display

**Usage:**

```tsx
<EmailTemplateLibraryTool
  templates={templates}
  onRenderTemplate={handleRender}
  renderResult={result}
/>
```

### State Components

#### EmailTemplateLibraryEmptyState

Displays when no templates are available or match current filters.

**Accessibility:**

- Uses `role="status"` for screen reader announcements
- Supports optional action button for user guidance

#### EmailTemplateLibraryLoadingState

Shows loading skeleton during async operations.

**Accessibility:**

- Uses `role="status"`, `aria-live="polite"`, and `aria-busy="true"`
- Provides screen reader-only text explaining loading state
- Visual skeleton provides context for sighted users

#### EmailTemplateLibraryErrorState

Displays error messages with optional retry action.

**Accessibility:**

- Uses `role="alert"` for immediate screen reader announcement
- Includes optional retry button with clear focus indicators

### Content Components

#### TemplateCard

Renders a single template as a selectable card in the list view.

**Features:**

- Displays template name, subject preview, category badge
- Shows variable chips for quick reference
- Interactive when `onSelect` callback is provided

**Accessibility:**

- Switches between `role="button"` (selectable) and `role="article"` (read-only)
- Supports keyboard navigation (Enter and Space keys)
- Uses `aria-labelledby` for proper screen reader identification
- Visual selection state combined with border changes (not color-only)

#### TemplatePreview

Shows detailed view of a single template including subject, body, and variables.

**Features:**

- Full template content display
- Formatted variable list with keys and labels
- Category information

**Accessibility:**

- Semantic HTML with proper heading hierarchy
- Monospace font for code-like content (template syntax)
- Definition list (`<dl>`) for variable key-value pairs

#### TemplateRenderForm

Interactive form for filling template variables and generating output.

**Features:**

- Dynamic form generation based on template variables
- Real-time validation (all fields required)
- Inline display of rendered output
- Submit button disabled until form is complete

**Accessibility:**

- All inputs have explicit `<label>` elements with `htmlFor` attributes
- Required fields marked with `aria-required="true"`
- Submit button state reflects form validity
- Rendered output uses `aria-live="polite"` for announcements
- Clear focus indicators on all interactive elements

## Styling Approach

All components use Tailwind utility classes following these principles:

1. **No global design system modifications** - Components are styled independently
2. **Consistent color palette** - Slate neutrals, blue for info, red for errors
3. **Accessibility-first** - WCAG AA contrast ratios, focus-visible outlines
4. **Responsive design** - Mobile-first with responsive breakpoints
5. **Motion sensitivity** - Minimal animation, no critical information depends on motion

See `docs/VISUAL_STYLE.md` for detailed styling guidelines.

## Accessibility

All components follow WCAG 2.1 Level AA standards:

- **Keyboard navigation** - All interactive elements are keyboard accessible
- **Screen reader support** - Proper ARIA roles, labels, and live regions
- **Focus management** - Clear focus indicators on all interactive elements
- **Color independence** - Status never conveyed by color alone
- **Form validation** - Clear error messages and field requirements

See `docs/ACCESSIBILITY.md` for detailed accessibility guidelines and testing checklist.

## Testing

Components are tested using:

- **Vitest** for unit tests
- **React Testing Library** for component tests
- **User Event** for interaction simulation

Test files are located in `../tests/` directory.

Run tests:

```bash
npm test
```

## Component Architecture

```
EmailTemplateLibraryTool (Orchestrator)
├── State Management (loading, error, ready)
├── View Mode Management (list, preview, render)
└── View Rendering
    ├── List Mode
    │   ├── Category Filters
    │   └── TemplateCard[] (interactive list)
    ├── Preview Mode
    │   └── TemplatePreview (read-only detail)
    └── Render Mode
        └── TemplateRenderForm (interactive form)
```

## Integration Guidelines

These components are **isolated** and **not mounted** in the main application.
They are designed as a complete, self-contained mini-product that can be
integrated in a future release.

**Current scope:**

- ✅ Build complete UI workflow
- ✅ Implement accessibility features
- ✅ Create comprehensive tests
- ✅ Document visual style

**Future integration (out of scope for this issue):**

- ❌ Wire into main app routing
- ❌ Connect to production data sources
- ❌ Integrate with authentication
- ❌ Add to main navigation

## Files Changed

All files in this issue are limited to:

```
tools/v2/individual/email-template-library/
├── components/
│   ├── EmailTemplateLibraryTool.tsx
│   ├── EmailTemplateLibraryEmptyState.tsx
│   ├── EmailTemplateLibraryLoadingState.tsx
│   ├── EmailTemplateLibraryErrorState.tsx
│   ├── TemplateCard.tsx
│   ├── TemplatePreview.tsx
│   ├── TemplateRenderForm.tsx
│   ├── index.ts
│   └── README.md
├── docs/
│   ├── ACCESSIBILITY.md
│   └── VISUAL_STYLE.md
├── fixtures/
│   └── template-fixtures.ts
└── tests/
    ├── components.test.tsx
    └── template-fixtures.test.mjs
```
