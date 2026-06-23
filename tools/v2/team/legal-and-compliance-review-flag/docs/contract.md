# Legal And Compliance Review Flag Contract

## Purpose

The core engine classifies local mail or document-review context to decide
whether a legal or compliance reviewer should inspect it before a team responds.
It is deterministic and folder-local so reviewers can audit behavior without
external services.

## Inputs

`classifyReviewContext(input, rules, options)` accepts:

- `input.id`: stable local context identifier,
- `input.subject`: message or review subject,
- `input.body`: message body or document summary,
- `input.source`: optional source such as `team-mail` or `support-mail`,
- `input.labels`: optional local labels,
- `rules`: local rule objects with `id`, `label`, `severity`, `keywords`, `nextAction`, and `score`.

The engine validates malformed input and does not read production mail, secrets,
network resources, database rows, wallet state, or global app state.

## Outputs

The result shape is:

```js
{
  state: "success" | "empty" | "error",
  ok: boolean,
  errors: string[],
  warnings: string[],
  reviewRequired: boolean,
  severity: "low" | "medium" | "high" | "critical",
  score: number,
  matches: [
    {
      ruleId: string,
      label: string,
      severity: string,
      score: number,
      matchedTerms: string[],
      nextAction: string
    }
  ],
  nextActions: string[]
}
```

## Loading, Empty, Success, And Error States

The engine is synchronous and pure. A future UI hook can wrap local fixture or
cache retrieval in a loading state:

- `loading`: caller is retrieving local rules or cached review context,
- `success`: one or more rules matched the context,
- `empty`: the context is valid but no rules matched or no rules were provided,
- `error`: validation failed and user-facing errors are available.

## Rule Model

Default rules cover contract language, privacy/personal data, regulatory
requests, billing disputes, and security disclosures. A future integration can
replace these rules with a local policy bundle, but should not call external
policy engines from this isolated tool without a separate integration issue.
