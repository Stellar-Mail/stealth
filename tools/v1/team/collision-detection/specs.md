# Collision Detection Specs

## Purpose

Prevent duplicate team responses by comparing a draft reply with previous
messages in the same shared mailbox thread.

## Scope

- Release tier: V1
- Audience: team
- Folder ownership: `tools/v1/team/collision-detection/`

The tool must remain self-contained until a future integration issue connects it
to live mail data or the main inbox workflow.

## Candidate Input Shape

The future detector can be reviewed against this minimal input contract:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `threadId` | string | Yes | Stable thread identifier from the caller |
| `draftReply` | object | Yes | Proposed outbound reply |
| `draftReply.authorId` | string | Yes | Team member preparing the response |
| `draftReply.body` | string | Yes | Plain-text body used for comparison |
| `priorResponses` | array | Yes | Earlier team responses in the same thread |
| `priorResponses[].authorId` | string | Yes | Sender of the prior response |
| `priorResponses[].body` | string | Yes | Plain-text body of the prior response |
| `priorResponses[].sentAt` | string | No | ISO timestamp when available |

## Expected Outcomes

| Outcome | Meaning |
| --- | --- |
| `duplicate` | The draft repeats an existing answer closely enough to block by default. |
| `possible_duplicate` | The draft overlaps with a prior answer and needs human review. |
| `distinct` | The draft appears to answer a different request or add new information. |
| `invalid_input` | Required draft or thread data is missing or empty. |

## Review Heuristics

- Exact or near-exact normalized body matches should be `duplicate`.
- Same recipient and same resolution intent with small wording changes should be
  `possible_duplicate`.
- Different task, recipient, or resolution should be `distinct`.
- Empty draft body, missing thread id, or missing response context should be
  `invalid_input`.

## Out of Scope

- No production mailbox reads.
- No automatic sending or blocking behavior.
- No database schema changes.
- No app navigation, dashboard, or routing changes.
- No shared design-system changes.
