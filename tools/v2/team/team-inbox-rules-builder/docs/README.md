# Team Inbox Rules Builder

## Overview

This is a standalone, folder-isolated tool designed to provide rule-building capabilities for a team inbox. It allows users to create, evaluate, and manage automation rules based on conditions and actions.

## Setup

Because this is an isolated tool designed for the V2 release, it has zero external dependencies on the main app shell, routing, or authentication.

1. All files reside strictly in `tools/v2/team/team-inbox-rules-builder`.
2. No configuration or environment variables are required.
3. Simply import the components or hooks from the folder's `index.ts` to integrate it into a parent view when ready.

## Usage

The core engine consists of two services:

- **RuleStorageService**: Manages the persistence and retrieval of rules locally.
- **RuleEngineService**: Evaluates a given mail context against the rules list and returns matched actions.

To use the UI components, render the rules builder container (to be implemented) which orchestrates the state via `useRules` and `useRuleEvaluation`.

## Fixtures

Mock data is provided in `fixtures/rules.fixtures.ts`. This contains:

- Pre-configured standard rules.
- Test contexts (mock mail objects) used to validate the evaluation engine.
- You can use these fixtures for automated tests or local UI testing.

## Known Limitations

1. **No Backend Persistence**: Currently, rules are stored entirely in memory or via mock fixtures. There is no real database schema connection.
2. **No Real Email Hook**: The engine is purely pure-function based. It relies on standard JSON payloads for evaluation and doesn't hook into the mail delivery pipeline yet.
3. **No UI Hookup**: The components are not wired into the dashboard layout.
