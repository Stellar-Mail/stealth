# Team Calendar Extraction - Specifications

## Purpose

Provide team members with a dedicated, accessible interface for extracting calendar events from team communications. This is a **standalone V2 tool** with no dependencies on the main app.

## Scope

- **Release Tier**: V2 (Later Release Tool)
- **Audience**: Team
- **Folder Ownership**: `tools/v2/team/team-calendar-extraction/`
- **Status**: UI implementation (event list, extraction form, states)

## Accessibility Requirements ✅

All deliverables must include accessibility features:

### Keyboard Navigation

- Full keyboard support: Tab, Shift+Tab, Arrow keys, Enter, Escape
- All interactive elements accessible without mouse
- Logical tab order matching visual flow
- Keyboard shortcuts documented for power users

### Screen Reader Support

- Semantic HTML structure (form, fieldset, legend, details, summary)
- Proper ARIA labels and descriptions
- Live regions for status updates (loading, errors, success)
- Clear heading hierarchy
- Status indicators conveyed beyond color

### Visual Accessibility

- Clear, visible focus indicators
- WCAG AA contrast ratios (4.5:1 normal, 3:1 large text)
- Color not the only way to convey information
- Respects `prefers-reduced-motion` setting

**Documentation**: See `docs/ACCESSIBILITY.md`

## Visual Design Requirements ✅

Implement custom styling without modifying the shared design system:

- Status badges with semantic colors and text labels
- Priority indicators (low/normal/high/urgent)
- Category badges with distinct colors
- Responsive layout (mobile, tablet, desktop)
- Dark mode support
- Form fields with proper labels and help text
- Clear error messages and success confirmations

**Documentation**: See `docs/VISUAL_STYLE.md`

## UI States Required ✅

Implement all user-facing states:

- **Empty State**: No calendar events available
- **Loading State**: Extracting events from source
- **Error State**: Failed to extract or load events
- **Success State**: Confirmation after successful extraction
- **List View**: Browse extracted events
- **Detail View**: View event details and metadata
- **Extraction Form**: Initiate new extraction with source selection

## Component Structure ✅

```
components/
├── event-list.tsx                   # Sortable event list
├── extraction-form.tsx              # Extraction initiation form
├── empty-state.tsx                  # No events state
├── loading-state.tsx                # Loading state
├── error-state.tsx                  # Error state
├── success-state.tsx                # Success confirmation
├── team-calendar-extraction-tool.tsx # Main container
└── index.ts
```

## Local-Only Architecture

This tool operates independently:

- ✅ Local data services (no database required)
- ✅ Mock fixtures for testing
- ✅ Local extraction simulation
- ✅ In-memory storage for events and extractions

Does NOT depend on:

- ❌ Main app routing
- ❌ Authentication system
- ❌ Wallet core
- ❌ Stellar integration
- ❌ Inbox architecture
- ❌ Database schema

## Issue Categories

Contributions to this tool should include one or more of these categories:

### 🏗️ Architecture

- Folder structure and organization
- Service design
- Hook patterns
- Type definitions

### ✨ Feature

- New extraction workflow
- Filtering or sorting
- Event management
- State management

### 🎨 UI and Accessibility

- Component implementation
- Accessible keyboard navigation
- Screen reader support
- Visual design
- Dark mode
- Responsive layout
- Focus management

### 🔒 Security and Performance

- Input validation
- Data sanitization
- Performance optimization
- Memory leaks
- Error handling

### 🧪 Testing and Documentation

- Unit tests
- Integration tests
- E2E tests
- Test fixtures
- Documentation updates
- Accessibility testing guide

## Acceptance Criteria

- [x] UI isolated to `tools/v2/team/team-calendar-extraction/` folder
- [x] Interactive controls have labels, focus behavior, keyboard support
- [x] Visual style documented without changing shared design system
- [x] All user-facing states implemented (empty, loading, error, success)
- [x] Folder-local components, hooks, services, fixtures
- [x] Keyboard navigation fully implemented
- [x] Screen reader compatible
- [x] Focus indicators visible and logical
- [x] WCAG AA contrast compliant
- [x] Dark mode support
- [x] Responsive layout
- [x] Error messages clear and helpful
- [x] No modifications to main app shell, routing, or core systems

## Files Changed Scope

Only files within `tools/v2/team/team-calendar-extraction/` should be modified:

✅ Do modify:

- `components/`
- `hooks/`
- `services/`
- `types/`
- `fixtures/`
- `tests/`
- `docs/`
- README.md
- specs.md
- styles.css (if added)

❌ Do NOT modify:

- `src/` (main app code)
- `src/features/design-system/`
- `src/routes/`
- `src/server/`
- Package.json (use existing dependencies)
- tsconfig.json
- vite.config.ts

## Reviewer Checklist

When reviewing contributions:

- [ ] Changes only in `tools/v2/team/team-calendar-extraction/`
- [ ] Keyboard navigation working (Tab, Arrow, Enter, Escape)
- [ ] Screen reader test passed (NVDA, VoiceOver, or Orca)
- [ ] Focus indicators visible on all interactive elements
- [ ] Color contrast meets WCAG AA (use tool: https://webaim.org/resources/contrastchecker/)
- [ ] No console errors or warnings
- [ ] Documentation updated (README, ACCESSIBILITY, VISUAL_STYLE)
- [ ] Mock fixtures included for new features
- [ ] Responsive design tested on mobile/tablet/desktop
- [ ] Dark mode tested
- [ ] Error states provide clear guidance
- [ ] No main app integration attempted

## Next Steps

### Phase 1: UI Components ✅ (This Issue)

- Folder-local components with accessibility
- Empty, loading, error, success states
- Keyboard and screen reader support

### Phase 2: Testing & Documentation (Future)

- Unit tests
- E2E tests with Playwright
- Additional documentation

### Phase 3: Integration (Future)

- Separate issue for main app routing
- Separate issue for data persistence
- Separate issue for authentication connection

---

**All work is self-contained. Do not attempt main app integration in this issue.**
