# Response Time Tracker Specs

## Purpose

Track response speed for team emails. Provides aggregate metrics and per-entry
breakdown of response times, helping teams meet SLA targets.

## Scope

- Release tier: V2
- Audience: Team
- Folder ownership: `tools/v2/team/response-time-tracker/`
- Integration status: Isolated — not wired into the main app

This is a self-contained tooling workspace. Do not wire this tool into the main
app, routing, inbox architecture, wallet core, Stellar core, or design system
unless a future integration issue explicitly allows it.

## In-Scope Behavior

- Load and display response time entries from a local fixture.
- Calculate aggregate metrics: average, median, fastest, slowest, SLA %.
- Filter entries by a configurable date range.
- Show loading skeleton placeholders while data is being fetched.
- Show an empty state when no entries match the current filter.
- Show an error state with a retry button when fetching fails.
- Display individual entries with subject, sender, responder, timestamps, and
  SLA status (met / missed / breached).
- All interactive controls must have keyboard support, focus behavior, and
  screen-reader labels.

## Out-of-Scope Behavior

- Wiring the tool into the main app shell, routing, or navigation.
- Connecting to live inbox or mail API data.
- Authentication, authorization, or team-member management.
- Push notifications or real-time updates.
- Editing or deleting response time entries.
- Exporting data to CSV or other formats.
- Persisting date range preferences across sessions.
- Any form of database write or server-side logic.

## Data Contract

### ResponseTimeEntry

```typescript
interface ResponseTimeEntry {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  sentAt: string; // ISO 8601
  respondedAt: string; // ISO 8601
  responseTimeMs: number;
  teamMemberId: string;
  status: "met" | "missed" | "breached";
}
```

### ResponseTimeMetrics

```typescript
interface ResponseTimeMetrics {
  averageResponseTimeMs: number;
  medianResponseTimeMs: number;
  fastestResponseTimeMs: number;
  slowestResponseTimeMs: number;
  totalResponses: number;
  metCount: number;
  missedCount: number;
  breachedCount: number;
  slaMs: number; // 4 hours (14400000 ms)
  withinSLAPercentage: number;
}
```

### TeamMember

```typescript
interface TeamMember {
  id: string;
  name: string;
}
```

### FetchState

```typescript
type FetchState<T> =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };
```

### DateRange

```typescript
interface DateRange {
  start: string; // ISO 8601 date (YYYY-MM-DD)
  end: string; // ISO 8601 date (YYYY-MM-DD)
}
```

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
