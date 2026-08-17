# View Placeholders

Sections that appear in the navigation but do not yet have full content implementations. These placeholders document the intended behavior and data requirements for future issues.

## Campaigns

**File:** `DemoAdminDashboard.tsx` — `CampaignsContent` component

**Current behavior:**
Renders `CampaignSnapshots` with an isolated empty draft array. The snapshot save/restore lifecycle works independently but has no access to the draft dataset built in the Templates section.

**Needed for full integration:**

- Lift `Draft[]` state from `TemplatePicker` up to the `DemoAdminDashboard` level so `CampaignsContent` receives the active dataset
- Wire `onRestoreDataset` to replace the active drafts in `TemplatePicker`
- Add data flow integration test

**Available infrastructure:**

- `CampaignSnapshots` component (fully implemented in `components/CampaignSnapshots.tsx`)
- `campaignSnapshotFixtures.ts` — default preloaded scenarios
- `campaigns.fixture.ts` — additional campaign fixtures
- `persistence/localStorageAdapter.ts` — snapshot save/load

**Target issue:** Integration with Templates draft state.

## Analytics

**File:** `DemoAdminDashboard.tsx` — `AnalyticsContent` component

**Current behavior:**
Renders three placeholder stat cards with `"—"` values and notes indicating "Requires analytics integration."

**Needed for full implementation:**

- Define aggregate metric types (active sessions, features used, session duration, etc.)
- Create fixtures with deterministic fake analytics data
- Wire to an analytics data source (or mock)
- Render stat cards, charts, or trend indicators

**Available infrastructure:**

- None yet — this is a greenfield section.

**Target issue:** Analytics data model and fixture creation.

## Status Legend

| Status          | Meaning                                                       |
| --------------- | ------------------------------------------------------------- |
| **Ready**       | Section has full implementation, fixture data, and tests      |
| **Placeholder** | Section has a stub component but needs data/state integration |
| **Pending**     | Section has not been started                                  |
