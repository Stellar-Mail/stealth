# Mail-to-Ticket Converter

This folder contains the isolated core engine for the Mail-to-Ticket Converter
tool. It converts local mail-like inputs into deterministic ticket candidates
that future UI work can inspect before any main-app integration exists.

## Ownership Boundary

All work for this tool must stay inside:

`tools/v2/team/mail-to-ticket-converter/`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Folder API

```js
import { createTicketConversionReport } from "./index.mjs";

const report = createTicketConversionReport({
  messages: [
    {
      id: "mail-001",
      subject: "Urgent: production login outage",
      body: "Users cannot sign in after the latest deployment.",
      senderEmail: "ops@example.com",
      receivedAt: "2026-07-01T09:00:00.000Z",
    },
  ],
});
```

The service returns one of four states:

- `loading`: future UI callers can render a pending state while local mail data
  is prepared.
- `empty`: the message list is valid but has no items to convert.
- `success`: messages were converted into ticket candidates with category,
  priority, queue, SLA, tags, and source metadata.
- `error`: the input shape is invalid and includes validation messages.

## Local Files

- `services/ticket-converter.service.mjs` contains the pure conversion logic.
- `fixtures/sample-mail-items.json` provides deterministic local examples.
- `tests/ticket-converter.test.mjs` verifies the folder-local API.
- `docs/` documents reviewer notes and the test plan.

No live network calls, secrets, production data, or app integration are included.
