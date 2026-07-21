# Mail-to-Ticket Converter Specification

## Purpose

Convert a normalized email into a ticket draft that a team member can review
before a future integration submits it to an external ticket system.

## Future Inputs

- Message identifier and thread identifier
- Subject and plain-text body
- Sender and recipient metadata
- Received timestamp
- Optional attachments represented as metadata only
- Team-provided conversion rules and destination project identifier

The tool must receive these values through a folder-local typed contract. It must
not read the main inbox store, authentication context, or database directly.

## Future Outputs

- Ticket title and description
- Source message reference
- Suggested priority, labels, and assignee identifiers
- Attachment references without attachment content mutation
- Validation warnings that require team review

Conversion produces a draft. Creating a ticket in an external system is an
integration concern and is outside this issue.

## Functional Boundaries

The future mini-product may normalize email input, apply deterministic mapping
rules, produce ticket drafts, expose local review components, and provide local
fixtures and tests.

It may not send mail, mutate inbox data, create routes, access wallets or Stellar,
write to the application database, or call a ticket provider directly without a
separate approved integration issue.

## Contributor Rules

Future contributors may add or refine folder-local types, pure conversion logic,
adapters defined behind local interfaces, local UI components, fixtures, and tests.

Future contributors may not import main-app features, modify global configuration,
change routing or navigation, alter the design system, or move ownership of source
mail data into this tool.
