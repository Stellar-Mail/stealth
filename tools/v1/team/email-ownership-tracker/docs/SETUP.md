# Email Ownership Tracker Setup

No tool-specific dependencies are required. Use the repository root toolchain.

```bash
npm install
npx vitest run --config tools/v1/team/email-ownership-tracker/vitest.config.ts
```

All implementation files for this issue are intentionally scoped to:

```text
tools/v1/team/email-ownership-tracker/
```

The tool is pure TypeScript and does not require a browser, localStorage,
network access, or database setup.
