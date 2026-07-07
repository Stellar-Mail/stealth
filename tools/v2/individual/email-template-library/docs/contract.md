# Email Template Library Core Contract

This document describes the folder-local core service for future hook and UI
work. It does not authorize any main app integration.

## Public API

Import from `tools/v2/individual/email-template-library/index.mjs`.

```js
import { createTemplateService } from "./index.mjs";
```

## Template Shape

```js
{
  id: "tmpl-follow-up",
  name: "Polite follow-up",
  categoryId: "cat-follow-up",
  subject: "Following up on {{topic}}",
  body: "Hi {{firstName}}, I wanted to follow up on {{topic}}.",
  variables: [
    { key: "firstName", label: "First name" },
    { key: "topic", label: "Topic" }
  ],
  tags: ["follow-up", "customer"],
  updatedAt: "2026-06-02"
}
```

Rules:

- IDs use only letters, numbers, `_`, and `-`.
- `subject` and `body` are required.
- Variables use `{{variableKey}}` placeholders.
- Every placeholder must be declared in `variables`.
- Rendering substitutes only declared variables and reports missing values.

## Service Methods

`createTemplateService({ templates, categories })` returns:

- `getTemplates()`
- `getCategories()`
- `getTemplate(id)`
- `saveTemplate(template)`
- `deleteTemplate(id)`
- `searchTemplates({ query, categoryId, limit })`
- `renderTemplate(id, values)`

The service stores data in local memory only and returns cloned values to avoid
accidental fixture mutation.

## State Shapes

`createTemplateListState` and `searchTemplates` return:

```js
{
  status: "success" | "empty" | "error",
  isLoading: false,
  error: null,
  query: "invoice",
  templates: [],
  totalCount: 0
}
```

`createLoadingState(query)` returns:

```js
{
  status: "loading",
  isLoading: true,
  error: null,
  query: "invoice",
  templates: [],
  totalCount: 0
}
```

## Error State

Validation errors use `EmailTemplateLibraryError` and include a field when the
error is field-specific:

```js
{
  status: "error",
  error: {
    message: "template subject is required",
    field: "subject"
  }
}
```

## Known Limitations

- Data is in-memory only.
- No template persistence, user account sync, analytics, or remote search exists.
- No live network calls or production mail content are introduced.
- Hooks and UI components are future issues.
- Main app compose integration is out of scope for this core issue.
