# Admin Roles & Permissions for Campaign Data Editing

## Design Note

### Purpose

This document defines the future admin role model and permission set for campaign data editing within the Demo Admin Dashboard. It is a **design reference**, not a runtime authorization implementation. No auth middleware, route guards, or role-based access control is built here. The types and matrix exist so that contributors building campaign editors, audit panels, and dataset tools can reason about **which role would eventually perform each action**.

### Roles

| Role               | Intended audience                            | Scope                                               |
| ------------------ | -------------------------------------------- | --------------------------------------------------- |
| `viewer`           | Read-only maintainers, reviewers             | View campaigns, drafts, audit log, dataset, presets |
| `editor`           | Content contributors                         | Create and edit drafts, tag campaigns, export data  |
| `reviewer`         | QA / compliance reviewers                    | Editor rights + rollback snapshots, delete drafts   |
| `campaign-manager` | Campaign operators                           | Full campaign lifecycle (create, edit, publish)     |
| `super-admin`      | Dashboard administrators                     | All permissions including role management            |

### Permission categories

| Category          | Permissions included                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Campaign          | view, create, edit, delete, publish, rollback, assign, tag, export, import               |
| Draft             | view, create, edit, delete                                                               |
| Audit             | view, export                                                                             |
| Role              | view, manage                                                                             |
| Dataset           | view, edit, export, import                                                               |
| Preset            | switch                                                                                   |
| Settings          | view, edit                                                                               |

### Hierarchy rule

Each role inherits all permissions from the role below it:

```
viewer < editor < reviewer < campaign-manager < super-admin
```

A `campaign-manager` can do everything a `reviewer` can, plus campaign creation, editing, deletion, publishing, and importing. A `super-admin` can additionally manage roles.

### Out of scope (not implemented here)

- **Authentication** — No login, session, or token system. Demo users (`DemoUser` in `types.ts`) carry a `role` string but no auth enforcement.
- **Authorization middleware** — No route guards, permission checks, or `roleHasPermission()` calls in dashboard components.
- **Role assignment UI** — No admin panel for assigning roles. `role:manage` is defined as a permission but has no UI.
- **Audit enforcement** — The audit log records who performed an action but does not verify whether that actor was authorized.
- **Integration with production auth** — No wiring to external identity providers, OAuth, or session managers.
- **Fine-grained object-level permissions** — Roles are global (not per-campaign or per-dataset). Per-object ACLs are a future concern.

### Follow-up issues

When runtime authorization is introduced, the following work will be needed:

1. Implement a `PermissionGuard` component or hook that checks `roleHasPermission` before rendering actions.
2. Add route-level guards for the dashboard sections.
3. Surface role assignment in the Settings section.
4. Tie audit log entries to the authenticated actor's role.

### Type reference

| Type                | File                          | Description                         |
| ------------------- | ----------------------------- | ----------------------------------- |
| `AdminRole`         | `types/adminRoles.ts`         | The five role literals              |
| `AdminPermission`   | `types/adminRoles.ts`         | All 25 granular permission literals |
| `RolePermissionMap` | `types/adminRoles.ts`         | Full role-to-permission mapping     |
| `ROLE_PERMISSIONS`  | `types/adminRoles.ts`         | Static permission table             |
| `PERMISSION_DESCRIPTIONS` | `types/adminRoles.ts`    | Human-readable definitions          |
| `DemoUser`          | `types.ts`                    | Existing user shape with `role`     |

### Role matrix

| Permission           | viewer | editor | reviewer | campaign-manager | super-admin |
| -------------------- | ------ | ------ | -------- | ---------------- | ----------- |
| campaign:view        | ✅     | ✅     | ✅       | ✅               | ✅          |
| campaign:create      | —      | —      | —        | ✅               | ✅          |
| campaign:edit        | —      | —      | —        | ✅               | ✅          |
| campaign:delete      | —      | —      | —        | ✅               | ✅          |
| campaign:publish     | —      | —      | —        | ✅               | ✅          |
| campaign:rollback    | —      | —      | ✅       | ✅               | ✅          |
| campaign:assign      | —      | —      | —        | ✅               | ✅          |
| campaign:tag         | —      | ✅     | ✅       | ✅               | ✅          |
| campaign:export      | —      | ✅     | ✅       | ✅               | ✅          |
| campaign:import      | —      | —      | —        | ✅               | ✅          |
| draft:view           | ✅     | ✅     | ✅       | ✅               | ✅          |
| draft:create         | —      | ✅     | ✅       | ✅               | ✅          |
| draft:edit           | —      | ✅     | ✅       | ✅               | ✅          |
| draft:delete         | —      | —      | ✅       | ✅               | ✅          |
| audit:view           | ✅     | ✅     | ✅       | ✅               | ✅          |
| audit:export         | —      | —      | ✅       | ✅               | ✅          |
| role:view            | ✅     | ✅     | ✅       | ✅               | ✅          |
| role:manage          | —      | —      | —        | —                | ✅          |
| dataset:view         | ✅     | ✅     | ✅       | ✅               | ✅          |
| dataset:edit         | —      | ✅     | ✅       | ✅               | ✅          |
| dataset:export       | —      | ✅     | ✅       | ✅               | ✅          |
| dataset:import       | —      | —      | —        | ✅               | ✅          |
| preset:switch        | ✅     | ✅     | ✅       | ✅               | ✅          |
| settings:view        | ✅     | ✅     | ✅       | ✅               | ✅          |
| settings:edit        | —      | —      | —        | ✅               | ✅          |

---

*This design note is Campaign issue 44 of 50 for the Demo Admin Dashboard initiative.*
