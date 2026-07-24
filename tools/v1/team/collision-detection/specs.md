# Collision Detection Specs

## Goal

Prevent duplicate team responses by preparing a folder-local collision-detection
workspace with explicit security and performance constraints.

## Scope

- Release tier: V1
- Audience: Team
- Folder ownership: `tools/v1/team/collision-detection/`
- Integration status: isolated until a future issue explicitly wires it into
  the main mail app.

Do not modify the main application shell, dashboard layout, navigation system,
authentication, wallet core, mail rendering engine, existing inbox
architecture, routing, Stellar integration core, database schema, or existing
design system for this issue.

## Current Deliverables

- Document threat assumptions and unsafe inputs.
- Add folder-local guard helpers for malformed or hostile payloads.
- Add performance notes and limits for large emails, attachments, team
  histories, and candidate sets.
- Add folder-local tests that can run without live mail, network calls, secrets,
  private keys, or customer data.

## Guard Contract

`prepareCollisionInput` accepts an unknown payload and returns:

- `ok: false` with validation errors when the top-level payload is malformed.
- sanitized candidates when the payload can be inspected safely.
- warnings for skipped candidates, truncated histories, body truncation, or
  attachment caps.
- stable fingerprints for duplicate-response comparisons after sanitization.

## Acceptance Checklist

- The tool explicitly handles malformed or hostile input.
- The tool avoids unnecessary work on large histories through `maxItems`.
- Attachment counts and aggregate bytes are bounded before future analysis.
- Files changed by this work stay inside `tools/v1/team/collision-detection/`.
- The contribution remains a self-contained mini-product change.
