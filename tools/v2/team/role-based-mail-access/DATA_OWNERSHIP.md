# Role-Based Mail Access - Data Ownership & Flow

This document details data structures, storage parameters, state lifecycles, and mutation restrictions inside the Role-Based Mail Access tool.

---

## 1. Domain Entities & Data Model

We declare the core structures in [types/index.ts](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/types/index.ts):

```typescript
export interface VerifyAccessRequest {
  requesterEmail: string;
  role: string;
  accessLevel: string;
  threadId: string;
}

export interface AccessCheckLog {
  id: string;
  request: VerifyAccessRequest;
  isAllowed: boolean;
  error?: string;
  timestamp: string;
}

export interface AccessPolicy {
  [role: string]: string[]; // Array of allowed access levels (e.g. ["read", "write"])
}
```

---

## 2. Data Lifecycle

```
[UI Forms Input]
    ↓
    (Triggers handleSubmit)
    ↓
[useRoleBasedAccess Hook]
    ↓
    (Extracts payload & sets loading overlay status)
    ↓
[AccessService.checkRequest()]
    ↓
    (Deduces sanitization check ➔ executes validations)
    ↓
[Guard Middleware]
    ↓
    (Check criteria ➔ Throw on invalid field, or check policy map)
    ↓
[Service updates local Log history]
    ↓
[Hook updates React state ➔ renders alert card outcome]
```

- **Validation Checkpoint**: Every verification payload must run through the guards: `validateRole`, `validateAccessLevel`, `validateEmailAddress`, and `validateThreadId`.
- **Stateless Verification**: Checked request logs are stored locally in-memory inside the service state and reset upon page refresh.

---

## 3. Data Storage Boundaries

- **Local RAM State only**: No database integrations, blockchain sync, or cookie caching.
- **Unsynced Policies**: Dynamic policies are held in-memory. In subsequent issues, if persistent database config sync is required, it must be added via a new adapter layer.
- **No Private Logs Persistence**: Audit logs are temporary and stay within browser session RAM, preserving privacy bounds.

---

## 4. Mutability & Mutation Constraints

### Immutable

- **Historical Log Entries**: Once an `AccessCheckLog` is appended, its fields (`id`, `request`, `isAllowed`, `timestamp`, `error`) must never be modified.
- **Fixture Vectors**: The JSON mock vectors in `fixtures/` must remain read-only during runtime.

### Mutable

- **Dynamic Policy Dictionary**: Toggling matrix elements creates a new cloned policy object.
- **Component visual states**: Local indicators like input highlights and loading status variables.

---

## 5. Security & Privacy Safeguards

- **Email Sanitization**: The sanitizers block null bytes and control code injections.
- **Zero Logging of Email Content**: Only email header structures and clearance logs are recorded; email body text content is completely ignored.
- **Sanitized Error Messaging**: Validation errors explain structural failures without exposing private system details.
