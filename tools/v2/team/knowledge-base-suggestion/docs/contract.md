# Knowledge Base Suggestion Contract

This document describes the folder-local core engine for future UI and hook work.
It is intentionally isolated from the main app.

## Public API

Import from `tools/v2/team/knowledge-base-suggestion/index.mjs`:

```js
import {
  suggestKnowledgeBaseArticles,
  createKnowledgeBaseSuggestionService,
} from "./index.mjs";
```

## Request Input

```js
{
  query: "Customer needs an invoice receipt",
  threadId: "thread-billing-002",
  category: "billing",
  productArea: "billing",
  tags: ["invoice"],
  maxResults: 3
}
```

Rules:

- `query` is required and capped at 500 characters.
- `threadId` is optional and must contain only letters, numbers, `_`, or `-`.
- `category` is optional and must be one of the local allowlisted categories.
- `productArea` is optional and sanitized as text.
- `tags` are optional, capped, and sanitized.
- `maxResults` is capped at 10.

## Article Fixture Input

Local article fixtures include:

- `id`
- `title`
- `summary`
- `body`
- `category`
- `status`
- `url`
- `productAreas`
- `tags`
- `keywords`
- `relatedQuestions`
- `updatedAt`

Only `published` articles can be suggested. Draft and archived articles score as
zero.

## Output States

### Loading

```js
{
  status: "loading",
  isLoading: true,
  error: null,
  query: "Customer needs an invoice receipt",
  suggestions: [],
  totalArticlesEvaluated: 0
}
```

### Success

```js
{
  status: "success",
  isLoading: false,
  error: null,
  query: "Customer needs an invoice receipt",
  suggestions: [
    {
      articleId: "kb-download-invoices",
      title: "Download invoices and receipts",
      summary: "Where billing admins can find invoices...",
      category: "billing",
      url: "/kb/billing/download-invoices",
      score: 33,
      confidence: "high",
      matchedTerms: ["billing", "invoice", "receipt"],
      reasons: ["Category match: billing."]
    }
  ],
  totalArticlesEvaluated: 6
}
```

### Empty

```js
{
  status: "empty",
  isLoading: false,
  error: null,
  query: "banana telescope garden question",
  suggestions: [],
  totalArticlesEvaluated: 6
}
```

### Error

```js
{
  status: "error",
  isLoading: false,
  error: {
    message: "query is required",
    field: "query"
  },
  query: "",
  suggestions: [],
  totalArticlesEvaluated: 0
}
```

## Scoring Model

The engine uses deterministic keyword scoring:

- Category match: +6
- Product area match: +5
- Title token match: +5 each
- Keyword match: +4 each
- Tag match: +4 each
- Related question match: +3 each
- Summary match: +2 each
- Body match: +1 each

The same request and article list always produce the same order.

## Loading and Error Behavior

`createKnowledgeBaseSuggestionService()` wraps the pure suggestion engine in a
mock async service for future UI testing. It can simulate latency or a failure
without adding any network calls.

## Known Limitations

- This is not semantic search.
- It does not call an LLM or external search index.
- It does not read production inbox content.
- It does not persist analytics or suggestion history.
- It is not wired into any UI route yet.
