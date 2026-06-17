# Contributing to the Demo Admin Dashboard

## Scope of this folder

All code, tests, fixtures, documentation, and utilities related to the **Demo Admin Dashboard** must live inside the following directory:

```
src/features/demo-admin-dashboard/
```

The rest of the application should **only** import the public entry points exported from this folder (e.g., `src/features/demo-admin-dashboard/index.ts`). Direct imports from internal files are discouraged to keep the feature isolated.

## Adding new files

- **Components**: place UI components in a `components/` sub‑folder.
- **Types**: add new TypeScript types to `types.ts` or create a dedicated `types/` folder if the file would become large.
- **Helpers / utilities**: put reusable functions under `utils/`.
- **Fixtures & test data**: store deterministic demo data in `fixtures/`.
- **Tests**: locate unit and integration tests alongside the code they test, mirroring the folder hierarchy.

## Import Rules

- **Public API**: Export public symbols from `index.ts`. Consumers must import from the folder root, e.g.:
  ```ts
  import { DemoDashboard } from "src/features/demo-admin-dashboard";
  ```
- **Internal imports**: Only use relative paths within the folder, e.g. `./components/Widget`.
- **No cross‑folder imports**: Do not import files from `src/features/` outside this folder unless a separate issue explicitly requests a shim.

## Documentation

- Update this `CONTRIBUTING.md` for any new conventions.
- Keep documentation in Markdown files under this folder.

## Testing

- Ensure new code has deterministic tests and does not rely on external services.
- Use the provided fixtures for any demo data.

## Review Checklist

- [ ] All changes are confined to `src/features/demo-admin-dashboard/`.
- [ ] Public symbols are exported via `index.ts`.
- [ ] No production mail‑flow code is modified.
- [ ] Demo data remains safe, fake, and deterministic.

For any integration points that require changes outside this folder, open a new issue and document the needed shim instead of modifying the code directly.
