# Vendor Mail Tracker Specs

## Purpose

Define a self-contained review contract for tracking vendor email threads before
any future app, inbox, or notification integration.

## Release Scope

- Release tier: V2 later-release tool
- Audience: team
- Folder ownership: `tools/v2/team/vendor-mail-tracker/`
- Integration status: isolated mini-product workspace

## In-Scope Behavior

- Model vendor email threads with audit-friendly source metadata.
- Distinguish routine follow-ups from stale, blocked, or high-priority threads.
- Represent blocked threads without attempting vendor communication side effects.
- Provide fixture coverage for each local tracking status.
- Give reviewers a single local test command.

## Out-of-Scope Behavior

- Main app routing or dashboard registration
- Inbox ingestion, mail rendering, or attachment storage changes
- Vendor portal authentication or external API calls
- Database schema or shared design system changes
- Notification delivery or role-permission enforcement

## Vendor Thread Contract

Each expected tracking record should include:

- `id`: stable fixture-local tracking identifier
- `vendor`: vendor display name
- `owner`: internal owner responsible for the next action
- `priority`: one of `low`, `medium`, `high`
- `status`: one of `open`, `waiting-on-vendor`, `blocked`, `resolved`
- `lastContactAt`: ISO timestamp for the last vendor-related message
- `nextActionDueAt`: ISO timestamp or null when the thread is resolved
- `sourceMessageId`: source email identifier
- `reviewRequired`: true when a person must resolve missing or risky details

## Review Rules

- high-priority threads require human review unless already resolved
- missing required documents must be blocked
- stale open threads require review
- blocked threads must set `reviewRequired` to true
- resolved threads must not require a next action due date

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Contributor Boundary

Keep all changes for this issue in this folder. If a future issue adds live
mailbox ingestion or vendor notifications, it should define security, privacy,
and retention constraints before connecting this tool to production data.
