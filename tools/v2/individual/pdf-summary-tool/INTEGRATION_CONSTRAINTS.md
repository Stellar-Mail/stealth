# PDF Summary Tool - Integration Constraints

This document explicitly lists what this tool **can and cannot do** to ensure it remains isolated and doesn't break the main application.

## Golden Rules

### 🚫 The Hard Boundaries

These boundaries are **non-negotiable**. Breaking them will cause issues to be rejected.

```
1. Never import from src/
2. Never modify files outside tools/v2/individual/pdf-summary-tool/
3. Never export from this tool for use in main app
4. Never access main app's database, wallet, or mail engine
5. Never wire into main app's routing or navigation
6. Never depend on main app's authentication
7. Never call main app's server APIs
```

If you need something from the main app, **request it as a separate integration issue** after this tool is complete.

---

## Forbidden Imports

### ❌ DO NOT IMPORT

```typescript
// ❌ Main app components
import { MailComponent } from "../../../src/components/mail";
import { ComposeDraft } from "../../../src/features/compose";

// ❌ Main app services
import { sendEmail } from "../../../src/services/mail";
import { getBalance } from "../../../src/services/wallet";
import { submitTransaction } from "../../../src/services/stellar";

// ❌ Main app hooks
import { useMailContext } from "../../../src/features/mail/hooks";
import { useWalletContext } from "../../../src/features/ledger/hooks";
import { useAuth } from "../../../src/services/auth";

// ❌ Main app routing
import { useRouter } from "../../../src/router";
import { Navigate } from "../../../src/routes";

// ❌ Main app stores
import { useMailStore } from "../../../src/stores/mail";
import { useUserStore } from "../../../src/stores/user";

// ❌ Main app server APIs
import { apiClient } from "../../../src/server/api";
import { fetchFromServer } from "../../../src/server/router";

// ❌ Main app database
import { db } from "../../../src/server/db";
import { schema } from "../../../src/server/schema";

// ❌ Main app types
import type { Mail } from "../../../src/types/mail";
import type { User } from "../../../src/types/user";

// ❌ Relative imports from src
import { something } from "../../src/features/something";
```

### ✅ DO IMPORT

```typescript
// ✅ Within tool boundary
import { usePDFSummary } from "../hooks/usePDFSummary";
import { extractText } from "../services/pdfProcessing";
import type { Summary } from "../types";

// ✅ React and standard library
import React, { useState, useEffect } from "react";
import { readAsArrayBuffer } from "some-util-lib";

// ✅ Design system allowed (for styling only)
import { Button } from "@radix-ui/react-button";
import { Input } from "@radix-ui/react-input";
// But: Do not import main app's components that wrap these

// ✅ External libraries (must be in package.json)
import * as pdfjsLib from "pdfjs-dist";

// ✅ Types from TypeScript standard library
import type { ReactNode } from "react";
import type { PropsWithChildren } from "react";
```

---

## Forbidden Modifications

### ❌ DO NOT MODIFY

```
src/
├── router.tsx                  ❌ Never add routes for PDF Summary Tool
├── routeTree.gen.ts            ❌ Never regenerate
├── server/                     ❌ Never add server endpoints
├── routes/                     ❌ Never add route files
├── features/                   ❌ Never add features here
├── components/                 ❌ Never add components here
├── services/                   ❌ Never add services here
├── hooks/                      ❌ Never add hooks here
├── stores/                     ❌ Never add stores here
└── types/                      ❌ Never add types here

infra/                          ❌ Never modify infrastructure
contracts/                      ❌ Never modify contracts
docs/                           ❌ Never modify docs (except tool-specific docs in this folder)
package.json                    ❌ Never add dependencies for this tool here
tsconfig.json                   ❌ Never modify
vite.config.ts                  ❌ Never modify
eslint.config.js                ❌ Never modify
```

### ✅ CAN MODIFY

```
tools/v2/individual/pdf-summary-tool/
├── Any file in this folder     ✅ Yes
├── components/                 ✅ Yes
├── services/                   ✅ Yes
├── hooks/                      ✅ Yes
├── tests/                      ✅ Yes
├── docs/                       ✅ Yes
├── fixtures/                   ✅ Yes
├── types/                      ✅ Yes
├── utils/                      ✅ Yes
├── config/                     ✅ Yes
└── Any new subfolder           ✅ Yes (if documented)
```

---

## Forbidden Functionality

### 🚫 Network & Server Access

```typescript
// ❌ DO NOT make network calls to main app server
const response = await fetch("/api/mail/send");

// ❌ DO NOT use server router
import { api } from "../../../src/server/router";

// ❌ DO NOT sync with main app backend
const summaries = await syncWithServer();

// ✅ Local only: OK to use browser APIs
const data = localStorage.getItem("pdf-summary-tool:summaries");
const file = await blob.arrayBuffer();
```

### 🚫 Authentication & Identity

```typescript
// ❌ DO NOT access user authentication
const user = useAuth().user;

// ❌ DO NOT check user permissions
if (user.hasPermission("pdf:summarize")) {
}

// ❌ DO NOT use user ID from main app
const userId = useUserContext().id;

// ✅ Tool works for any user locally
const summaries = loadLocalSummaries();
```

### 🚫 Wallet & Blockchain

```typescript
// ❌ DO NOT access wallet
const balance = await getWalletBalance();

// ❌ DO NOT access Stellar core
const transaction = await submitStellarTransaction();

// ❌ DO NOT use blockchain state
const account = await getStellarAccount();

// ✅ Tool is blockchain-agnostic
const summary = await generateSummary(text);
```

### 🚫 Mail Engine

```typescript
// ❌ DO NOT read mail
const emails = await getInboxEmails();

// ❌ DO NOT parse email structure
const parsed = parseEmailParts(email);

// ❌ DO NOT access mail attachments
const attachment = email.attachments[0];

// ✅ User manually selects PDF
const file = userSelectedFile;
```

### 🚫 Database

```typescript
// ❌ DO NOT query main app database
const records = await db.mail.findMany();

// ❌ DO NOT write to main app database
await db.summary.create({/* ... */});

// ❌ DO NOT use main app schema
import { schema } from "../../../src/server/schema";

// ✅ Use browser storage only
localStorage.setItem("pdf-summary-tool:data", JSON.stringify(data));
```

---

## Forbidden Exports

### ❌ DO NOT EXPORT FOR MAIN APP

This tool should **never be imported by the main app**. If the main app needs PDF summarization, that's a separate integration issue.

```typescript
// ❌ DO NOT create exports like this
export { PDFSummaryTool } from "./components/Tool";
export { usePDFSummary } from "./hooks/usePDFSummary";
export * from "./services";

// If main app wants to use this tool, it should:
// 1. Create a new feature in src/features/pdf-summary-integration/
// 2. Wrapper component that imports from tools/v2/individual/pdf-summary-tool/
// 3. Document the integration in a separate issue

// Current state: This tool is NOT exported or used by main app
```

---

## Forbidden Patterns

### 🚫 Global State

```typescript
// ❌ DO NOT use main app's global state
import { useMailStore } from "../../../src/stores/mail";

// ✅ Use local state only
const [summaries, setSummaries] = useState([]);
```

### 🚫 Context Crossing

```typescript
// ❌ DO NOT read from main app contexts
const { user } = useContext(MainAppContext);

// ✅ Create tool-local contexts if needed
const PdfSummaryContext = createContext<PdfSummaryState | null>(null);
```

### 🚫 Side Effects to Main App

```typescript
// ❌ DO NOT trigger main app side effects
useEffect(() => {
  mainAppStore.setSomething(summary);
}, [summary]);

// ✅ Local effects only
useEffect(() => {
  localStorage.setItem("pdf-summary-tool:summaries", JSON.stringify(summaries));
}, [summaries]);
```

### 🚫 Dynamic Imports from Main App

```typescript
// ❌ DO NOT dynamically import from main app
const module = await import("../../../src/features/" + feature);

// ✅ Static imports from tool only (if needed)
import { helper } from "../utils/helper";
```

---

## Configuration Constraints

### 🚫 Tool Configuration

This tool should NOT require changes to:

- ✅ Can add tool-specific config in `config/`
- ✅ Can add tool-specific environment variables in `.env` if necessary
- ❌ Cannot modify main app's `vite.config.ts`
- ❌ Cannot modify main app's `tsconfig.json`
- ❌ Cannot modify main app's `eslint.config.js`
- ❌ Cannot add dependencies to main app's `package.json`

---

## Dependency Constraints

### 🚫 Dependencies

If you need an external library:

1. **Check if it's already in package.json** - Reuse existing dependencies
2. **If not in package.json** - Can only add if:
   - It's a standalone library (doesn't conflict with main app)
   - It doesn't modify global state
   - It's only used locally (not exported)
   - Size is reasonable

3. **DO NOT add:**
   - Dependencies that conflict with main app versions
   - Dependencies that require build config changes
   - Dependencies that modify global state

**Example allowed:**

```json
{
  "dependencies": {
    "pdfjs-dist": "^4.0.0" // ✅ OK - specific to tool
  }
}
```

**Example NOT allowed:**

```json
{
  "dependencies": {
    "react": "^19.0.0" // ❌ NO - already in main app, don't change version
  }
}
```

---

## Testing Constraints

### ✅ Allowed Testing

- ✅ Unit tests in `tests/unit/`
- ✅ Integration tests in `tests/integration/`
- ✅ E2E tests in `tests/e2e/` (isolated from main app)
- ✅ Local fixtures in `fixtures/`
- ✅ Mock localStorage in tests
- ✅ Mock external libraries in tests

### ❌ Forbidden Testing

- ❌ Integration tests with main app
- ❌ Tests that modify main app files
- ❌ Tests that import from main app
- ❌ E2E tests that navigate main app routes

---

## Error Handling

### Allowed

```typescript
// ✅ Handle errors locally
try {
  const text = await extractText(file);
} catch (error) {
  setError("Failed to extract PDF text");
}
```

### Forbidden

```typescript
// ❌ DO NOT report errors to main app's error handler
import { reportError } from "../../../src/services/errorReporting";
reportError(error, { tool: "pdf-summary" });

// ❌ DO NOT use main app's Sentry integration
Sentry.captureException(error, { tags: { tool: "pdf-summary" } });
```

---

## Performance Constraints

### ✅ Allowed Optimizations

- ✅ Memoize components with `React.memo()`
- ✅ Optimize hooks with `useCallback()`, `useMemo()`
- ✅ Lazy load PDF.js
- ✅ Use virtual scrolling for large summaries list
- ✅ Debounce settings changes

### ❌ Forbidden Optimizations

- ❌ DO NOT add performance instrumentation to main app
- ❌ DO NOT monkey-patch main app functions
- ❌ DO NOT modify main app's bundle size

---

## Styling Constraints

### ✅ Allowed Styling

- ✅ Use Radix UI components (already in main app)
- ✅ Write local CSS modules
- ✅ Use Tailwind if already configured
- ✅ Import from existing design tokens if publicly exported

### ❌ Forbidden Styling

- ❌ DO NOT modify main app's design system
- ❌ DO NOT add new global styles
- ❌ DO NOT modify design system tokens
- ❌ DO NOT override existing styles globally

---

## Documentation Constraints

### ✅ Allowed Documentation

- ✅ Local README in `pdf-summary-tool/`
- ✅ Architecture docs in this folder
- ✅ API documentation in `docs/`
- ✅ Code comments and docstrings
- ✅ Contributing guidelines

### ❌ Forbidden Documentation

- ❌ DO NOT add to main app's docs
- ❌ DO NOT modify main app's README
- ❌ DO NOT add to main app's architecture guide

---

## Checklist: Are You Violating Constraints?

```
Before submitting a PR, check:

[ ] No imports from src/
[ ] No modifications outside tools/v2/individual/pdf-summary-tool/
[ ] No new routes added
[ ] No new server endpoints
[ ] No database modifications
[ ] No authentication changes
[ ] No wallet/blockchain access
[ ] No mail engine modifications
[ ] All tests pass locally
[ ] No main app files modified
[ ] No exports for main app use
[ ] No new package.json dependencies (or checked with team)
[ ] ARCHITECTURE.md is updated if boundaries changed
[ ] README.md documents new modules if added
[ ] Code stays within defined module boundaries

If any of these are false, your PR will be rejected.
```

---

## Exception Process

**What if you need to break a constraint?**

1. **Don't break it quietly** - Discuss in an issue first
2. **Document the exception** - Why is this necessary?
3. **Create follow-up issue** - For proper integration later
4. **Get approval** - Team reviews before merging

**But realistically:** There should be almost no exceptions. This tool is designed to be completely isolated.

---

## Review Checklist for Maintainers

When reviewing PRs for this tool:

```
[ ] All changes are within tools/v2/individual/pdf-summary-tool/
[ ] No new imports from src/
[ ] Module boundaries respected
[ ] Data ownership respected
[ ] Tests cover new functionality
[ ] Documentation updated
[ ] No main app files modified
[ ] ARCHITECTURE.md is current
[ ] No circular dependencies
[ ] All constraints followed
```

If any fail, request changes.

---

## References

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Full architecture
- [MODULE_BOUNDARIES.md](./MODULE_BOUNDARIES.md) - Module specifications
- [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) - Data flow
- [CONTRIBUTOR_GUIDE.md](./CONTRIBUTOR_GUIDE.md) - How to contribute
