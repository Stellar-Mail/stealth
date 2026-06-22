/**
 * Team Calendar Extraction Tool - Main Export
 *
 * Public API for the Team Calendar Extraction tool.
 * Only export what's needed for external use.
 */

// Components
export {
  TeamCalendarExtractionTool,
  EventList,
  ExtractionForm,
  EmptyState,
  LoadingState,
  ErrorState,
  SuccessState,
} from "./components";

export type {
  TeamCalendarExtractionToolProps,
  EventListProps,
  ExtractionFormProps,
  EmptyStateProps,
  LoadingStateProps,
  ErrorStateProps,
  SuccessStateProps,
} from "./components";

// Hooks
export { useCalendarExtraction, useCalendarEvents } from "./hooks";

export type { UseCalendarExtractionOptions, UseCalendarEventsOptions } from "./hooks";

// Services
export { calendarService } from "./services";

// Types
export type {
  CalendarEvent,
  CalendarExtractionRequest,
  ExtractionResult,
  ExtractionFilter,
  ExtractionStatus,
  EventPriority,
  EventCategory,
  ExtractionSource,
} from "./types";

// Fixtures (for testing/demo)
export {
  mockCalendarEvents,
  mockExtractionRequests,
  mockSourceEvents,
  getMockEvent,
  getMockExtractionRequest,
  getMockEventsByStatus,
  getMockEventsByCategory,
  getMockUpcomingEvents,
} from "./fixtures/calendar.fixtures";
