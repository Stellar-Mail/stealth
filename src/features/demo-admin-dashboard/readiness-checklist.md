# Demo Admin Dashboard - Integration Readiness Checklist

This document serves as the readiness and risk checklist for when the Demo Admin Dashboard is ready to be connected to the live demo inbox UI.

---

## 1. Integration Checklist

Before connecting the dashboard to any live/server backend, verify that the following tasks are completed:

- [ ] **API Endpoint Definition**: Define the REST/GraphQL endpoints for demo dataset listing, retrieval, and publishing.
- [ ] **Production Adapter Implementation**: Implement a `ServerPublishingAdapter` matching the `DemoPublishingAdapter` contract defined in `adapter.ts`.
- [ ] **Environment Configuration**: Configure backend URLs and API keys using environment variables (e.g. `VITE_DEMO_API_URL`) instead of hardcoding.
- [ ] **Feature Flag Guard**: Ensure the admin dashboard route and all related features are guarded by a feature flag (e.g., `isDemoMode` or `enableDemoAdmin`) so they are not accessible in production builds.
- [ ] **Schema Conformance**: Verify that the JSON payload of the demo dataset conforms exactly to the latest `Email` and `MailEvent` types in `src/components/mail/data.ts`.
- [ ] **Migration Verification**: Run the migration runner `runMigrations` on existing persisted datasets to ensure they are properly upgraded to the current schema before publishing.

---

## 2. Risk Checklist & Mitigation

Ensure the following safety boundaries are maintained to protect production systems:

- [ ] **Mail Flow Isolation**:
  - _Risk_: Accidentally sending real emails or writing mock data into production mailboxes.
  - _Mitigation_: Ensure the dashboard never calls `postage-service` or writes to production-bound mail queue directories. Keep all database modifications confined to the mock mailbox store/context.
- [ ] **Data Sanitization**:
  - _Risk_: Accidental exposure of real user data, credentials, private keys, or API tokens in demo datasets.
  - _Mitigation_: Verify all demo datasets use deterministic fake data (e.g., Stellar testnet addresses or mock public keys). Add automated pre-publish checks that reject any payload containing standard private key prefixes (e.g. `S...` seed keys).
- [ ] **Network & Sandbox Restrictions**:
  - _Risk_: The application making live external requests in sandboxed or offline environments.
  - _Mitigation_: The publishing adapter must fall back gracefully to the in-memory/localStorage implementation when no backend endpoint is configured.

---

## 3. Future Integration Notes

When transitioning from the in-memory mock implementation to the server-backed API:

### Swapping the Adapter

You can swap the adapter dynamically based on the environment configuration:

```typescript
import { InMemoryPublishingAdapter } from "./adapter";
import { ServerPublishingAdapter } from "./server-adapter"; // Future implementation

export const publishingAdapter = import.meta.env.VITE_DEMO_API_URL
  ? new ServerPublishingAdapter(import.meta.env.VITE_DEMO_API_URL)
  : new InMemoryPublishingAdapter();
```

### Migration Runner Hook

The migration runner should be invoked automatically upon loading any dataset from the backend to ensure backward compatibility with older datasets:

```typescript
import { runMigrations } from "./migrations";

const LATEST_SCHEMA_VERSION = 3;

async function loadDataset(id: string) {
  const rawDataset = await publishingAdapter.getDataset(id);
  if (!rawDataset) return null;

  const result = runMigrations(rawDataset, LATEST_SCHEMA_VERSION);
  if (!result.success) {
    console.error("Migration failed:", result.error);
    // Handle migration failure gracefully
    return null;
  }
  return result.data;
}
```
