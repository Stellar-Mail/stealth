# Campaign Audit Log

This feature provides a structured, deterministic way to create and display audit log entries for campaign-specific actions within the Demo Admin Dashboard. It is fully isolated and operates on in-memory data, ensuring it is safe for a public repository.

## Architecture

- **Types (`auditLog.ts`):** Defines the core `AuditLogEntry` interface and related types (`CampaignAction`, `CampaignTarget`).
- **Helpers (`auditLog.ts`):**
  - `createAuditEntry`: A factory function to build new log entries with a consistent structure and a unique, deterministic ID.
  - `formatAuditEntry`: A pure function that converts an `AuditLogEntry` object into a human-readable string, handling various action types.
- **Component (`components/AuditLogPanel.tsx`):** A self-contained React component that takes an array of `AuditLogEntry` objects and renders them as a formatted list.

## Implemented Actions

The formatter currently supports the following actions:

- `create`
- `update` (with support for specific `details`)
- `assign`
- `publish`
- `rollback`

## Usage Example

### Creating and Formatting an Entry

```typescript
import { createAuditEntry, formatAuditEntry } from "./auditLog";

const entry = createAuditEntry({
  timestamp: "2023-10-27T10:00:00.000Z", // Use a fixed, deterministic timestamp
  actor: { id: "user-1", name: "Admin User" },
  action: "publish",
  target: { type: "Campaign", id: "camp-123", name: "Q4 Promo" },
});

const formattedString = formatAuditEntry(entry);
// "Admin User published the campaign "Q4 Promo"."
```

### Rendering the Panel

```tsx
import { AuditLogPanel } from "./components/AuditLogPanel";

const myAuditEntries = [/* ...array of AuditLogEntry objects... */];

<AuditLogPanel entries={myAuditEntries} />;
```

## Future Integrations

This module is designed to be easily integrated into a dashboard tab or a modal view. The `AuditLogPanel` can be wired up to a state management solution that holds the list of audit entries for a selected campaign.
