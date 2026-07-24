# Stellar Team Payout Request - Core Engine

This document defines the core business logic of the Stellar Team Payout Request tool, as implemented in `services/payoutEngine.ts`.

## Responsibilities

The engine is a collection of pure helpers that validate and construct payout requests. It operates entirely locally and uses deterministic fixtures.

## Inputs

- `teamMemberId`: A string identifying the requester (must exist in `fixtures/payout.fixtures.ts`).
- `amount`: The numeric amount of the payout. Must be greater than zero and within the quota for that currency.
- `currency`: The requested asset, e.g., `XLM` or `USDC`.
- `destinationAddress`: A 56-character Stellar public key starting with 'G'.

## Outputs

- **Validation Result:** Provides explicit validation errors mapped to fields (`isValid`, `errors`).
- **PayoutRequest:** The canonical object for a pending payout, ready to be processed or rendered by the UI.

## UI States Mapping

Future UI hooks should map the core functionality to these states (`PayoutState`):

- `idle`: Waiting for user input.
- `loading`: While validating or calling `simulatePayoutExecution()`.
- `error`: Populated if `createPayoutRequest` returns errors.
- `success`: After `simulatePayoutExecution` completes, showing the final `COMPLETED` request.

## Constraints

- **No Network Calls:** `simulatePayoutExecution` utilizes `setTimeout` to mimic network activity and resolves deterministically.
- **Mock Dependencies:** The engine sources quotas from `MOCK_TEAM_MEMBERS`. It contains no database dependencies.
