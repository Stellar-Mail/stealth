# Technical Architecture - Role-Based Mail Access UI

This document explains the software design, UI component hierarchy, and middleware integration for the Role-Based Mail Access Control Plane.

## Design Patterns & Component Tree

The interface uses a unidirectional data flow pattern, using a central state hook to bind mock service instances to UI handlers:

```text
RoleBasedMailAccessDemo (demo.tsx)
 └── AccessConsole (components/AccessConsole.tsx)
      ├── PolicyMatrix (components/PolicyMatrix.tsx)
      ├── AccessVerifier (components/AccessVerifier.tsx)
      └── Real-time Limit Verifiers & Logs Audit
```

- **`AccessConsole`**: Orchestrates state sync, preset triggers, simulated limits validation, and captures hostile threat test scans.
- **`PolicyMatrix`**: Renders dynamic policy lookup checkbox matrix. Checks roles (`admin`, `manager`, `agent`, `viewer`, `guest`) against permissions (`read`, `write`, `assign`, `delete`, `manage`).
- **`AccessVerifier`**: Inputs credential requests, supports toggling asynchronous delays, and handles authorization status cards.
- **`AccessService`**: Bridges core React layers to native ESM code constraints in `guards/access-guards.mjs`.

## Data Models

The structures defined in [types/index.ts](file:///home/henry/projects/open-source/stealth/tools/v2/team/role-based-mail-access/types/index.ts) are:

### `VerifyAccessRequest`

```typescript
interface VerifyAccessRequest {
  requesterEmail: string;
  role: string;
  accessLevel: string;
  threadId: string;
}
```

### `AccessCheckLog`

```typescript
interface AccessCheckLog {
  id: string;
  request: VerifyAccessRequest;
  isAllowed: boolean;
  error?: string;
  timestamp: string;
}
```

## Threat Scan Loop

To prove that our boundary validators are robust, the `AccessConsole` includes an automated **Threat Scan Loop**:

- On click, it iterates over all 19 hostile test-case vectors preloaded in `fixtures/sample-access-requests.json`.
- Each vector injects bypass payloads (e.g. SQL, header injection, homoglyphs, traversals) to the validators.
- It scans the result return codes, verifying that all 19 threats are rejected and logged in real-time.
