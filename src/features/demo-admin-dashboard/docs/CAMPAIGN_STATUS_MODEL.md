# Campaign Status Model

Defines the six valid campaign lifecycle states and the allowed transitions between them.

## States

| Status     | Meaning                                                      | Terminal | Initial |
|------------|--------------------------------------------------------------|----------|---------|
| `draft`    | Campaign is being created or edited. Not yet ready for review. | No       | **Yes** |
| `ready`    | Campaign is complete and ready for review or approval.       | No       | No      |
| `active`   | Campaign is live and sending.                                | No       | No      |
| `paused`   | Campaign was active but temporarily stopped.                 | No       | No      |
| `archived` | Campaign is finished and kept for records. No further changes. | **Yes** | No      |
| `failed`   | Campaign encountered an error. Can be retried or archived.   | No       | No      |

## Transition Diagram

```
                    ┌──────────┐
                    │  draft   │
                    └────┬─────┘
                   ┌─────┴──────┐
                   ▼            ▼
              ┌────────┐  ┌──────────┐
              │ ready  │  │ archived │
              └───┬────┘  └──────────┘
           ┌──────┼──────┐
           ▼      ▼      ▼
      ┌────────┐  │  ┌──────┐
      │ active │◄─┘  │failed│
      └───┬────┘     └──┬───┘
      ┌────┴────┐       │
      ▼         ▼       │
   ┌──────┐  ┌──────┐   │
   │paused│  │arch'd│   │
   └──┬───┘  └──────┘   │
      │                 │
      └── active ───────┘
           (resume)
```

## Allowed Transitions

| From       | To         | Label             | Description                                |
|------------|------------|-------------------|--------------------------------------------|
| `draft`    | `ready`    | Mark Ready        | Campaign is complete and ready for review. |
| `draft`    | `archived` | Archive Draft     | Discard the draft campaign.                |
| `ready`    | `active`   | Launch            | Start the campaign and begin sending.      |
| `ready`    | `draft`    | Send Back to Draft | Return campaign for further edits.        |
| `ready`    | `archived` | Cancel            | Cancel the campaign before launch.         |
| `active`   | `paused`   | Pause             | Temporarily stop the campaign.             |
| `active`   | `archived` | End Campaign      | Finish the campaign successfully.          |
| `active`   | `failed`   | Mark Failed       | Campaign encountered an error.             |
| `paused`   | `active`   | Resume            | Resume the paused campaign.                |
| `paused`   | `archived` | End Campaign      | End the campaign while paused.             |
| `paused`   | `failed`   | Mark Failed       | Fail the campaign while paused.            |
| `failed`   | `draft`    | Retry             | Reset failed campaign for revision.        |
| `failed`   | `archived` | Archive Failed    | Archive a failed campaign.                 |

## Key Files

| File                                                 | Purpose                                |
|------------------------------------------------------|----------------------------------------|
| `types/campaignStatus.ts`                            | Type definitions and constants         |
| `helpers/campaignStatusTransitions.ts`               | Transition validation and metadata     |
| `fixtures/campaignStatusFixtures.ts`                 | Deterministic demo records per status  |
| `constants/displayTokens.ts`                         | UI token mapping for each status       |
| `__tests__/campaignStatus.test.ts`                   | Full test coverage for the model       |

## Usage Example

```ts
import { canTransitionTo, getAllowedTransitions } from "./helpers/campaignStatusTransitions";

// Check if a transition is allowed
if (canTransitionTo("draft", "ready")) {
  // campaign.status = "ready";
}

// Get all possible next states
const next = getAllowedTransitions("active");
// [{ from: "active", to: "paused", label: "Pause", ... }, ...]
```

All data is fake, deterministic, and safe for public repository review.
