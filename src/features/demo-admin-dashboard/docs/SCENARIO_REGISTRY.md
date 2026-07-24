# Scenario Registry and Loader

This module lets the demo admin dashboard load individual demo scenarios into
the compose draft state. It is part of the Demo Admin Dashboard initiative
(issue #216) and stays fully inside `src/features/demo-admin-dashboard/`.

## Concepts

- `DemoScenario` — a self-contained, fake, deterministic scenario that carries
  a ready-to-load `Draft` (`id`, `subject`, `body`, `recipients`).
- `ScenarioRegistry` — a read-only lookup created from a list of scenarios,
  exposing `list()`, `get(id)`, and `has(id)`.
- `ScenarioLoadMode` — `replace` or `merge`.

## Usage

Create a registry with the built-in `demoScenarios` or your own list:

- `createScenarioRegistry()` returns a registry over the built-in scenarios.
- `createScenarioRegistry(custom)` returns a registry over `custom`. When two
  scenarios share an id, the later entry wins, keeping the result deterministic.

Load a scenario into the current draft with `loadScenarioIntoDraft`:

- replace — returns a fresh copy of the scenario draft and ignores the current
  draft. This is also used automatically when there is no current draft.
- merge — keeps the current draft `id`, overlays the scenario `subject` and
  `body` when they are non-empty, and unions `recipients` without duplicates.

## Safety

All scenario data must remain fake and safe for public review. Email addresses
use `@example.com`, `@example.org`, or `*.stealth.demo`. No real PII, secrets,
or live network calls are included.
