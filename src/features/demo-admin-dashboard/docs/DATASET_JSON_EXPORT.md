# Draft dataset JSON export

Admin helper for exporting the current draft dataset as formatted JSON, part of
the Demo Admin Dashboard initiative (issue #190).

## What it does

- `serializeDraftDataset(drafts, indent?)` — returns deterministic, pretty
  printed JSON in the shape `{ version, count, drafts }`. Drafts are normalized
  to known fields only, so nothing extra leaks into a shared export, and no
  timestamps are embedded, keeping the output stable for review and tests.
- `serializeDraftDatasetState(state, indent?)` — serializes `state.drafts`.
- `buildExportFilename(date, prefix?)` — builds
  `draft-dataset-export-YYYY-MM-DD.json` using a UTC date passed in by the caller.
- `<ExportDatasetButton drafts={...} />` — renders a button that serializes the
  drafts and triggers a browser download. DOM side effects are guarded so it is
  safe under SSR and in tests; an optional `onExport` callback exposes the payload.

## Scope

All code lives under `src/features/demo-admin-dashboard/`. Data is fake and
deterministic, with no network calls or secrets. Wiring the button into the
dashboard shell is a deliberate follow-up.
