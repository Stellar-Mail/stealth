# Relay Operator Campaign Preset

Issue #269 adds the `relay-operator-campaign` preset for the Demo Admin Dashboard campaign
workstream. The fixture is fake, deterministic, and safe for public repository review.

## Scope

- Campaign labels: `demo-admin-dashboard`, `demo-data`, `Campaign`.
- Initiative: Demo Admin Dashboard, campaign issue 18 of 50.
- Scenario behavior: relay diagnostics, verification updates, and proof settlement preview.
- Data location: `src/features/demo-admin-dashboard/fixtures/presets.ts`.

## Included Demo Data

- Three operator personas with `example.com`, `example.org`, and `*stealth.demo` identities.
- Three proof assignments mapped to the campaign mail subjects.
- Relay account rows for active and pending relay states.
- Mail rows for diagnostics, verification update review, and settlement receipt preview.
- Attachments, events, and audit records that support previewing the demo UI.

## Review Notes

- No real relay hostnames, private keys, secrets, live accounts, or network calls are included.
- Contract addresses, hashes, diagnostic ids, and balances are deterministic demo strings.
- The preset is selectable from the local dashboard preset selector, but it does not wire into
  production mail, calendar, routing, protocol, API, or app-shell code.
