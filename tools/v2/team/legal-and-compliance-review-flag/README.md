# Legal and Compliance Review Flag

This folder contains the isolated core engine for the Legal and Compliance
Review Flag tool. It evaluates team mail or workflow items and returns a
deterministic review report that future UI work can consume without wiring into
the main application.

## Ownership Boundary

All work for this tool must stay inside:

`tools/v2/team/legal-and-compliance-review-flag/`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Folder API

```js
import { createReviewFlagReport } from "./index.mjs";

const report = createReviewFlagReport({
  items: [
    {
      id: "thread-001",
      subject: "Vendor DPA for review",
      body: "The vendor asks us to approve the data processing addendum.",
      containsExternalData: true,
      contractValue: 125000,
    },
  ],
});
```

The service returns one of four states:

- `loading`: future UI can show a pending state before local data is ready.
- `empty`: the input list is valid but has no items to review.
- `success`: items were evaluated and include flags, severity, and reviewer
  suggestions.
- `error`: the input shape is invalid and includes local validation messages.

## Local Files

- `services/review-flag.service.mjs` contains the pure deterministic logic.
- `fixtures/sample-review-items.json` provides local, non-production examples.
- `tests/review-flag.test.mjs` verifies the folder-local API.
- `docs/` documents reviewer notes and the test plan.

No live network calls, secrets, production data, or app integration are included.
