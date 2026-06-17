# Response Time Tracker API

## Purpose

The core engine turns folder-local message events into response-time metrics for a future UI surface. It is pure TypeScript and does not fetch email, call production APIs, read secrets, or mutate app state.

## Input

Use `summarizeResponseTimes(events, options)` with an array of `ResponseTimeEvent` objects:

```ts
{
  id: "in-1",
  conversationId: "thread-a",
  direction: "inbound",
  sentAt: "2026-06-17T08:00:00.000Z",
  customerId: "customer-a",
  subject: "Invoice question"
}
```

`direction` must be `inbound` or `outbound`. `sentAt` must be an ISO-compatible timestamp. `options.slaMinutes` defaults to `120`.

## Output

The ready state contains:

- `totals`: aggregate conversation count, response count, pending count, median/average/longest response time, and SLA breach count.
- `conversations`: per-conversation summaries with paired responses and pending inbound messages.
- `slaMinutes`: the threshold used for `withinSla` calculations.

## States

- `createResponseTimeLoadingState()` returns `{ status: "loading" }` for a future UI to show a local loading state.
- `summarizeResponseTimes()` throws on malformed input.
- `safeSummarizeResponseTimes()` wraps failures as `{ status: "error" }` with details.
- Successful summaries return `{ status: "ready" }`.

## Boundary

All behavior lives under `tools/v2/team/response-time-tracker/`. This folder-local API is intentionally not mounted into routing, inbox storage, wallet logic, Stellar integration, authentication, or the shared design system.
