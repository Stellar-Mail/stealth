# Project Mail Binder — Backend Execution Contract & Service Boundary

This document defines the stable, non-UI execution contract and service boundary for `tools/v2/team/project-mail-binder`. It enables headless backend services, queue workers, and external integration layers to execute mail binder workflows independently of presentation concerns.

---

## 1. Overview & Service Boundary

The service boundary is exposed via `ProjectMailBinderBackendService`, which implements `IBinderBackendService`.

```ts
import {
  ProjectMailBinderBackendService,
  IBinderBackendService,
  BinderResult,
  BinderErrorCode,
} from "tools/v2/team/project-mail-binder";
```

All non-UI service methods return a standard `BinderResult<T>` envelope instead of throwing unhandled exceptions.

---

## 2. Standard Result Envelope (`BinderResult<T>`)

Every operation returns either a success payload or a structured error payload:

```ts
export type BinderResult<T> = { success: true; data: T } | { success: false; error: BinderError };

export interface BinderError {
  code: BinderErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
```

---

## 3. Error Codes (`BinderErrorCode`)

| Error Code              | Description                                                                 | Example Trigger                               |
| :---------------------- | :-------------------------------------------------------------------------- | :-------------------------------------------- |
| `INVALID_INPUT`         | Input payload validation failed (e.g. empty name, missing required fields). | Creating project with `name: ""`              |
| `PROJECT_NOT_FOUND`     | Specified `projectId` does not exist in binder store.                       | Deleting non-existent `proj-999`              |
| `MAIL_NOT_FOUND`        | Specified `mailId` does not exist.                                          | Unbinding non-existent `mail-999`             |
| `INVALID_STATE`         | Operation requested in incompatible state (e.g. `loading` or `error`).      | Calling `createProject` when state is `error` |
| `DUPLICATE_PROJECT`     | A project with the same name already exists in state.                       | Creating a second "Client Onboarding Q3"      |
| `RULE_EVALUATION_ERROR` | Error encountered during auto-binding rule evaluation.                      | Invalid regex rule pattern                    |
| `UNHANDLED_ERROR`       | General catch-all for unexpected internal execution errors.                 | Unexpected runtime exceptions                 |

---

## 4. Method Contracts & DTOs

### 4.1 `getState()`

Retrieves current binder state.

- **Inputs**: None
- **Output**: `BinderResult<BinderState>`

---

### 4.2 `createProject(input)`

Creates a new project binder collection.

- **Input (`CreateProjectInput`)**:
  ```ts
  {
    name: string;             // Required (non-whitespace)
    description?: string;
    color?: ProjectColor;     // "blue" | "purple" | "green" | "amber" | "rose" | "cyan"
    stellarAddress?: string;
    stellarAssetCode?: string;
    members?: string[];
    rules?: AutoBindingRule[];
  }
  ```
- **Output (`CreateProjectOutput`)**:
  ```ts
  {
    project: BinderProject;
    state: BinderState;
  }
  ```

---

### 4.3 `deleteProject(input)`

Deletes a project binder and unbinds associated mails.

- **Input (`DeleteProjectInput`)**:
  ```ts
  {
    projectId: string; // Required
  }
  ```
- **Output (`DeleteProjectOutput`)**:
  ```ts
  {
    deletedProjectId: string;
    removedMailCount: number;
    state: BinderState;
  }
  ```

---

### 4.4 `bindMail(input)`

Binds an email to an existing project binder.

- **Input (`BindMailInput`)**:
  ```ts
  {
    projectId: string;        // Required
    subject: string;          // Required
    sender: string;           // Required
    date?: string;            // ISO timestamp
    snippet?: string;
    body?: string;
    bindingType?: "automatic" | "manual";
    boundBy?: string;
  }
  ```
- **Output (`BindMailOutput`)**:
  ```ts
  {
    mail: BinderMail;
    state: BinderState;
  }
  ```

---

### 4.5 `unbindMail(input)`

Unbinds an email from its project.

- **Input (`UnbindMailInput`)**:
  ```ts
  {
    mailId: string;           // Required
    projectId?: string;
  }
  ```
- **Output (`UnbindMailOutput`)**:
  ```ts
  {
    unboundMailId: string;
    state: BinderState;
  }
  ```

---

### 4.6 `autoBindMails(input)`

Evaluates active rules against incoming email batches.

- **Input (`AutoBindInput`)**:
  ```ts
  {
    emails: Array<{
      id: string;
      from: string;
      email: string;
      subject: string;
      preview?: string;
      body?: string;
      time?: string;
    }>;
  }
  ```
- **Output (`AutoBindOutput`)**:
  ```ts
  {
    createdBindings: ProjectMailBinding[];
    boundEmailCount: number;
  }
  ```

---

## 5. Usage Example (Headless Backend)

```ts
import { ProjectMailBinderBackendService } from "tools/v2/team/project-mail-binder";

const backendService = new ProjectMailBinderBackendService();

// Create project
const createRes = await backendService.createProject({
  name: "Q4 Audit Prep",
  description: "Correspondence for Q4 internal audit",
  color: "purple",
});

if (!createRes.success) {
  console.error(`[${createRes.error.code}] ${createRes.error.message}`);
} else {
  console.log("Created project ID:", createRes.data.project.id);
}
```
