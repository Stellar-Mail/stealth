# Demo Admin Dashboard — Section Map

Each dashboard section populates a specific area of the demo UI. This map documents every section's purpose, data types, demo UI target, and fixture sources.

## Sections

| #   | Section         | Manages                                               | Populates in demo UI                                           | Types                        | Fixtures                                              | Status      |
| --- | --------------- | ----------------------------------------------------- | -------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------- | ----------- |
| 1   | **overview**    | Summary stats cards, protocol scenario presets        | Demo admin overview / control center                           | `StatCard`, `PresetScenario` | `presets.ts`, `demoData.ts`                           | Ready       |
| 2   | **accounts**    | Demo Stellar accounts, relay nodes, sender metadata   | Sender-conversion feature (`sender-conversion/`)               | `PresetAccount`              | `presets.ts`                                          | Ready       |
| 3   | **mail**        | Inbox/request/spam mail fixtures with proof metadata  | Inbox, mail reader, request triage (`mail/`, `requests/`)      | `PresetMail`                 | `presets.ts`                                          | Ready       |
| 4   | **attachments** | File attachment fixtures linked to mail items         | Attachment display in mail reader                              | `PresetAttachment`           | `presets.ts`                                          | Ready       |
| 5   | **events**      | Calendar and protocol events                          | Calendar feature (`calendar/`)                                 | `PresetEvent`                | `presets.ts`                                          | Ready       |
| 6   | **templates**   | Message templates for composing demo drafts           | Demo inbox composition flow (`mail/`)                          | `MessageTemplate`, `Draft`   | `templates/messageTemplates.ts`, `draftFixtures.ts`   | Ready       |
| 7   | **campaigns**   | Draft snapshot save/restore, campaign management      | Demo inbox seeding campaigns                                   | `CampaignSnapshot`, `Draft`  | `campaignSnapshotFixtures.ts`, `campaigns.fixture.ts` | Placeholder |
| 8   | **audit**       | Demo protocol event log (sessions, policies, postage) | Audit log / proof inspector (`audit-log/`, `proof-inspector/`) | `PresetAuditEvent`           | `presets.ts`                                          | Ready       |
| 9   | **analytics**   | Privacy-preserving aggregate product metrics          | Future analytics dashboard integration                         | TBD                          | TBD                                                   | Placeholder |

## Section-to-Feature Mapping

```
┌─────────────────────────────────────────────────────────┐
│               Demo Admin Dashboard                      │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Accounts │   Mail   │ Attachm. │  Events  │    Audit    │
│    ↓     │    ↓     │    ↓     │    ↓     │     ↓       │
│ sender-  │   mail   │  (in     │ calendar │ audit-log   │
│ convers. │  reader  │  mail)   │          │ proof-insp. │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
│  Templates  │  Campaigns  │  Analytics  │  Overview    │
│     ↓       │      ↓      │     ↓       │     ↓        │
│   mail     │   (future)  │  (future)   │  control     │
│  compose   │   seeding   │ dashboard   │  center      │
└────────────┴─────────────┴─────────────┴──────────────┘
```

## Data Flow

Each section reads from deterministic fixture files and renders through `AdminDataTable` or purpose-built components. When a protocol scenario preset is active (from the overview section), all data tables switch to the preset's dataset. Otherwise, default static fixtures are shown.

### Active preset data flow

```
Overview (PresetSelector)
  │  setActivePresetId(id)
  ▼
PRESET_SCENARIOS.find(id)
  │
  ├──► stats       → OverviewContent
  ├──► accounts    → AccountsContent
  ├──► mail        → MailContent
  ├──► attachments → AttachmentsContent
  ├──► events      → EventsContent
  ├──► auditEvents → AuditContent
  └──► ...         → (preset provides datasets for all sections)
```

### Default (no preset) data flow

```
Static constants in DemoAdminDashboard.tsx:
  OVERVIEW_STATS, ACCOUNTS_FAKE, MAIL_FIXTURES,
  ATTACHMENTS_FAKE, EVENTS_FAKE, AUDIT_EVENTS_FAKE
  │
  └──► Each section component renders its respective data table
```

## Adding a New Section

1. Add the section id to `DashboardSection` in `types.ts`.
2. Add a nav item to `NAV_ITEMS` in `DemoAdminDashboard.tsx`.
3. Add an icon entry to `SECTION_ICON` in `DemoAdminDashboard.tsx`.
4. If the section has a dedicated component, create it under `components/`.
5. Add the content component and wire it into the content switch.
6. Add fixture data in `fixtures/` and types in `types.ts` or `types/`.
7. Add tests in `__tests__/`.
8. Update this section map.

## Guidelines

- All data must be **deterministic, fake, and safe for public review**.
- Use only `*stealth.demo`, `@example.com`, or `@example.org` domains.
- No real user data, secrets, private keys, or live network calls.
- Keep all section code inside `src/features/demo-admin-dashboard/`.
