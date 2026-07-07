# Knowledge Base Suggestion

Folder-local V2 team tool for suggesting internal knowledge base articles from a
support or team-mail context.

This contribution implements the isolated core feature engine only. It does not
wire the tool into the main app, inbox, routing, database, wallet, Stellar
integration, or design system.

## Ownership Boundary

All work for this tool must stay inside:

```
tools/v2/team/knowledge-base-suggestion/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core,
Stellar integration, database schema, or design system unless a future integration
issue explicitly allows it.

## Folder Structure

```
knowledge-base-suggestion/
  docs/
    contract.md                         API, states, fixtures, limitations
  fixtures/
    knowledge-base-fixtures.json        Synthetic article and request data
  services/
    knowledge-base-suggestion.service.mjs
                                         Pure validation, scoring, and state logic
  tests/
    knowledge-base-suggestion.test.mjs  Node built-in tests
  index.mjs                             Folder-local public API
  README.md
  specs.md
```

## Setup

No install step is required. The service and tests use Node built-ins only.

Requirements:

- Node 18 or later.
- Run commands from the repository root unless noted otherwise.

## Running Tests

From the repository root:

```
node --test tools/v2/team/knowledge-base-suggestion/tests/knowledge-base-suggestion.test.mjs
```

From this folder:

```
node --test tests/knowledge-base-suggestion.test.mjs
```

## Core API

The folder-local API is exported from `index.mjs`:

- `suggestKnowledgeBaseArticles(input, options)` returns a deterministic
  `success` or `empty` state with ranked suggestions.
- `scoreKnowledgeBaseArticle(article, request)` returns scoring details for one
  article and one validated request.
- `validateSuggestionRequest(input)` validates and sanitizes request input.
- `validateKnowledgeBaseArticle(article)` validates local article fixture shape.
- `createLoadingState(query)`, `createEmptyState(query)`, and
  `createErrorState(error, query)` create UI-ready state objects.
- `createKnowledgeBaseSuggestionService(options)` creates a mock async service
  around local fixtures for future UI work.

## Input Shape

```js
{
  query: "how do I reset my password",
  threadId: "thread-support-001",
  category: "account",
  productArea: "login",
  tags: ["password", "login"],
  maxResults: 3
}
```

## Output States

The engine returns one of these state shapes:

- `loading`: request has started, suggestions are empty, no error.
- `success`: ranked suggestions are available.
- `empty`: the request was valid, but no article passed the score threshold.
- `error`: validation or service failure details are available.

See `docs/contract.md` for full input, output, loading, empty, success, and error
state details.

## Fixtures

`fixtures/knowledge-base-fixtures.json` contains:

- Synthetic knowledge base articles.
- Synthetic request contexts.
- Expected top suggestions for deterministic tests.

No fixture contains real users, production inbox content, credentials, wallet
values, secrets, or live network references.

## Known Limitations

- Ranking is deterministic keyword scoring, not semantic search or an LLM.
- The mock async service uses local memory only; it has no persistence layer.
- No live network calls, search index, analytics event, or production data source
  is introduced.
- UI components and hooks are future issues.
- Main app integration is intentionally out of scope.

## Acceptance Checklist

- [x] Core logic is implemented without linking into the main app.
- [x] Inputs, outputs, loading states, and error states are documented.
- [x] Deterministic local fixtures are included.
- [x] No live network calls, secrets, or production data are introduced.
- [x] Files changed by this issue are limited to this tool folder.
