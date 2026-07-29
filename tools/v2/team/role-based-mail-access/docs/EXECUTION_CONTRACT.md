# Role-Based Mail Access — Non-UI Execution Contract & Service Boundary

This document defines the stable, non-UI execution contract and service boundary for `tools/v2/team/role-based-mail-access` (#1362). It enables headless backend services, queue workers, audit collectors, and external integration layers to execute role-based mail access verification and policy administration independently of presentation concerns.

---

## 1. Overview & Service Boundary

The service boundary is exposed via `RoleBasedMailAccessBackendService` (and alias `AccessBackendService`), which implements `IRoleBasedMailAccessBackendService`.

```ts
import {
  RoleBasedMailAccessBackendService,
  AccessBackendService,
  IRoleBasedMailAccessBackendService,
  AccessResult,
  AccessErrorCode,
} from "tools/v2/team/role-based-mail-access";
```

All non-UI service methods return a standard `AccessResult<T>` envelope instead of throwing unhandled exceptions.

---

## 2. Standard Result Envelope (`AccessResult<T>`)

Every operation returns either a success payload or a structured error payload:

```ts
export type AccessResult<T> = { success: true; data: T } | { success: false; error: AccessError };

export interface AccessError {
  code: AccessErrorCode;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}
```

---

## 3. Error Codes (`AccessErrorCode`)

| Error Code             | Description                                                                    | Example Trigger                                       |
| :--------------------- | :----------------------------------------------------------------------------- | :---------------------------------------------------- |
| `INVALID_INPUT`        | Input payload validation failed (e.g. malformed email, illegal characters).    | Email missing domain or threadId containing `../`     |
| `UNKNOWN_ROLE`         | Specified role is not recognized or not allowed by boundary schema.            | Verifying request with `role: "hacker"`               |
| `UNKNOWN_ACCESS_LEVEL` | Specified access level is not recognized or not allowed.                       | Requesting action with `accessLevel: "destroy"`       |
| `LIMIT_EXCEEDED`       | Input array or quantity exceeds safe boundary thresholds.                      | Team size exceeding `MAX_TEAM_SIZE` (500)             |
| `POLICY_UPDATE_ERROR`  | Error encountered while modifying policy permissions.                          | Invalid role or level in `updatePolicy`               |
| `INVALID_STATE`        | Operation requested when service is in an unrecoverable or incompatible state. | Calling `verifyAccess` when backend status is `error` |
| `UNHANDLED_ERROR`      | General catch-all for unexpected internal runtime exceptions.                  | Unexpected storage or memory errors                   |

---

## 4. Method Contracts & DTOs

### 4.1 `getPolicy()`

Retrieves the current role-to-access-levels policy map.

- **Inputs**: None
- **Output (`GetPolicyOutput`)**:
  ```ts
  {
    policy: AccessPolicy;
  }
  ```

---

### 4.2 `updatePolicy(input)`

Updates the permitted access levels for a designated role.

- **Input (`UpdatePolicyInput`)**:
  ```ts
  {
    role: string;             // Required, must be allowed role
    accessLevels: string[];   // Required array of valid access levels
  }
  ```
- **Output (`UpdatePolicyOutput`)**:
  ```ts
  {
    policy: AccessPolicy;
    updatedRole: string;
    accessLevels: string[];
  }
  ```

---

### 4.3 `verifyAccess(input)`

Verifies whether a team member's role grants them the requested access level on a mail thread.

- **Input (`VerifyAccessInput`)**:
  ```ts
  {
    requesterEmail: string; // RFC 5321 compliant email address
    role: string; // Role name (admin, manager, agent, viewer, guest)
    accessLevel: string; // Action level (read, write, assign, delete, manage)
    threadId: string; // Alphanumeric thread identifier
  }
  ```
- **Output (`VerifyAccessOutput`)**:
  ```ts
  {
    isAllowed: boolean;
    role: string;
    accessLevel: string;
    threadId: string;
    requesterEmail: string;
    logId?: string;
    error?: string;
  }
  ```

> **Note**: An operational check where access is denied by policy returns `{ success: true, data: { isAllowed: false } }`. Error results (`{ success: false }`) are reserved for schema validation failures, unrecognized roles, or invalid states.

---

### 4.4 `batchVerifyAccess(input)`

Verifies a collection of access requests in sequence, reporting summary metrics.

- **Input (`BatchVerifyAccessInput`)**:
  ```ts
  {
    requests: VerifyAccessRequest[];
  }
  ```
- **Output (`BatchVerifyAccessOutput`)**:
  ```ts
  {
    results: BatchVerifyAccessItemResult[];
    total: number;
    allowedCount: number;
    deniedCount: number;
    errorCount: number;
  }
  ```

---

### 4.5 `getLogs(input?)`

Retrieves audit logs of access checks with optional filtering.

- **Input (`GetLogsInput`)**:
  ```ts
  {
    limit?: number;
    role?: string;
    isAllowed?: boolean;
  }
  ```
- **Output (`GetLogsOutput`)**:
  ```ts
  {
    logs: AccessCheckLog[];
    total: number;
  }
  ```

---

### 4.6 `clearLogs()`

Clears all stored audit logs.

- **Inputs**: None
- **Output (`ClearLogsOutput`)**:
  ```ts
  {
    clearedCount: number;
  }
  ```

---

### 4.7 `checkLimits(input)`

Validates that team size and attachment count remain within safe boundary limits.

- **Input (`CheckLimitsInput`)**:
  ```ts
  {
    teamSize: number;
    attachmentCount: number;
  }
  ```
- **Output (`CheckLimitsOutput`)**:
  ```ts
  {
    teamSizeValid: boolean;
    teamSizeError?: string;
    attachmentCountValid: boolean;
    attachmentCountError?: string;
  }
  ```

---

## 5. Fixtures & Success/Failure Scenarios

Headless execution fixtures are exported from `fixtures/backend-contract.ts` and re-exported by the main entry point (`tools/v2/team/role-based-mail-access/index.ts`):

- **Success Fixtures**:
  - `validVerifyAccessInputFixture`: Valid access check (`manager` -> `assign`).
  - `validVerifyAccessDeniedFixture`: Valid check resulting in denial (`viewer` -> `write`).
  - `validUpdatePolicyInputFixture`: Valid policy update for `agent`.
  - `validBatchVerifyInputFixture`: Batch of 3 requests across roles.
  - `validCheckLimitsInputFixture`: Normal team and attachment counts.
- **Failure Fixtures**:
  - `invalidInputEmptyEmailFixture`: Malformed email triggering `INVALID_INPUT`.
  - `invalidInputThreadIdPathTraversalFixture`: `../` thread ID triggering `INVALID_INPUT`.
  - `unknownRoleInputFixture`: `role: "hacker"` triggering `UNKNOWN_ROLE`.
  - `unknownAccessLevelInputFixture`: `accessLevel: "destroy"` triggering `UNKNOWN_ACCESS_LEVEL`.
  - `limitExceededTeamSizeFixture`: Team size of 600 triggering `LIMIT_EXCEEDED`.
  - `limitExceededAttachmentCountFixture`: Attachment count of 150 triggering `LIMIT_EXCEEDED`.
  - `invalidUpdatePolicyRoleFixture` & `invalidUpdatePolicyLevelFixture`: Invalid role and level update vectors.

---

## 6. Architectural Compliance

1. **No UI Dependencies**: `RoleBasedMailAccessBackendService` imports no React, DOM, or CSS styling files.
2. **Stable Envelopes**: Consumers never need `try/catch` blocks for validation or operational logic; all errors are returned in structured `AccessError` objects.
3. **Folder Isolation**: All contract files, services, fixtures, and tests are strictly folder-local within `tools/v2/team/role-based-mail-access/`.
