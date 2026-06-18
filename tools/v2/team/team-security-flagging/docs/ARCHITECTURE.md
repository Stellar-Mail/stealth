# Team Security Flagging Architecture Contract

This document defines the isolated architecture and data contract for the
Team Security Flagging tool. It is a self-contained V2 mini-product and is not
wired into the main Stealth app until a future integration issue explicitly
adds routing, auth, or persistence.

## Architecture Boundary

All tool work stays inside:

```text
tools/v2/team/team-security-flagging/
```

Do not modify or depend on:

- Main app shell, dashboard layout, or global routing
- Existing inbox architecture or mail rendering engine
- Authentication, wallet core, or Stellar integration
- Shared database schema or backend persistence models
- Shared design system components or global UI tokens
- External notification systems or third-party API contracts

## Tool Overview

Team Security Flagging is a local review engine for capturing and tracking
security concerns reported against email content, threads, or related context.
It should support:

- reporting a security incident with descriptive context
- assigning severity, category, and triage status
- tracking review progress and resolution
- local state handling with deterministic fixtures

The tool may later integrate with the main app, but this issue only defines
and contains the architecture contract.

## Data Model Contract

### FlagRecord

A security flag record is the primary contract model.

Fields:

- `id`: string — stable local identifier
- `sourceMessageId`: string — source email message identifier
- `sourceThreadId`: string | null — optional thread identifier
- `reporterId`: string — reporting user identifier
- `reporterName`: string — display name of the reporter
- `createdAt`: string — ISO timestamp when the flag was created
- `severity`: `low` | `medium` | `high` | `critical`
- `category`: `phishing` | `malware` | `data-exposure` |
  `policy-violation` | `social-engineering` | `other`
- `description`: string — plain-text concern summary
- `status`: `open` | `investigating` | `escalated` | `resolved`
- `assignedTeam`: string | null — optional review owner or queue
- `triageRequired`: boolean — indicates whether a human triage action is needed
- `reviewNotes`: Array<{
    authorId: string
    authorName: string
    createdAt: string
    note: string
  }>
- `resolvedAt`: string | null — ISO timestamp when resolved

### Validation Contract

A valid flag must satisfy:

- `description` must be present and non-empty
- `category` must be one of the defined categories
- `severity` must be one of the defined levels
- `status` must be one of the defined statuses
- `createdAt` must be a valid ISO timestamp

## Service Contract

The local service layer should expose a deterministic, pure contract with
minimal side effects.

### Expected operations

- `listFlags(filters?: FlagFilters): Promise<FlagRecord[]>`
- `getFlagById(id: string): Promise<FlagRecord | null>`
- `createFlag(payload: CreateFlagPayload): Promise<FlagRecord>`
- `updateFlag(id: string, updates: UpdateFlagPayload): Promise<FlagRecord>`
- `addReviewNote(id: string, note: ReviewNotePayload): Promise<FlagRecord>`
- `resolveFlag(id: string, resolution: ResolveFlagPayload): Promise<FlagRecord>`

### Local storage expectations

- Use in-memory stores or local fixtures only
- Simulate persistence through deterministic mock data
- Preserve idempotency for repeated operations in tests
- Avoid any backend or database integration in this workspace

## UI Contract

The UI surface may include the following isolated states and views:

- `FlagListView`
  - list of flags with status, severity, category, and assigned team
  - filter controls for `status`, `severity`, and `category`
  - empty state when no flags match
- `FlagDetailView`
  - full incident details, reporter metadata, review notes, and lifecycle
    actions
- `FlagCreateView`
  - editor for category, severity, description, and optional assignment
  - submit flow with validation and error messaging
- `ReviewNoteForm`
  - add review notes with author attribution
- `StatusChangeActions`
  - update lifecycle state from `open` → `investigating` → `escalated` →
    `resolved`

### UI expectations

- Use isolated styling scoped to this tool only
- Do not introduce or modify global design system components
- Keep accessibility and keyboard navigation as first-class concerns
- Use semantic HTML and clear status affordances

## State and Flow

A typical local flow:

1. Create a new flag with source context and reporter metadata.
2. Flag is stored locally with `status: open` and `triageRequired` set based on
   severity.
3. Team reviewer views the flag detail and may add review notes.
4. Reviewer updates `status` to `investigating` or `escalated`.
5. When resolved, reviewer records resolution notes and sets `resolvedAt`.

## Testing Contract

The tool should include deterministic coverage for:

- data validation and model invariants
- service operations and state transitions
- review note creation and resolution behavior
- filter and list behavior for `status`, `severity`, and `category`

A local test plan should document scenarios for:

- creating valid and invalid flags
- moving flags through each lifecycle state
- handling critical and high-severity triage requirements
- verifying resolved flags include closing notes

## Future Integration Notes

This issue only defines the contract and local engine. A future follow-up issue
will define how Team Security Flagging connects to the Stealth app with:

- main app routing and shell placement
- auth and permission enforcement
- real persistence or backend integration
- notification and audit logging
- shared design system adoption if needed
