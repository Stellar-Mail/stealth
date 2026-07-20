# Manager Review Queue

Manager Review Queue gives team leads a local queue for approving, rejecting,
or escalating review requests. This folder is a self-contained mini-product
workspace for the V2 later-release tool.

## Scope

- Release tier: V2
- Audience: Team
- Folder ownership: `tools/v2/team/manager-review-queue/`

This is a self-contained tooling workspace. Do not wire this tool into the main
app, routing, inbox architecture, wallet core, Stellar core, database schema, or
design system unless a future integration issue explicitly allows it.

## Internal Structure

- components/
- services/
- hooks/
- tests/
- docs/
- fixtures/
- guards/

## Core Behavior

- Show review items from local deterministic fixtures.
- Support folder-local filtering by review status and minimum risk score.
- Support simple offset/limit pagination for review lists.
- Allow isolated status updates against the in-memory store.
- Provide a reset helper for deterministic local tests.
- Validate hostile review payloads through the guard layer before future
  integration work consumes external input.

## Review Requirements

- Tests or test plans must live inside this folder.
- Documentation must explain setup, fixtures, usage, review notes, and known
  limitations.
- Changes must remain isolated from app-wide tests unless a future integration
  issue allows it.
- No production mail, wallet, routing, authentication, or database code should
  be touched for this tool.

## Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
