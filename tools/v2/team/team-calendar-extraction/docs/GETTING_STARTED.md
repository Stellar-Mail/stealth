# Team Calendar Extraction Tool - Getting Started

This guide walks you through using the Team Calendar Extraction tool in your application.

## Installation

The tool is already part of the codebase at `tools/v2/team/team-calendar-extraction/`. No additional installation needed.

## Basic Usage

### Using the Main Component

The simplest way to use the tool is with the `TeamCalendarExtractionTool` component:

```tsx
import { TeamCalendarExtractionTool } from "@/tools/v2/team/team-calendar-extraction";
import { mockCalendarEvents } from "@/tools/v2/team/team-calendar-extraction/fixtures/calendar.fixtures";

export function CalendarExtractionPage() {
  return (
    <TeamCalendarExtractionTool
      events={mockCalendarEvents}
      onExtract={async (request) => {
        // Handle extraction
        console.log(`Extracting from: ${request.source}`);
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

### Using Individual Components

For more control, use components separately:

```tsx
import {
  EventList,
  ExtractionForm,
  EmptyState,
  LoadingState,
} from "@/tools/v2/team/team-calendar-extraction/components";
import { mockCalendarEvents } from "@/tools/v2/team/team-calendar-extraction/fixtures/calendar.fixtures";
import { useState } from "react";

export function CustomCalendarPage() {
  const [selected, setSelected] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);

  if (isExtracting) {
    return <LoadingState message="Extracting calendar events..." />;
  }

  if (!mockCalendarEvents.length) {
    return (
      <EmptyState
        title="No calendar events"
        description="Start a new extraction to find events from your team communications"
        action={<button onClick={() => {}}>Start Extraction</button>}
      />
    );
  }

  if (selected) {
    return (
      <div>
        <h2>{selected.title}</h2>
        <p>{selected.description}</p>
        <p>Date: {new Date(selected.startDate).toLocaleDateString()}</p>
        <p>Category: {selected.category}</p>
        <p>Priority: {selected.priority}</p>
        <button onClick={() => setSelected(null)}>Back</button>
      </div>
    );
  }

  return <EventList events={mockCalendarEvents} onSelectEvent={setSelected} />;
}
```

## Using Hooks

### useCalendarEvents

Manage and filter calendar events:

```tsx
import { useCalendarEvents } from "@/tools/v2/team/team-calendar-extraction/hooks";
import { mockCalendarEvents } from "@/tools/v2/team/team-calendar-extraction/fixtures/calendar.fixtures";

function MyComponent() {
  const { events, isLoading, error, setFilter, setSortBy, filter, sortBy, clearFilter } =
    useCalendarEvents({
      initialEvents: mockCalendarEvents,
    });

  return (
    <div>
      <h2>Events: {events.length}</h2>
      <button onClick={() => setFilter({ priorities: ["urgent"] })}>Show Urgent Only</button>
      <button onClick={clearFilter}>Clear Filter</button>
    </div>
  );
}
```

### useCalendarExtraction

Manage extraction workflow:

```tsx
import { useCalendarExtraction } from "@/tools/v2/team/team-calendar-extraction/hooks";

function ExtractionComponent({ request }) {
  const { isLoading, error, extract, getResult, clearError } = useCalendarExtraction({
    onExtract: async (request) => {
      // Custom extraction logic
      return {
        requestId: request.id,
        totalEvents: 5,
        successfulExtractions: 5,
        failedExtractions: 0,
        events: [],
        extractedAt: new Date(),
        duration: 1000,
      };
    },
  });

  const result = getResult(request.id);

  return (
    <div>
      {error && (
        <div>
          Error: {error}
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}
      {result && <p>Extracted {result.successfulExtractions} events</p>}
      <button onClick={() => extract(request)} disabled={isLoading}>
        {isLoading ? "Extracting..." : "Start Extraction"}
      </button>
    </div>
  );
}
```

## Using Services

For direct data management:

```tsx
import { calendarService } from "@/tools/v2/team/team-calendar-extraction/services";
import { mockCalendarEvents } from "@/tools/v2/team/team-calendar-extraction/fixtures/calendar.fixtures";

// Initialize with mock data
mockCalendarEvents.forEach((e) => calendarService.addEvent(e));

// Get all events
const allEvents = calendarService.getAllEvents();

// Get upcoming events
const upcoming = calendarService.getUpcomingEvents();

// Get events by category
const meetings = calendarService.getEventsByCategory("meeting");

// Filter events
const urgentMeetings = calendarService.filterEvents({
  priorities: ["urgent"],
  categories: ["meeting"],
});

// Clear data
calendarService.clear();
```

## Testing

### Unit Testing Example

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventList } from "@/tools/v2/team/team-calendar-extraction/components";
import { mockCalendarEvents } from "@/tools/v2/team/team-calendar-extraction/fixtures/calendar.fixtures";

describe("EventList", () => {
  it("should navigate events with arrow keys", async () => {
    const handleSelect = jest.fn();

    render(<EventList events={mockCalendarEvents} onSelectEvent={handleSelect} />);

    // Tab to first event
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");

    expect(handleSelect).toHaveBeenCalled();
  });
});
```

### Accessibility Testing

```tsx
import { render, screen } from "@testing-library/react";
import { TeamCalendarExtractionTool } from "@/tools/v2/team/team-calendar-extraction";
import { mockCalendarEvents } from "@/tools/v2/team/team-calendar-extraction/fixtures/calendar.fixtures";

describe("Accessibility", () => {
  it("should have proper ARIA labels", () => {
    render(<TeamCalendarExtractionTool events={mockCalendarEvents} />);

    expect(screen.getByRole("button", { name: /view details/i })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /calendar events/i })).toBeInTheDocument();
  });
});
```

## API Reference

### TeamCalendarExtractionTool Props

```typescript
interface TeamCalendarExtractionToolProps {
  events: CalendarEvent[];
  extractionRequests?: CalendarExtractionRequest[];
  onExtract?: (request: CalendarExtractionRequest) => Promise<ExtractionResult>;
  isLoading?: boolean;
  error?: string | null;
}
```

### CalendarEvent Type

```typescript
interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  attendees: string[];
  organizer: string;
  priority: "low" | "normal" | "high" | "urgent";
  category: "meeting" | "deadline" | "reminder" | "milestone" | "personal";
  status: "pending" | "extracted" | "failed" | "skipped";
  source: "email" | "calendar_link" | "manual" | "attachment";
  sourceRef?: string;
  tags: string[];
  extractedAt: Date;
  notes?: string;
}
```

## Keyboard Shortcuts

- **Tab**: Move to next element
- **Shift+Tab**: Move to previous element
- **Arrow Up/Down**: Navigate event items
- **Enter/Space**: Select event or activate button
- **Escape**: Cancel form, return to list
- **Ctrl+Enter / Cmd+Enter**: Submit extraction form

See [ACCESSIBILITY.md](ACCESSIBILITY.md) for complete keyboard navigation guide.

## Troubleshooting

### Component not rendering

Make sure you've imported from the correct path:

```tsx
// ✅ Correct
import { TeamCalendarExtractionTool } from "@/tools/v2/team/team-calendar-extraction";

// ❌ Wrong
import { TeamCalendarExtractionTool } from "@/features/calendar-extraction";
```

### Types not recognized

Make sure TypeScript is updated and path aliases are configured correctly in `tsconfig.json`.

## Next Steps

- Read [ACCESSIBILITY.md](ACCESSIBILITY.md) for detailed accessibility testing
- Read [VISUAL_STYLE.md](VISUAL_STYLE.md) for component styling reference
- Check [demo.tsx](../demo.tsx) for more examples
- See [fixtures/calendar.fixtures.ts](../fixtures/calendar.fixtures.ts) for test data
