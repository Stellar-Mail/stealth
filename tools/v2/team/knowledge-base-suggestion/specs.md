# Knowledge Base Suggestion Specification

## Purpose

Rank internal knowledge-base articles against a query so a team member can review
relevant guidance, with explainable match reasons and expandable corpus filtering.

## Inputs

- Query string from the caller
- Corpus of `KbArticle` snapshots provided through the contract
- Optional `KbCorpusFilter[]` (locale, access, team, product, etc.)
- Optional `limit` for maximum suggestions

The tool must receive these values through a folder-local typed contract. It must
not read the inbox store, authentication context, database, or knowledge-base
provider directly.

## Outputs

- Ranked article suggestions with stable identifiers
- Relevance score and explainable `KbMatchReason[]`
- Pipeline `warnings` (e.g., filter removal counts, invalid corpus)
- Typed success/error `KbResult<T>` outcomes

Outputs are recommendations only. Fetching full article content, enforcing access,
and inserting content into mail are integration concerns outside this issue.

## Functional Boundaries

The mini-product normalizes text, filters candidates via pluggable filters, ranks
articles deterministically, exposes local review data, and provides fixtures and
tests.

It may not mutate mail, index the main database, bypass article permissions, send
messages, create routes, access wallets or Stellar, or call a knowledge-base
provider directly without a separate approved integration issue.

## Contributor Rules

Contributors may:

- Add `KbMatchReason` variants and scoring factors in `core/engine.ts`
- Add `KbCorpusFilter` implementations
- Extend `KbArticle` metadata (e.g., locale, access) used by filters
- Add or refine folder-local types, services, fixtures, and tests

Contributors may not import main-app features, modify global configuration, change
routing or navigation, alter the design system, or move ownership of mail or
knowledge-base records into this tool.
