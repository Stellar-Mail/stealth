# Unsubscribe Finder Specs

## Purpose

Define a self-contained review contract for detecting unsubscribe opportunities
before any future inbox, link-following, or mailbox mutation integration.

## Release Scope

- Release tier: V2 later-release tool
- Audience: individual
- Folder ownership: `tools/v2/individual/unsubscribe-finder/`
- Integration status: isolated mini-product workspace

## In-Scope Behavior

- Model email records with synthetic unsubscribe signals.
- Distinguish safe unsubscribe candidates from suspicious links.
- Represent ignored transactional emails without side effects.
- Provide fixture coverage for each local candidate status.
- Export a non-UI service boundary that can run without presentation code.
- Give reviewers local test commands for contract and service validation.

## Out-of-Scope Behavior

- Main app routing or dashboard registration
- Inbox ingestion, mail rendering, or mailbox mutation changes
- Automatic link following or one-click unsubscribe execution
- Sender reputation services or external API calls
- Database schema or shared design system changes

## Unsubscribe Candidate Contract

Each expected candidate should include:

- `id`: stable fixture-local candidate identifier
- `sender`: sender display name or domain
- `method`: one of `header`, `body-link`, `none`
- `status`: one of `detected`, `needs-review`, `unsafe`, `ignored`
- `confidence`: number from 0 to 1
- `safeToOffer`: boolean that controls whether the UI can offer this action
- `sourceMessageId`: source email identifier
- `reason`: short review note for the status choice

## Service Contract

The folder exposes a backend-facing service entry point at `index.ts`:

```ts
import { analyzeUnsubscribeCandidates } from "./index.ts";
```

The service accepts this request shape:

```ts
export interface UnsubscribeFinderRequest {
  tool: "unsubscribe-finder";
  version: 1;
  sourceMessages: UnsubscribeFinderSourceMessage[];
}
```

Each source message must be a synthetic email record with:

- `id`
- `type: "email"`
- `from`
- `subject`
- `receivedAt`
- `hasListUnsubscribeHeader`
- `bodyContainsUnsubscribeLink`
- `isTransactional`
- `linkHost`

The service returns one of two response shapes:

```ts
export interface UnsubscribeFinderSuccess {
  status: "ok";
  tool: "unsubscribe-finder";
  version: 1;
  candidates: UnsubscribeFinderCandidate[];
  summary: UnsubscribeFinderSummary;
  reviewNotes: string[];
}

export interface UnsubscribeFinderFailure {
  status: "error";
  tool: "unsubscribe-finder";
  version: 1;
  error: UnsubscribeFinderError;
}
```

## Error Codes

- `INVALID_REQUEST`: the request envelope is missing or has the wrong tool.
- `EMPTY_SOURCE_MESSAGES`: the request contains no source messages.
- `INVALID_SOURCE_MESSAGE`: a source message is missing required fields or
  contains the wrong data types.
- `UNSUPPORTED_VERSION`: the request uses a version the local service does not
  recognize.

## Service Boundary

The folder-local service is intentionally pure and has no UI dependencies,
network calls, or mailbox mutation behavior. It is safe to import from backend
or test code while the folder remains isolated from presentation concerns.

## Review Rules

- standards-based header candidates may be detected when confidence is high
- body-link candidates require review unless a future security issue says
  otherwise
- unsafe links must never be offered as an action
- transactional messages without unsubscribe signals should be ignored
- every candidate must map back to a source message

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Contributor Boundary

Keep all changes for this issue in this folder. If a future issue adds live
unsubscribe actions, it should define link safety, consent, audit, and rollback
constraints before connecting this tool to production mailboxes.
