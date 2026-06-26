# PublishChecklist

Pre-publish readiness panel for the demo admin dashboard. Tells maintainers
whether a draft dataset is safe and complete enough to populate the demo UI.
All data is fake and deterministic; nothing here touches production mail flows.

## Pieces

- `publishChecklist-types.ts` — `PublishChecklistItem`, `PublishChecklistStatus`,
  `PublishChecklistResult`, and summary types.
- `publishChecklist.ts` — `buildPublishChecklist`, `summarizePublishChecklist`,
  `sortPublishChecklistItems`, `isReadyToPublish`.
- `publishChecklistFixtures.ts` — ready, blocked, and validation-error scenarios.
- `components/PublishChecklist.tsx` — the checklist panel UI.

## Checks

`buildPublishChecklist(drafts, validationIssues?)` runs these gates:

1. Draft dataset is not empty (blocked when empty).
2. Each draft has `id`, `subject`, `body`, and `recipients` (blocked).
3. Each draft has at least one recipient (blocked).
4. Recipients use `example.com`, `example.org`, or `*.stealth.demo` only (blocked).
5. No blocking validation errors from field-level validators (blocked).
6. Validation warnings reviewed (warning — does not block publish).

## Behavior

- Items are grouped by status (blocked, warning, pass).
- A summary row shows counts per status.
- `readyToPublish` is true when no item is blocked.
- When `onPublish` is provided, the publish button is disabled until all blockers
  are resolved.
- With all checks passing, a friendly ready state is shown.

## Usage

```tsx
import {
  PublishChecklist,
  buildPublishChecklist,
  demoPublishChecklistReady,
} from "@/features/demo-admin-dashboard";

const result = buildPublishChecklist(drafts, validationIssues);

<PublishChecklist result={result} onPublish={() => adapter.publishDataset(dataset)} />;
```

## Follow-up integration (out of scope here)

Wiring `PublishChecklist` into the tabbed `DemoAdminDashboard` shell is a
deliberate follow-up so that no files outside `src/features/demo-admin-dashboard/`
change in this issue.
