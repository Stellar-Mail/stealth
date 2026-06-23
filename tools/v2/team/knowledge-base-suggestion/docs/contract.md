# Knowledge Base Suggestion Contract

## Purpose

The core engine suggests local knowledge base articles for an inbound team mail
or support context. It is intentionally deterministic so reviewers can inspect
the matching behavior without external services.

## Inputs

`suggestKnowledgeBaseArticles(input, articles, options)` accepts:

- `input.id`: stable mail or support context identifier,
- `input.subject`: short user-visible subject,
- `input.body`: message body or issue description,
- `input.teamId`: optional team scope such as `support` or `security`,
- `input.labels`: optional local labels already assigned by a caller,
- `articles`: local article fixtures with `id`, `title`, `summary`, `keywords`, optional `tags`, optional `teamIds`, `priority`, and `href`.

The engine validates malformed input and does not read production mail, secrets,
network resources, or global app state.

## Outputs

The result shape is:

```js
{
  state: "success" | "empty" | "error",
  ok: boolean,
  errors: string[],
  warnings: string[],
  suggestions: [
    {
      articleId: string,
      title: string,
      summary: string,
      href: string | null,
      score: number,
      matchedTerms: string[],
      reasons: string[]
    }
  ]
}
```

## Loading, Empty, Success, And Error States

The engine is synchronous and pure; a future UI hook can wrap it in async loading
state if it later reads from a local cache. Suggested UI state mapping:

- `loading`: caller is retrieving local article fixtures or cache data,
- `success`: `state === "success"` and at least one suggestion exists,
- `empty`: `state === "empty"` with no article passing `minScore`,
- `error`: `state === "error"` with validation messages in `errors`.

## Matching Rules

The scoring model is intentionally simple:

- shared tokens between the mail context and article title/summary/keywords,
- optional `teamId` match,
- optional label/tag match,
- small boost for high-priority articles.

This is enough for a reviewable core feature without embedding machine learning,
live search, secrets, or production data.
