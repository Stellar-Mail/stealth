# Response Time Tracker - Architecture Contract

This document defines the module boundaries, data ownership, dependencies, and integration constraints for the Response Time Tracker tool. This tool operates as a **self-contained, isolated mini-product** intended for a V2 team release.

## 1. Module Boundaries

### User Interface Layer (`components/`)

- **`ResponseTimeTracker`**: The main container component. Orchestrates state, loading/error views, and passes data to child components.
- **`DateRangePicker`**: Provides UI controls for filtering the response time data by date range.
- **`ResponseTimeMetrics` & `StatsCard`**: Display aggregate SLA metrics and response time statistics (e.g., average, median, fastest, slowest).
- **`ResponseTimeList` & `ResponseTimeItem`**: Render the chronological list of individual thread response times, including SLA status badges (met/missed/breached).

### State Management (`hooks/`)

- **`useResponseTimes`**: Manages the data fetching state (`FetchState`), currently selected date filters, and coordinates with the service layer to retrieve updated metrics and entries.

### Business Logic Layer (`services/`)

- **`ResponseTimeService`**: Handles data retrieval, filtering logic based on date ranges, and metric calculations (averages, medians, SLA percentages). Currently retrieves data from local mock fixtures.

## 2. Data Ownership

The tool internally owns and manages:

- **`ResponseTimeEntry`**: Individual thread records with timestamps and SLA statuses.
- **`ResponseTimeMetrics`**: Aggregated metrics computed over the current date range.
- **`FetchState`**: The standard loading/empty/error/success state machine for the UI.

No external app data (live inbox threads, live wallet data, live authentication profiles) is currently owned or mutated by this tool.

## 3. Dependencies & Integration Constraints

### Allowable Dependencies

- Folder-local services, hooks, components, types, and fixtures.
- The existing global design system tokens (colors, spacing, typography).
- Standard React hooks and generic utilities.

### Integration Constraints

- ❌ **Main App Shell**: Do NOT wire this tool into the main dashboard layout, global sidebar, or routing system.
- ❌ **Inbox Architecture**: Do NOT connect to live mail API data, POP/IMAP services, or modify the core mail rendering engine.
- ❌ **Wallet & Stellar Core**: Do NOT integrate with the cryptocurrency wallet or blockchain features.
- ❌ **Authentication**: Do NOT implement active authorization or team-member profile management.
- ❌ **Database/Backend**: Do NOT implement database writes, server-side logic, or persistent state beyond isolated session-level filters.

## 4. Future Contributor Guidelines

- **What you MAY change**: Local components, the internal data calculation logic in the service, local mock fixtures, unit tests, and accessibility enhancements strictly within this directory (`tools/v2/team/response-time-tracker/`).
- **What you MAY NOT change**: The core application shell, existing design system configuration, global authentication models, or other tools.

Any future integration wiring this tool into the live application must be handled in a completely separate follow-up issue, preserving this tool's isolated core logic.
