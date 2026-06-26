# Security & Threat Model: Project Mail Binder

## Overview

The Project Mail Binder tool links email threads to project records, creating associations between mail and structured project data. Because it bridges two data domains (mail and project management), it introduces a surface area for injection, data leakage, and privilege misuse.

## Threat Assumptions

### 1. Unbounded Bind Operations (DoS)

An attacker or misbehaving client could submit a request that binds thousands of mail threads to a single project, or binds a single thread to thousands of projects. This saturates the relationship index, triggers excessive database writes, and degrades query performance for the entire workspace.

### 2. Cross-Tenant / Cross-Project ID Injection

A user from Workspace A could attempt to bind a thread to a project ID that belongs to Workspace B. Without strict ownership validation, this could expose another team's project metadata or silently create phantom relationships.

### 3. Malformed or Hostile Thread IDs

Thread IDs passed as bind targets could contain SQL injection fragments, null bytes, or excessively long strings designed to crash parsers or bypass format checks. Example hostile inputs:

- `"' OR 1=1 --"`
- `"\x00invalid"`
- A 10,000-character string masquerading as an ID

### 4. Recursive Bind Loops

A tool that supports project-to-project linking as a future feature could be abused to create circular references (Project A → Project B → Project A). Without cycle detection, queries over the project graph could recurse infinitely.

### 5. Metadata Injection via Thread Subject / Sender

If thread metadata (e.g., subject line, sender display name) is copied into the project record at bind time, a hostile sender could craft a subject line that injects HTML or script tags into project views.

## Unsafe Inputs

| Input Field     | Unsafe Condition                                           |
| --------------- | ---------------------------------------------------------- |
| `thread_id`     | Non-UUID format, null bytes, SQL fragments, empty string   |
| `project_id`    | Non-UUID format, belongs to a different tenant/workspace   |
| `thread_ids[]`  | Array length exceeding the maximum bind cap                |
| `project_ids[]` | Array length exceeding the maximum bind cap                |
| `metadata`      | Contains raw HTML, script tags, or oversized string fields |
| `label`         | Unescaped special characters intended for rendering        |

## Mitigation Strategy

- Use the `sanitizeBindRequest` and `validateBindOwnership` helpers in `guards.ts` on every inbound bind operation.
- Reject all inputs that fail UUID validation before any database query is attempted.
- Strip or escape HTML from any string field that will be surfaced in a project view.
- Enforce a hard cap on simultaneous binds per request.
- Never pass raw thread content (body, attachments) into the project record — bind by reference only (ID + preview snippet capped at 200 characters).
