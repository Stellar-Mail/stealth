# Email Template Library - Integration Constraints

This document defines the constraints and hard isolation boundaries for the Email Template Library tool.

---

## 1. Golden Rules (Non-Negotiable)

```

1. Never import from src/ (the main app folder).
2. Never modify files outside tools/v2/individual/email-template-library/.
3. Never export hooks, services, or components for direct use in the main application.
4. Never query the main app database, Stellar blockchain, or mail engine.
5. Never add routes to src/router.tsx or routeTree.gen.ts.
6. Never depend on main app authentication contexts or session keys.
7. Never call core app API backend routers.

```

---

## 2. Dependency & Imports Control

### Forbidden Imports

```

// DO NOT import core components or utilities

import { MailInbox } from "../../../src/components/inbox";

import { useAuth } from "../../../src/hooks/useAuth";

import { sendPayment } from "../../../src/services/stellar";

import { db } from "../../../src/server/db";

```

### Allowed Imports

```

// OK to import local modules

import { createTemplateService } from "./services/template.service";

import { useEmailTemplateLibrary } from "./hooks/use-email-template-library";

// OK to import standard libraries and presentational assets

import React, { useState } from "react";

import { Copy } from "lucide-react";

```

---

## 3. Allowed vs. Forbidden Modifications

- **Forbidden to Modify**:
  - `src/` (router, navigation, core database models).
  - `infra/` (deployment files, configs).
  - `package.json` (adding generic third-party packages without maintainer review).
  - `tsconfig.json` & `vite.config.ts`.
- **Allowed to Modify**:
  - Any file located inside `tools/v2/individual/email-template-library/`.

---

## 4. Integration Guidelines for Future Tasks

When an integration task is explicitly authorized by a separate issue:

1. **Bridge adapters**: Create a bridge adapter under `src/features/` that mounts this tool inside the compose experience.
2. **Context mappings**: Map the active user profile into default template variable values.
3. **Persistence syncing**: Hook into a storage layer to persist user templates.

**Do not attempt these integrations within this issue.**
