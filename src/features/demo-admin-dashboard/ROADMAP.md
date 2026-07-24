# Demo Admin Dashboard — Data Population Roadmap

## Deterministic Demo Data Principles

All demo UI data in this dashboard must follow these rules:

- **No randomness unless seeded** — Every pseudo-random value must use a deterministic seed so the same input always produces the same output. See `mockHashHelpers.ts` for the existing pattern.
- **No external APIs** — All data is generated locally from hardcoded fixtures. Zero network calls.
- **No user-sensitive data** — Names, addresses, messages, and transactions are all fake, public, and safe for open-source review.
- **Fully reproducible UI state** — Given the same preset ID and interaction sequence, the dashboard must render identical output every time.
- **No real Stellar or on-chain data** — All addresses, hashes, signatures, and balances are fabricated.

---

## Phase 1 — Data Model Planning

### Purpose

Define the core data shapes that the entire dashboard will consume. This phase is already substantially complete (`types.ts` + `types/` directory). The remaining work is to audit existing types for gaps and formalize the data model contract.

### Inputs

- Existing types in `types.ts` (189 lines, 18+ type definitions)
- 20 domain-specific type files in `types/` (draft, dataset, campaign, campaignKpi, campaignTimeline, campaignSnapshot, audienceSegment, assignment, calendarEvent, otp, payloadDescriptor, persona, proofRecord, segmentEditorState, etc.)
- `index.ts` barrel file (474 lines of re-exports)

### Outputs

- Formalized type contract document (this roadmap serves as the contract)
- Type gap analysis identifying any missing shapes for the 8 presets
- Consistent naming conventions across all type files

### Dependencies

- None — types are standalone and import nothing outside the feature folder

### Risks

- Low. Types already exist and are thorough. Risk is primarily around adding new preset shapes that might require extending existing types.

### Current Status

| Area                                                         | Status      |
| ------------------------------------------------------------ | ----------- |
| Core shell types (`PresetId`, `DashboardSection`, etc.)      | ✅ Complete |
| Preset scenario types (`PresetScenario`, `PresetMail`, etc.) | ✅ Complete |
| Dataset types (`DemoDataset`, `DemoMessage`, etc.)           | ✅ Complete |
| Domain types (campaign, KPI, timeline, etc.)                 | ✅ Complete |
| Campaign timeline / milestone types                          | ✅ Complete |
| Sender persona types                                         | ✅ Complete |
| Proof record types                                           | ✅ Complete |
| Validation types                                             | ✅ Complete |
| Draft / draft-dataset types                                  | ✅ Complete |

---

## Phase 2 — Fixture System Design

### Purpose

Build deterministic, prescriptive data fixtures that drive every section of the dashboard. Fixtures must cover all 8 presets and expose data through a consistent query interface.

### Inputs

- Type definitions from Phase 1
- 22 existing fixture files in `fixtures/`
- `PRESET_SCENARIOS` array (5 base presets + 3 campaign presets)
- Existing hooks (`useDraftDataset`) and reducers

### Outputs

- Complete fixture coverage for all 10 dashboard sections (overview, accounts, mail, attachments, events, templates, campaigns, timeline, audit, analytics)
- Deterministic fixture selector functions (e.g., `getPresetById`, `getPresetAccounts`, `getPresetMail`)
- `scenarioRegistry.ts` — centralized registry mapping `PresetId` to `PresetScenario`
- `mockHashHelpers.ts` — deterministic hash/signature generation (already exists)
- Inbox seed dataset (`inboxSeedDataset.ts` + metadata)

### Dependencies

- Phase 1 types must be stable before new fixtures are added

### Risks

- Medium. Adding new fixtures could fragment the preset data model if not validated against the existing `PresetScenario` shape.
- Duplication risk between `presets.ts` and the campaign-specific preset files (`encryptedCampaignPreset.ts`, `conferenceCampaignPreset.ts`, `senderRecoveryCampaignPreset.ts`).

### Current Status

| Fixture Area                  | Status                              |
| ----------------------------- | ----------------------------------- |
| Base presets (5)              | ✅ Complete                         |
| Campaign presets (3)          | ✅ Complete                         |
| Campaign snapshots + tags     | ✅ Complete                         |
| Campaign timelines            | ✅ Complete                         |
| Campaign KPIs                 | ✅ Complete                         |
| Audience segments             | ✅ Complete                         |
| Message assignments           | ✅ Complete                         |
| Personas                      | ✅ Complete                         |
| Calendar events               | ✅ Complete                         |
| Inbox seed dataset            | ✅ Complete                         |
| OTP fixtures                  | ✅ Complete                         |
| Payload descriptor catalog    | ✅ Complete                         |
| Proof records                 | ✅ Complete                         |
| Draft fixtures                | ✅ Complete                         |
| Dashboard layout fixtures     | ✅ Complete                         |
| Centralized scenario registry | ✅ Complete (`scenarioRegistry.ts`) |

---

## Phase 3 — UI Mapping Layer

### Purpose

Connect fixture data to dashboard section components. Each section renders content derived from the active preset. The mapping layer transforms fixture data into component props.

### Inputs

- Fixture selectors from Phase 2 (e.g., `getPresetAccounts`, `getPresetMail`)
- Active `PresetId` from the dashboard shell state
- 27 component files in `components/`
- `DemoAdminDashboard.tsx` shell (993 lines)
- `CampaignsContent.tsx` — dedicated campaigns section component

### Outputs

- Section-level data transformers that convert `PresetScenario` into section-specific props
- Conditional rendering in `DemoAdminDashboard.tsx` keyed to `DashboardSection`
- Component integration layer (props wiring between fixtures and components)

### Dependencies

- Phase 2 fixtures must be finalized
- Section components must accept typed props from the mapping layer

### Risks

- High. This is where coupling between fixtures and UI happens. A mismatch between the fixture shape and component prop types will cause TypeScript compilation failures.
- The shell component (`DemoAdminDashboard.tsx`) is already 993 lines. Adding section rendering logic without extracting sub-components will increase complexity.

### Current Status

| Section     | Component                            | Data Source                                            | Status                |
| ----------- | ------------------------------------ | ------------------------------------------------------ | --------------------- |
| Overview    | `OverviewContent` (inline)           | `StatCard[]` from `PresetScenario.stats`               | ✅                    |
| Accounts    | `AccountsContent` (inline)           | `PresetAccount[]` from `PresetScenario.accounts`       | ✅                    |
| Mail        | `MailContent` (inline)               | `PresetMail[]` from `PresetScenario.mail`              | ✅                    |
| Attachments | `AttachmentsContent` (inline)        | `PresetAttachment[]` from `PresetScenario.attachments` | ✅                    |
| Events      | `EventsContent` (inline)             | `PresetEvent[]` from `PresetScenario.events`           | ✅                    |
| Templates   | `TemplatesContent` (inline)          | `CAMPAIGN_TEMPLATES` from `campaignFixtures.ts`        | ✅                    |
| Campaigns   | `CampaignsContent`                   | Campaign snapshots, tags, KPIs, timelines              | ✅                    |
| Timeline    | Inline `<div>Timeline Content</div>` | `CampaignTimelinePanel`                                | Partial — placeholder |
| Audit       | `AuditContent` (inline)              | `PresetAuditEvent[]` from `PresetScenario.auditEvents` | ✅                    |
| Analytics   | Renders card grid                    | `CampaignKpiDefinition[]`                              | ✅                    |

---

## Phase 4 — Preview / Control Layer

### Purpose

Build the controls that let dashboard operators switch between presets, inspect raw fixture data, toggle sections, and validate rendering without modifying code. This is the developer-facing interaction layer.

### Inputs

- All Phase 3 mapped components
- `PresetId` state and `setActivePresetId` in the shell
- Existing preset scenario data
- `activeSection` and `setActiveSection` in the shell

### Outputs

- Preset selector dropdown (exists: `select` element in the shell header)
- Section navigation tabs (exists: `<nav role="tablist">` with `NAV_ITEMS`)
- Preset badge showing active scenario name (exists: `"Preset: {activePreset.name}"`)
- Section content switching (exists: conditional rendering via `activeSection === "..."`)
- Data inspection panel (future: raw JSON viewer for active preset data)

### Dependencies

- Phase 3 must be stable so that switching presets produces visible changes in all sections

### Risks

- Low. Most control layer features already exist in the shell. Remaining work is refinement — adding a data inspector panel and improving the preset switching UX.
- Preset switching currently sets state; section components must handle the state change gracefully without stale data.

### Current Status

| Control                   | Location                            | Status |
| ------------------------- | ----------------------------------- | ------ |
| Preset selector dropdown  | `DemoAdminDashboard.tsx` header     | ✅     |
| Section navigation tabs   | `DemoAdminDashboard.tsx` nav        | ✅     |
| Active preset badge       | `DemoAdminDashboard.tsx` header     | ✅     |
| Section content switching | `DemoAdminDashboard.tsx` body       | ✅     |
| Preset scenario loading   | Shell via `PRESET_SCENARIOS.find()` | ✅     |
| Data inspection panel     | Not yet built                       | ❌     |
| Preset comparison mode    | Not yet built                       | ❌     |

---

## Dependency Notes

The following existing components and utilities are the consumers of the data population pipeline. They are listed here as integration points. No modifications to these files are part of this roadmap — they are documented so contributors understand the dependency graph.

### Direct Consumers (already wired)

| Consumer                     | Data Source                                                             | Section          |
| ---------------------------- | ----------------------------------------------------------------------- | ---------------- |
| `DemoAdminDashboard.tsx`     | `PRESET_SCENARIOS.find(p => p.id === activePresetId)`                   | All              |
| `CampaignsContent.tsx`       | `CAMPAIGN_TEMPLATES`, `defaultCampaignSnapshots`, `defaultCampaignTags` | Campaigns        |
| `CampaignTimelinePanel.tsx`  | `activeCampaignTimeline`, `draftCampaignTimeline`                       | Timeline         |
| `CampaignAnalyticsPanel.tsx` | `CAMPAIGN_KPI_DEFINITIONS`                                              | Analytics        |
| `CampaignDiffPanel.tsx`      | Campaign snapshot data                                                  | Campaigns        |
| `CampaignListTable.tsx`      | Campaign data                                                           | Campaigns        |
| `AuditLogPanel.tsx`          | `auditEvents` from active preset                                        | Audit            |
| `CalendarEventEditor.tsx`    | Calendar event fixtures                                                 | Events           |
| `MessageEditor.tsx`          | Mail fixtures + templates                                               | Templates        |
| `PersonaPicker.tsx`          | `defaultPersonas`                                                       | Mail / Templates |
| `ProofRecordEditor.tsx`      | Proof record fixtures                                                   | Mail             |
| `BulkTagEditor.tsx`          | Campaign tags                                                           | Campaigns        |
| `useDraftDataset.ts`         | `draftDatasetFixtures`                                                  | Templates        |
| `ExportDatasetButton.tsx`    | Draft dataset state                                                     | All              |

### Indirect Consumers (utility layer)

| Consumer                             | Role                  | Depends On                                |
| ------------------------------------ | --------------------- | ----------------------------------------- |
| `reducers/draftDatasetReducer.ts`    | Manages draft state   | `types/draft.ts`, `types/draftDataset.ts` |
| `reducers/historyReducer.ts`         | Undo/redo history     | Draft actions                             |
| `selectors/draftDatasetSelectors.ts` | Memoized accessors    | Draft state shape                         |
| `helpers/datasetExport.ts`           | Serializes dataset    | `types/datasetExport.ts`                  |
| `helpers/campaignExport.ts`          | Serializes campaign   | `types/campaignExport.ts`                 |
| `persistence/localStorageAdapter.ts` | Persists state        | Draft + campaign data                     |
| `utils/normalizeDemoData.ts`         | Normalizes raw data   | `types/dataset.ts`                        |
| `utils/inboxSeedHelpers.ts`          | Seed data utilities   | `fixtures/inboxSeedDataset.ts`            |
| `utils/campaignTimelineHelpers.ts`   | Timeline computations | `fixtures/campaignTimelineFixtures.ts`    |
| `utils/personaHelpers.ts`            | Persona filtering     | `fixtures/personaFixtures.ts`             |
| `utils/segmentHelpers.ts`            | Segment logic         | `fixtures/audienceSegmentFixtures.ts`     |
| `validation.ts`                      | Data validation       | `fixtures/validationFixtures.ts`          |
| `seedDatasetValidation.ts`           | Seed validation       | `fixtures/inboxSeedDataset.ts`            |
| `calendarEventValidation.ts`         | Event validation      | `types/calendarEvent.ts`                  |
| `labelNormalization.ts`              | Label operations      | Labels system                             |
| `senderPersonas/validation.ts`       | Persona validation    | Sender persona types                      |

### Out of Scope (explicitly excluded)

These are NOT part of this roadmap. They belong to future integration issues:

- Real inbox mail fetching
- Stellar on-chain data loading
- User authentication or session data
- External contact or address book imports
- Network requests of any kind
- Production database writes

---

## Implementation Order

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
 (types)      (data)      (UI)       (controls)
```

Each phase depends on the previous one being complete. Types must be defined before fixtures are created. Fixtures must be finalized before UI components are wired. The control layer is the last step because it ties everything together.

### What to Build First

If starting from zero, build in this order:

1. Audit and freeze all types in `types.ts` + `types/` (Phase 1)
2. Create or verify all fixture files in `fixtures/` (Phase 2)
3. Wire section components in `DemoAdminDashboard.tsx` (Phase 3)
4. Add preset selection and section navigation in the shell (Phase 4)

Since most phases are already substantially complete, the remaining work is gap-filling in the Timeline section, adding the data inspector panel, and ensuring all 8 presets produce visible data in every section.
