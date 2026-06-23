# Email Template Library Contract

## Purpose

The core service stores and renders individual email templates in memory. It is
designed as an isolated V2 tool engine that future UI work can wrap without
connecting to the main app.

## Inputs

`createTemplateService({ initialTemplates, categories })` accepts deterministic
local fixtures:

- template `id`, `name`, `categoryId`, `subject`, `body`, and `variables`,
- category `id` and `name`,
- render values as a plain object keyed by declared variable names.

Template placeholders use `{{variableName}}` syntax. Variable keys must start
with a letter and contain only letters, numbers, or underscores.

## Outputs

The service exposes:

- `listTemplates()` and `listCategories()` for cloned read models,
- `getTemplate(id)` for a single cloned template or `null`,
- `saveTemplate(template)` for create/update results,
- `deleteTemplate(id)` for deterministic delete results,
- `searchTemplates(query, options)` for text/category search,
- `renderTemplate(id, values)` for rendered subject/body and missing variables.

## Loading, Empty, Success, And Error States

The service is synchronous and pure. A future hook can wrap it in UI state:

- `loading`: caller is loading local fixture data or storage adapters,
- `empty`: `listTemplates()` or `searchTemplates()` returns an empty array,
- `success`: service methods return `ok: true` or non-empty read models,
- `error`: validation or unknown-template results return `ok: false`.

## Isolation

This implementation does not persist data, read production mail, call network
services, query databases, use authentication context, or modify main app routes.
Durable storage and compose integration should be handled by future issues.
