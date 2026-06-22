# Team Calendar Extraction

A self-contained team tool for extracting calendar events from team communications with **accessibility built in**.

## Ownership Boundary

✅ All work for this tool stays inside: `tools/v2/team/team-calendar-extraction/`

❌ Do NOT modify:

- Main app shell, dashboard, or routing
- Authentication, wallet core, or Stellar integration
- Database schema or API contracts
- Shared design system tokens or components
- Existing inbox architecture or mail rendering

## Folder Structure

```
team-calendar-extraction/
├── components/              # Accessible UI components
│   ├── event-list.tsx                    # Sortable event list
│   ├── extraction-form.tsx               # Extraction initiation form
│   ├── empty-state.tsx                   # Empty state
│   ├── loading-state.tsx                 # Loading state
│   ├── error-state.tsx                   # Error state
│   ├── success-state.tsx                 # Success state
│   ├── team-calendar-extraction-tool.tsx # Main container
│   └── index.ts
├── hooks/                   # Local state management
│   ├── use-calendar-extraction.ts        # Extraction workflow hook
│   ├── use-calendar-events.ts            # Event filtering hook
│   └── index.ts
├── services/                # Business logic
│   ├── calendar.service.ts               # Calendar data service
│   └── index.ts
├── types/                   # TypeScript definitions
│   ├── calendar.ts                       # Calendar event types
│   └── index.ts
├── fixtures/                # Test data
│   └── calendar.fixtures.ts              # Mock event data
├── tests/                   # Unit & integration tests
├── docs/                    # Documentation
│   ├── ACCESSIBILITY.md                  # Keyboard, screen reader, ARIA
│   ├── VISUAL_STYLE.md                   # Component styles without modifying design system
│   ├── ARCHITECTURE.md                   # Code architecture and patterns
│   └── GETTING_STARTED.md                # Usage guide
├── styles.css               # Local component styles
├── specs.md                 # Issue categories and contributor notes
├── demo.tsx                 # Demo component
├── index.ts                 # Public API exports
└── README.md                # This file
```

## Key Features

### ✅ Accessibility Built In

- **Keyboard Navigation**: Full Tab/Shift+Tab, Arrow keys, Enter, Escape support
- **Screen Reader Compatible**: Proper ARIA labels, live regions, semantic HTML
- **Focus Management**: Clear focus indicators, logical tab order
- **Color & Contrast**: WCAG AA compliant, status conveyed beyond color
- **Reduced Motion**: Respects `prefers-reduced-motion` preference

See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) for detailed keyboard shortcuts and screen reader testing guide.

### 📅 Calendar Extraction Workflow

1. **List View**: Browse extracted events with sort capabilities
2. **Detail View**: View complete event information
3. **Extraction Form**: Initiate new extraction from various sources
4. **Processing**: Events extracted with status tracking
5. **Confirmation**: Success state with auto-return to list

### 🎨 Visual Design

- Isolated component styling without modifying shared design system
- Semantic color use (status badges, priority levels, category colors)
- Responsive layout from mobile to desktop
- Dark mode support

See [docs/VISUAL_STYLE.md](docs/VISUAL_STYLE.md) for component styling reference.

## Getting Started

### Using the Main Component

```tsx
import { TeamCalendarExtractionTool } from "./components/team-calendar-extraction-tool";
import { mockCalendarEvents } from "./fixtures/calendar.fixtures";

export function CalendarPage() {
  return (
    <TeamCalendarExtractionTool
      events={mockCalendarEvents}
      onExtract={async (request) => {
        // Local logic - no main app wiring
        console.log("Extracting:", request.source);
        return {
          requestId: request.id,
          totalEvents: request.events.length,
          successfulExtractions: request.events.length,
          failedExtractions: 0,
          events: request.events,
          extractedAt: new Date(),
          duration: 500,
        };
      }}
    />
  );
}
```

See [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for detailed usage examples.

## Contribution Workflow

When contributing to this tool:

1. ✅ Keep all changes in `tools/v2/team/team-calendar-extraction/`
2. ✅ Test keyboard navigation and screen reader compatibility
3. ✅ Use design system tokens, don't modify shared components
4. ✅ Document changes in relevant docs/
5. ✅ Include local fixtures for new test cases
6. ❌ Don't wire into main app routing, wallet, or auth
7. ❌ Don't modify main app dashboard or navigation

See [specs.md](specs.md) for issue category definitions.

## Next Steps (Future Integration)

When ready to integrate this tool into the main app, a **separate follow-up issue** will handle:

- Routing integration
- Authentication connection
- Main app layout wiring
- Real calendar API integration
- Database persistence

For now, this tool is **self-contained with local data handling**.
