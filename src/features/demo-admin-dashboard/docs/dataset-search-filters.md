# Dataset Search & Filter Helpers

**Issue:** #218
**Scope:** `src/features/demo-admin-dashboard/`

This module provides search and filtering utilities for demo admin dashboard datasets.
All data is fake, deterministic, and safe for public repository review.

## Types

- `Draft` — draft message shape
- `DraftFilters` — supported draft filter fields
- `Persona` — persona record shape
- `PersonaFilters` — supported persona filter fields

## Helpers

### Draft helpers

- `scoreDraftMatch(draft, query)` — relevance score for draft search
- `searchDrafts(drafts, query)` — sort matched drafts by score
- `filterDrafts(drafts, filters)` — apply subject, body, recipient, and query filters

### Persona helpers

- `scorePersonaMatch(persona, query)` — relevance score for persona search
- `searchPersonas(personas, query)` — sort matched personas by score
- `filterPersonas(personas, filters)` — apply name, email, stellar address, and query filters

## Validation

Run the unit tests for the dataset filter helpers with:

```bash
cd src/features/demo-admin-dashboard
npx vitest run __tests__/datasetFilters.test.ts
```
