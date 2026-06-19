# Suspicious Sender Watchlist - UI Implementation

## Overview

This folder contains the complete UI implementation for the Suspicious Sender Watchlist tool, including accessible components, local test fixtures, and documentation.

## Folder Structure

```
suspicious-sender-watchlist/
├── components/              # React components
│   ├── SuspiciousSenderWatchlist.tsx    # Main app wrapper
│   ├── WatchlistEmptyState.tsx          # Empty state
│   ├── WatchlistLoadingState.tsx        # Loading state
│   ├── WatchlistErrorState.tsx          # Error state
│   ├── WatchlistList.tsx                # Success state (list view)
│   ├── WatchlistEntry.tsx               # Individual entry item
│   └── index.ts                         # Export barrel file
├── docs/                    # Documentation
│   ├── ACCESSIBILITY.md     # WCAG 2.1 AA accessibility guide
│   └── README.md            # This file
├── hooks/                   # Custom React hooks (placeholder for future)
├── tests/                   # Test files (placeholder for future)
└── fixtures/                # Test data (placeholder for future)
```

## Features

### States Implemented

- ✅ **Empty State**: Guides user to add first sender
- ✅ **Loading State**: Shows skeleton loaders while fetching
- ✅ **Error State**: Displays error with retry action
- ✅ **Success State**: Shows list of watchlist entries

### Accessibility

- ✅ WCAG 2.1 Level AA compliant
- ✅ Keyboard navigation throughout
- ✅ Screen reader optimized with semantic HTML and ARIA
- ✅ Focus indicators visible
- ✅ Color contrast meets standards
- ✅ See [ACCESSIBILITY.md](./docs/ACCESSIBILITY.md) for details

### Component Design

- Each component is self-contained and focused
- Uses shared UI component library from `src/components/ui/`
- Isolatedto tool folder, not mounted in main app
- Responsive design for different screen sizes
- Light and dark mode ready (via Tailwind classes)

## Using the Components

### Import and Use

```tsx
import { SuspiciousSenderWatchlist } from "./components";

export function MyPage() {
  return <SuspiciousSenderWatchlist />;
}
```

### Component Props

#### SuspiciousSenderWatchlist

No props required. Manages its own state internally using local fixtures.

```tsx
<SuspiciousSenderWatchlist />
```

#### WatchlistList

- `entries: WatchlistEntryData[]` - Array of entries to display
- `onRemove: (id: string) => void` - Callback when removing entry
- `onAddNew: () => void` - Callback when adding new entry

#### WatchlistEntry

- `id: string` - Unique identifier
- `senderEmail: string` - Email address
- `senderName: string` - Display name
- `reason: string` - Why they're on watchlist
- `riskLevel: 'low' | 'medium' | 'high'` - Risk classification
- `dateAdded: string` - ISO date string
- `onRemove: (id: string) => void` - Remove callback

## Development

### Local Testing

The main `SuspiciousSenderWatchlist` component includes local test fixtures:

```tsx
const fixtureEntries: WatchlistEntryData[] = [
  {
    id: "1",
    senderEmail: "noreply@phishing-example.com",
    senderName: "Phishing Alert",
    reason: "Known phishing domain",
    riskLevel: "high",
    dateAdded: "2025-01-10",
  },
  // ... more entries
];
```

### Adding State Handlers

To connect to real data in the future, modify the `useEffect` in `SuspiciousSenderWatchlist.tsx`:

```tsx
useEffect(() => {
  // Replace fixture loading with API call
  fetchWatchlist().then((data) => {
    setEntries(data);
    setState(data.length === 0 ? "empty" : "success");
  });
}, []);
```

## Accessibility Testing

For detailed accessibility testing instructions, see [ACCESSIBILITY.md](./docs/ACCESSIBILITY.md).

**Quick test:**

1. Navigate using only Tab key
2. Test with screen reader (NVDA, JAWS, VoiceOver)
3. Check focus indicators are visible
4. Verify all buttons have meaningful labels

## Integration Notes

⚠️ **Not currently mounted in main app** - This is intentional per V2 design.

When integration is needed in the future:

- Create a separate issue for app-level integration
- Do not modify main app shell, routing, or design system in this issue
- Import components from this folder as-is
- This folder remains the source of truth for the UI

## Dependencies

- React 18+
- Tailwind CSS
- Lucide React (icons)
- Shared UI components from `src/components/ui/`

## Future Work

- [ ] Add unit tests for components
- [ ] Add Storybook stories for visual testing
- [ ] Add animation preferences support (prefers-reduced-motion)
- [ ] Add data export functionality
- [ ] Add filtering/search
- [ ] Add bulk operations
- [ ] Integration with main mail app (separate issue)

## Related Documentation

- [Accessibility Guidelines](./docs/ACCESSIBILITY.md)
- Main tools README: `tools/v2/team/README.md`
- Protocol docs: See `tools/v2/team/` for other tools

## Questions or Issues?

See the issue tracker for #671 or review comments on the PR.
