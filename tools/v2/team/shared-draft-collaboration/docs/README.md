# Shared Draft Collaboration - UI Implementation

## Overview

This folder contains the complete UI implementation for the Shared Draft Collaboration tool, including accessible components, local test fixtures, and documentation.

## Folder Structure

```
shared-draft-collaboration/
├── components/                      # React components
│   ├── SharedDraftCollaboration.tsx # Main app wrapper
│   ├── SharedDraftEmptyState.tsx    # Empty state
│   ├── SharedDraftLoadingState.tsx  # Loading state
│   ├── SharedDraftErrorState.tsx    # Error state
│   ├── SharedDraftList.tsx          # Success state (list view)
│   ├── SharedDraftEntry.tsx         # Individual draft item
│   └── index.ts                     # Export barrel file
├── docs/                            # Documentation
│   ├── ACCESSIBILITY.md             # WCAG 2.1 AA accessibility guide
│   └── README.md                    # This file
├── hooks/                           # Custom React hooks (placeholder for future)
├── tests/                           # Test files (placeholder for future)
└── fixtures/                        # Test data (placeholder for future)
```

## Features

### States Implemented

- ✅ **Empty State**: Guides user to create first draft
- ✅ **Loading State**: Shows skeleton loaders while fetching
- ✅ **Error State**: Displays error with retry action
- ✅ **Success State**: Shows list of shared drafts

### Accessibility

- ✅ WCAG 2.1 Level AA compliant
- ✅ Keyboard navigation throughout
- ✅ Screen reader optimized with semantic HTML and ARIA
- ✅ Focus indicators visible
- ✅ Color contrast meets standards
- ✅ Active state uses visual + text indicators
- ✅ See [ACCESSIBILITY.md](./docs/ACCESSIBILITY.md) for details

### Component Design

- Each component is self-contained and focused
- Uses shared UI component library from `src/components/ui/`
- Isolated to tool folder, not mounted in main app
- Responsive design for different screen sizes
- Light and dark mode ready (via Tailwind classes)

### Collaboration Features (UI Ready)

- Shows collaborator count per draft
- Displays active state with visual indicator
- Shows last modified timestamp
- Subject line for draft context
- Real-time indicators ready for future integration

## Using the Components

### Import and Use

```tsx
import { SharedDraftCollaboration } from "./components";

export function MyPage() {
  return <SharedDraftCollaboration />;
}
```

### Component Props

#### SharedDraftCollaboration

No props required. Manages its own state internally using local fixtures.

```tsx
<SharedDraftCollaboration />
```

#### SharedDraftList

- `drafts: SharedDraftData[]` - Array of drafts to display
- `onEdit: (id: string) => void` - Callback when opening draft
- `onCreateNew: () => void` - Callback when creating new draft

#### SharedDraftEntry

- `id: string` - Unique identifier
- `title: string` - Draft title
- `subject?: string` - Draft subject line
- `lastModified: string` - ISO date string
- `collaborators: number` - Number of collaborators
- `isActive?: boolean` - Whether draft is currently being edited
- `onEdit: (id: string) => void` - Edit callback

## Development

### Local Testing

The main `SharedDraftCollaboration` component includes local test fixtures:

```tsx
const fixtureDrafts: SharedDraftData[] = [
  {
    id: "1",
    title: "Q1 Team Updates",
    subject: "Monthly updates for leadership",
    lastModified: "2025-01-15T14:30:00Z",
    collaborators: 3,
    isActive: true,
  },
  // ... more drafts
];
```

### Adding State Handlers

To connect to real data in the future, modify the `useEffect` in `SharedDraftCollaboration.tsx`:

```tsx
useEffect(() => {
  // Replace fixture loading with API call
  fetchSharedDrafts().then((data) => {
    setDrafts(data);
    setState(data.length === 0 ? "empty" : "success");
  });
}, []);
```

### Real-Time Collaboration

When real-time collaboration is integrated:

```tsx
// Listen for changes to active draft
useEffect(() => {
  if (activeDraftId) {
    subscribeToChanges(activeDraftId, (update) => {
      // Update draft content
      // Announce changes to screen readers
    });
  }
}, [activeDraftId]);
```

## Accessibility Testing

For detailed accessibility testing instructions, see [ACCESSIBILITY.md](./docs/ACCESSIBILITY.md).

**Quick test:**

1. Navigate using only Tab key
2. Test with screen reader (NVDA, JAWS, VoiceOver)
3. Check focus indicators are visible
4. Verify all buttons have meaningful labels
5. Confirm active draft state is clear

## Integration Notes

⚠️ **Not currently mounted in main app** - This is intentional per V2 design.

When integration is needed in the future:

- Create a separate issue for app-level integration
- Do not modify main app shell, routing, or design system in this issue
- Import components from this folder as-is
- This folder remains the source of truth for the UI

## Collaboration Features (Ready for Integration)

The UI is designed to support:

- **Real-time editing**: Multiple users editing simultaneously
- **Collaborator presence**: Show who's editing
- **Live cursors**: Indicate where others are editing (accessibility-aware)
- **Change tracking**: Visual indicators for recent changes
- **Merge conflict resolution**: UI structure ready for merge dialogs

These features can be added without modifying component structure.

## Dependencies

- React 18+
- Tailwind CSS
- Lucide React (icons)
- Shared UI components from `src/components/ui/`

## Future Work

- [ ] Add unit tests for components
- [ ] Add Storybook stories for visual testing
- [ ] Add animation preferences support (prefers-reduced-motion)
- [ ] Add high-contrast mode support
- [ ] Add real-time collaboration hooks
- [ ] Add change history view
- [ ] Add permission/access control UI
- [ ] Add draft versioning UI
- [ ] Integration with main mail app (separate issue)

## Related Documentation

- [Accessibility Guidelines](./docs/ACCESSIBILITY.md)
- Main tools README: `tools/v2/team/README.md`
- Similar tool: `tools/v2/team/suspicious-sender-watchlist/` for component patterns

## Questions or Issues?

See the issue tracker for #661 or review comments on the PR.
