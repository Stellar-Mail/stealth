# Message Template Registry

The message template registry groups deterministic demo templates into review
scenarios that maintainers can use when populating demo inbox data.

## Files

- `templates/messageTemplates.ts` owns the template catalog.
- `templates/templateRegistry.ts` owns scenario metadata and registry helpers.
- `templates/templateToDraft.ts` converts a selected template into a local
  `Draft` without mutating production mail state.

## Scenario metadata

Each `MessageTemplateScenario` includes:

- `id`: stable scenario identifier.
- `label`: short maintainer-facing label.
- `description`: what the scenario demonstrates.
- `templateIds`: ordered template ids from the catalog.
- `metadata.demoGoal`: why maintainers would load this scenario.
- `metadata.safeDataNotes`: review notes proving the data is fake and safe.
- `metadata.previewSurface`: the dashboard area expected to preview it.

## Registry helpers

- `buildTemplateRegistry(templates, scenarios)` returns deterministic scenario
  entries with resolved template objects.
- `getTemplatesForScenario(id, templates, scenarios)` returns the templates for
  one known scenario, or an empty list for an unknown id.
- `validateTemplateRegistry(templates, scenarios)` reports duplicate scenario
  ids and missing template references.

## Safety

The registry adds metadata only. It does not import production mail data, call
network services, send email, persist drafts, or touch files outside
`src/features/demo-admin-dashboard/`.
