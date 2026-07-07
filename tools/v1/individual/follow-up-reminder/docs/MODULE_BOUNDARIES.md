# Follow-up Reminder Module Boundaries

## Folder Scope

All Follow-up Reminder work for this issue stays inside:

```text
tools/v1/individual/follow-up-reminder/
```

This V1 individual tool is isolated from the main app until a future integration
issue explicitly connects it. This architecture contract does not modify app
shells, routes, inbox internals, mail rendering, auth, wallet, Stellar,
database, notification, calendar, provider, analytics, or shared design-system
code.

## Module Ownership

| Layer      | Current or planned path                | Responsibility                                                               |
| ---------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| Public API | `index.ts`                             | Re-export stable engine, guard, fixture, and type contracts.                 |
| Engine     | `services/followUpReminder.ts`         | Convert normalized email input into an advisory reminder review model.       |
| Guards     | `services/guards.ts`                   | Validate, sanitize, and bound untrusted caller input before engine use.      |
| Fixtures   | `services/fixtures.ts` and `fixtures/` | Provide deterministic synthetic email and review cases.                      |
| Components | `components/`                          | Render isolated loading, empty, error, card, and review states.              |
| Tests      | `tests/`                               | Verify engine, guard, component, fixture, and architecture behavior locally. |
| Docs       | `docs/` and `REVIEW_NOTES.md`          | Document usage, threats, fixtures, review flow, and contribution boundaries. |

## Dependency Direction

Allowed dependency direction:

```text
index.ts
  -> services/followUpReminder.ts
  -> services/guards.ts
  -> services/fixtures.ts
components/
  -> index.ts or services/*
tests/
  -> services/*, components/*, docs/*, fixtures/*
docs/
  -> describes behavior only
```

Rules:

- services stay pure and never import React, routing, app stores, browser-only
  APIs, network clients, calendar clients, notification senders, wallet code, or
  database clients.
- components may import local services and fixtures, but must not mount
  themselves into the app shell or routes.
- tests may inspect local docs and fixtures, but must not depend on app-wide
  integration state.
- docs and fixtures must use synthetic `.test` or `example.*` data only.

## State Contract

The engine returns advisory review models only:

- `draft` when a reminder suggestion should be shown for explicit user review.
- `no_action` when the email is low confidence or has no actionable signal.

A future UI owns loading and error presentation while gathering email input. The
engine remains synchronous and read-only. It never schedules, confirms, sends,
snoozes, completes, dismisses, saves, or mutates product state.

## Future Contributor Rules

Contributors may:

- add folder-local docs, fixtures, tests, guards, engine helpers, hooks, and
  components.
- extend signal detection when tests and fixture notes document the behavior.
- refine isolated components without changing shared design-system primitives.

Contributors may not:

- write outside `tools/v1/individual/follow-up-reminder/` for this tool issue.
- add live network calls, secrets, paid services, production data, mailbox
  mutation, calendar writes, notification sends, wallet calls, Stellar calls, or
  database persistence.
- import from app routes, inbox internals, auth, wallet, Stellar, database,
  notification, analytics, or provider modules.

## Review Checklist

- Changed files are limited to this tool folder.
- Engine and guards remain folder-local and deterministic.
- Public exports continue to represent advisory reminder models only.
- Docs explain what future contributors may and may not change.
- No integration code, production data, or external services are introduced.
