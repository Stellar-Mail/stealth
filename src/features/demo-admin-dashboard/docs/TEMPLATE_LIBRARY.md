# Demo Message Template Library

This module family provides the reusable demo message template library for the
Demo Admin Dashboard. It stays fully inside
`src/features/demo-admin-dashboard/` and only uses fake, deterministic data.

## Pieces

- `templates/types.ts` defines the template, scenario, and fixture types.
- `templates/messageTemplates.ts` exports the built-in deterministic template
  list.
- `templates/templateScenarios.ts` groups templates into reviewer-friendly
  scenarios and exposes scenario lookup helpers.
- `templates/templateRegistry.ts` provides an in-memory registry with duplicate
  detection, ordering, and scenario-aware lookup.
- `fixtures/templateFixtures.ts` builds deterministic fixture rows from the
  template list and scenario metadata.
- `templates/TemplatePicker.tsx` renders the picker UI that inserts templates
  into the active draft dataset.

## Determinism Rules

- Template ids are stable and unique.
- Scenario ids are stable and unique.
- Fixture rows are derived from fixed scenario/template ordering.
- No clocks, random numbers, or network calls are used.

## Scenario Coverage

The built-in template scenarios cover:

- onboarding welcome mail
- postage and delivery receipts
- identity verification
- event invitations
- product updates
- internal campaign review notes

## Usage

The registry and fixtures are intended to be imported from the local feature
root:

```ts
import {
  defaultTemplateRegistry,
  templateFixtures,
  TEMPLATE_SCENARIOS,
} from "@/features/demo-admin-dashboard";
```

These exports are safe for preview, testing, and documentation because they are
fully synthetic and deterministic.

