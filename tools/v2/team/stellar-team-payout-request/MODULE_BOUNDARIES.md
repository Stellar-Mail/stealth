# Stellar Team Payout Request — Module Boundaries

| Module        | Status  | Responsibility                                                          | May import                                                    |
| ------------- | ------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `types/`      | planned | Shared interfaces (`PayoutRequest`, `StellarDestination`). No logic.    | nothing                                                       |
| `services/`   | planned | Payout logic, validation, mock backend interactions.                    | `../types/` only                                              |
| `fixtures/`   | planned | Deterministic sample items for tests and UI preview.                    | `../types/`                                                   |
| `tests/`      | planned | vitest specs covering payout flow, validation, and component rendering. | `../services/`, `../fixtures/`, `../types/`, `../components/` |
| `hooks/`      | planned | React glue (loading/error state around the service).                    | React, `../services/`, `../types/`                            |
| `components/` | planned | Presentational UI (payout forms, request lists).                        | React, `../hooks/`, `../types/`                               |
