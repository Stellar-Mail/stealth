# Knowledge Base Suggestion Specification

## Purpose

Rank internal knowledge-base articles against a normalized email context so a team
member can review relevant guidance while handling a conversation.

## Future Inputs

- Message and thread identifiers
- Subject and normalized plain-text excerpt
- Optional team, product, locale, and category context
- Candidate article snapshots containing identifiers, titles, summaries, tags,
  locale, revision, and access metadata
- Team-provided ranking configuration

The tool must receive these values through a folder-local typed contract. It must
not read the inbox store, authentication context, database, or knowledge-base
provider directly.

## Future Outputs

- Ranked article suggestions with stable article identifiers
- Relevance score and explainable match reasons
- Article revision and access metadata copied from the input snapshot
- Validation warnings or a typed no-suggestion result

Outputs are recommendations only. Fetching full article content, enforcing access,
and inserting content into mail are integration concerns outside this issue.

## Functional Boundaries

The future mini-product may normalize supplied context, filter inaccessible or
incompatible candidates, rank article snapshots deterministically, expose local
review components, and provide local fixtures and tests.

It may not mutate mail, index the main database, bypass article permissions, send
messages, create routes, access wallets or Stellar, or call a knowledge-base
provider directly without a separate approved integration issue.

## Contributor Rules

Future contributors may add or refine folder-local types, pure ranking logic,
adapter interfaces, local components, fixtures, and tests.

Future contributors may not import main-app features, modify global configuration,
change routing or navigation, alter the design system, or move ownership of mail or
knowledge-base records into this tool.
