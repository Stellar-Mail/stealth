# Read receipt states

Admin controls for the read receipt state of demo messages (issue #182). All copy is static, deterministic, and safe for public review — no real user data, network calls, or secrets.

## States

- **Receipts off** (`disabled`) — Read receipts are turned off, so no read status is tracked.
- **Requested** (`requested`) — A receipt was requested but the message is not delivered yet.
- **Delivered** (`delivered`) — The message reached the inbox but has not been opened.
- **Read** (`read`) — The recipient opened the message and a read receipt was recorded.
- **Failed** (`failed`) — The read receipt could not be recorded, usually a delivery problem.

## Building blocks

- `ReceiptState` — the union of supported receipt states.
- `RECEIPT_STATES` — the states in display order.
- `RECEIPT_STATE_OPTIONS` — label, description, and example for each state.
- `getReceiptStateOption(state)` — returns the option for a single state.
- `DEFAULT_RECEIPT_STATE` — the default selection (`delivered`).
- `ReceiptStateField` — a labeled select that shows the description and an example for the selected state.

## Usage

Render `ReceiptStateField` with a `value` and an `onChange` handler. The field lists every state and shows the description plus a concrete example for whichever state is selected.

## Scope

All code lives under `src/features/demo-admin-dashboard/`. These controls populate demo data only and are not wired into production mail flows; that integration is a deliberate follow-up.
