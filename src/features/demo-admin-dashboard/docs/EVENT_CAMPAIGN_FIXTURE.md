# Event Campaign Fixture

Part of the Demo Admin Dashboard campaign workstream (issue 17 of 50).

## Overview

Provides fake, deterministic event campaign fixtures for testing the admin dashboard's campaign creation and management features. Each fixture models a complete event campaign with timeline phases, messages, and calendar events.

## Fixtures

| ID | Kind | Name | Event Date |
|----|------|------|------------|
| `evt-camp-conference-001` | conference | StealthCon 2026 | 2026-09-15 |
| `evt-camp-workshop-001` | workshop | Soroban Smart Contract Workshop | 2026-10-05 |

## Structure

Each `EventCampaignFixture` contains:

- **config** -- metadata (name, kind, date, venue, capacity, organizer)
- **timelinePhases** -- a series of phases (planning, registration, active, followup)
- **messages** -- email messages sent at various campaign stages (tickets, reminders, follow-ups)
- **calendarEvents** -- calendar events for the conference or workshop

## Messages by Stage (Conference)

| Stage | Subject | Labels |
|-------|---------|--------|
| Registration | Your StealthCon 2026 pass is ready | Conference, Ticket, Important |
| Week before | StealthCon 2026 — One week away! | Conference, Reminder |
| Day before | Final reminder: StealthCon is tomorrow | Conference, Reminder |
| Registration | Calendar invite: StealthCon 2026 | Conference, Calendar |
| Post-event | Thanks for attending StealthCon 2026 | Conference, Follow-up |
| Post-event | Share your StealthCon feedback | Conference, Survey |
| Post-event (no-show) | We missed you at StealthCon 2026 | Conference, Follow-up |

## Timeline Phases (Conference)

1. **Planning** (Aug 1 -- Aug 21) -- Content prep
2. **Registration** (Aug 22 -- Sep 8) -- Ticket sales & onboarding
3. **Active** (Sep 9 -- Sep 16) -- Event week
4. **Follow-up** (Sep 17 -- Sep 30) -- Survey & certificates

## Usage

```typescript
import {
  EVENT_CAMPAIGN_FIXTURES,
  getEventCampaignFixtureById,
  getEventCampaignFixturesByKind,
} from "../fixtures/eventCampaignFixture";
import { validateEventCampaignFixture } from "../utils/eventCampaignHelpers";

// Get all fixtures
const all = EVENT_CAMPAIGN_FIXTURES;

// Get a specific fixture
const conf = getEventCampaignFixtureById("evt-camp-conference-001");

// Get all conference fixtures
const conferences = getEventCampaignFixturesByKind("conference");

// Validate
const issues = validateEventCampaignFixture(conf);
```

## Safety

All data is:
- Fake and deterministic
- Uses safe demo domains (`@stealth.demo`, `@example.com`, `@example.org`)
- Free of secrets, private keys, or live network references
- Suitable for public repository review
