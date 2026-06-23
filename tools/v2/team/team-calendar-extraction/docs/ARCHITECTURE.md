# Team Calendar Extraction Tool - Architecture

This document describes the architecture and design patterns used in the Team Calendar Extraction tool.

## Overview

The Team Calendar Extraction tool is a **self-contained, isolated tool** for extracting calendar events from various team communication sources. It operates independently with local data services and does not depend on the main application.

## Architecture Diagram

```
┌─ User Interface Layer ──────────────────────────────┐
│                                                      │
│  TeamCalendarExtractionTool (Main Container)         │
│  ├─ EventList (Browse events)                       │
│  ├─ ExtractionForm (Initiate extraction)            │
│  ├─ Event Detail View                              │
│  └─ State Components                                │
│      ├─ EmptyState                                  │
│      ├─ LoadingState                                │
│      ├─ ErrorState                                  │
│      └─ SuccessState                                │
│                                                      │
└─────────────────────────────────────────────────────-┘
         │                    │
         ▼                    ▼
┌─ State Management ──────────────────────────────────┐
│                                                      │
│  Custom Hooks                                       │
│  ├─ useCalendarExtraction (extraction workflow)     │
│  └─ useCalendarEvents (data fetching & filtering)   │
│                                                      │
└──────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─ Business Logic Layer ───────────────────────────────┐
│                                                       │
│  Services (Local Data Management)                    │
│  └─ CalendarService (event & extraction management)  │
│                                                       │
└──────────────────────────────────────────────────────-┘
         │
         ▼
┌─ Data Layer ─────────────────────────────────────────┐
│                                                       │
│  In-Memory Storage                                    │
│  ├─ Calendar events                                  │
│  ├─ Extraction requests                              │
│  └─ Extraction results                               │
│                                                       │
└──────────────────────────────────────────────────────-┘

┌─ Test Fixtures & Documentation ──────────────────────┐
│                                                       │
│  ├─ Mock calendar event data                         │
│  ├─ Accessibility guide                              │
│  ├─ Visual style guide                               │
│  └─ Getting started guide                            │
│                                                       │
└──────────────────────────────────────────────────────-┘
```

## Component Structure

### UI Components (`components/`)

#### TeamCalendarExtractionTool

- **Purpose**: Main container orchestrating the entire workflow
- **State**: Current view (list/details/extracting/loading/error/success)
- **Props**: `events`, `extractionRequests`, `onExtract`, `isLoading`, `error`
- **Responsibility**: Managing view transitions, handling focus management

#### EventList

- **Purpose**: Display sortable list of extracted calendar events
- **Features**:
  - Keyboard navigation (arrow keys)
  - Event selection with visual feedback
  - Sortable by date, priority, category
  - Status badges with accessible labels
  - Tags and attendees display
- **Accessibility**: ARIA list semantics, keyboard support

#### ExtractionForm

- **Purpose**: Initiate new calendar extraction
- **Features**:
  - Source type selection (email, calendar link, manual, attachment)
  - Source reference input
  - Form validation
  - Keyboard shortcuts (Escape to cancel, Ctrl+Enter to submit)
- **Accessibility**: Proper label associations, fieldset grouping, keyboard support

#### State Components

- **EmptyState**: No events available
- **LoadingState**: Fetching or extracting data
- **ErrorState**: Error occurred during extraction
- **SuccessState**: Confirmation after successful extraction

### Custom Hooks (`hooks/`)

#### useCalendarExtraction

- **Purpose**: Manage extraction workflow state
- **Methods**:
  - `extract(request)`: Initiate extraction process
  - `getResult(requestId)`: Retrieve stored result
  - `clearError()`: Clear error state
  - `clearResults()`: Reset extraction results
- **State**: `isLoading`, `error`, `results`

#### useCalendarEvents

- **Purpose**: Manage calendar event data
- **Methods**:
  - `addEvent(event)`: Add new event
  - `removeEvent(id)`: Remove event
  - `updateEventStatus(id, status)`: Update event status
  - `fetch()`: Fetch events from callback
  - `refresh()`: Force refresh
  - `clearFilter()`: Reset filters
- **State**: `events`, `requests`, `isLoading`, `error`, `filter`, `sortBy`

### Services (`services/`)

#### CalendarService

- **Singleton**: Single instance across application
- **Methods**:
  - CRUD operations for events, requests, and results
  - Filtering by date, category, priority, status, attendees
  - `simulateExtraction()`: Simulate event extraction process
- **Storage**: In-memory Map

### Type Definitions (`types/`)

```typescript
// Calendar event
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

// Extraction request
interface CalendarExtractionRequest {
  id: string;
  title: string;
  source: ExtractionSource;
  sourceRef?: string;
  requestedBy: string;
  requestedAt: Date;
  status: ExtractionStatus;
  events: CalendarEvent[];
  eventCount: number;
  extractedCount: number;
  failedCount: number;
  notes?: string;
}

// Extraction result
interface ExtractionResult {
  requestId: string;
  totalEvents: number;
  successfulExtractions: number;
  failedExtractions: number;
  events: CalendarEvent[];
  extractedAt: Date;
  duration: number;
}
```

## Data Flow

### Calendar Extraction Workflow

```
1. User views EventList
   ├─ Events displayed from props
   ├─ Sort by date/priority/category
   └─ Filter controls available

2. User selects event from list
   ├─ Focus moves to detail view
   ├─ Complete event info displayed
   └─ "Extract Events" button available

3. User initiates extraction
   ├─ ExtractionForm displayed
   ├─ Source type selected
   ├─ Optional source reference entered
   └─ Form validated

4. User submits extraction
   ├─ calendarService.simulateExtraction() called
   ├─ LoadingState shown during process
   ├─ Events processed with ~90% success rate
   └─ Results recorded

5. Success shown, auto-return after 4 seconds
   ├─ View returns to EventList
   ├─ Newly extracted events included
   └─ Extraction history updated
```

## Accessibility Architecture

### Keyboard Navigation

- **Tab**: Move between interactive elements
- **Shift+Tab**: Move backward
- **Arrow Keys**: Navigate list items
- **Enter/Space**: Activate elements
- **Escape**: Cancel operations

### Screen Reader Support

- **Semantic HTML**: form, fieldset, legend, details, summary
- **ARIA Labels**: aria-label, aria-labelledby, aria-describedby
- **Live Regions**: role="status" with aria-live
- **Status Indicators**: role="alert" for errors

## Styling Strategy

- Uses existing design system tokens (colors, spacing, typography)
- Tailwind CSS for component styling
- Custom utility classes in styles.css (tool-scoped)
- No modifications to shared design system

## State Management Pattern

### Local State

- Component-level state with useState
- Hook-based state management (custom hooks)
- No external state library required

### Service State

- Singleton service for data management
- In-memory storage by default

## Boundary Conditions

### What's Inside This Tool

✅ UI components for calendar extraction
✅ Local data services
✅ State management hooks
✅ Mock fixtures
✅ Accessibility features
✅ Documentation

### What's NOT Inside This Tool

❌ Main app routing
❌ Authentication system
❌ Mail integration
❌ Real calendar API integration
❌ Inbox or mail rendering
❌ Database persistence
❌ API endpoints
❌ Wallet core

## Extension Points

For future integration, external code can:

- Provide custom event data via props
- Implement extraction callbacks
- Add filtering or sorting logic
- Custom styling (CSS classes)
- Additional state management

But CANNOT:

- Modify shared design system
- Wire into main app routing
- Access wallet or Stellar core
- Modify database schema
- Change authentication

## Future Enhancements

Phase 2 (Testing & Documentation):

- Unit tests with Vitest
- E2E tests with Playwright
- Expanded documentation

Phase 3 (Integration):

- Route integration with main app
- Authentication connection
- Real calendar API integration
- Database persistence
- Real extraction algorithms

---

This architecture ensures the tool is **isolated, maintainable, testable, and accessible** while remaining ready for future integration.
