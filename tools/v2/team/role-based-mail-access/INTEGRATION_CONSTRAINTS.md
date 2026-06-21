# Role-Based Mail Access - Integration Constraints

This document defines the constraints and hard isolation boundaries for the Role-Based Mail Access tool.

---

## 1. Golden Rules (Non-Negotiable)

```text
1. Never import from src/ (the main app folder).
2. Never modify files outside tools/v2/team/role-based-mail-access/ (except config files).
3. Never export hooks, services, or components for direct use in the main application.
4. Never query the main app database, Stellar blockchain, or mail engine.
5. Never add routes to src/router.tsx or routeTree.gen.ts.
6. Never depend on main app authentication contexts or session keys.
7. Never call core app API backend routers.
```

---

## 2. Dependency & Imports Control

### ❌ Forbidden Imports

```typescript
// ❌ DO NOT IMPORT core components or utilities
import { MailInbox } from "../../../src/components/inbox";
import { useAuth } from "../../../src/hooks/useAuth";
import { sendPayment } from "../../../src/services/stellar";
import { db } from "../../../src/server/db";
```

### ✅ Allowed Imports

```typescript
// ✅ OK to import local modules
import { checkAccess } from "./guards/access-guards.mjs";
import { useRoleBasedAccess } from "./hooks/use-role-based-access";

// ✅ OK to import standard libraries and Radix components
import React, { useState } from "react";
import { Checkbox } from "@radix-ui/react-checkbox";
```

---

## 3. Allowed vs. Forbidden Modifications

- **Forbidden to Modify**:
  - `src/` (Router, navigation, core database models).
  - `infra/` (Deployment files, configs).
  - `package.json` (Adding new generic third-party packages without maintainer review).
  - `tsconfig.json` & `vite.config.ts`.
- **Allowed to Modify**:
  - Any file located inside `tools/v2/team/role-based-mail-access/`.

---

## 4. Integration Guidelines for Future Tasks

When an integration task is explicitly authorized by a separate issue:

1. **Bridge adapters**: Create a bridge adapter feature under `src/features/` that mounts this tool inside the mail container.
2. **Context mappings**: Map the active team-member role from the database session into the `VerifyAccessRequest` hook.
3. **Database syncing**: Hook into database transaction handlers to update the policy configurations.

**Do not attempt these integrations within this issue.**
