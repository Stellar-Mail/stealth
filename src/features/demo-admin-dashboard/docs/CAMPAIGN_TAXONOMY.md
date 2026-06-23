# Campaign Taxonomy

Describes how campaign records, campaign groups, audiences, and demo messages
relate inside the demo admin dashboard.

All data is fake, deterministic, and safe for public repository review.

---

## Entity model

```
CampaignGroup
  └── CampaignRecord (many per group)
        ├── AudienceSegment (one per record, via audienceId)
        └── CampaignMessageLink (one per message)
              └── Demo message draft (identified by messageId)
```

### CampaignGroup

A logical container for campaigns that share a common goal.

| Field         | Type                    | Description                                      |
|---------------|-------------------------|--------------------------------------------------|
| `id`          | `string`                | Stable identifier (`group-onboarding`, etc.)     |
| `name`        | `string`                | Display name shown in the admin dashboard        |
| `description` | `string`                | Short summary of what this group covers          |
| `category`    | `CampaignGroupCategory` | `onboarding \| newsletter \| security \| events \| operations` |
| `campaignIds` | `string[]`              | Ordered IDs of the campaigns in this group       |

### CampaignRecord

The canonical demo campaign entity. One record per distinct campaign story.

| Field         | Type                | Description                                           |
|---------------|---------------------|-------------------------------------------------------|
| `id`          | `string`            | Stable identifier (`camp-welcome`, etc.)              |
| `name`        | `string`            | Display name shown in the campaign list               |
| `description` | `string`            | Short summary of the campaign's purpose               |
| `groupId`     | `string`            | ID of the parent `CampaignGroup`                      |
| `audienceId`  | `AudienceSegmentId` | ID of the target `AudienceSegment`                    |
| `status`      | `CampaignStatus`    | `active \| draft \| needs-review \| archived`         |
| `tags`        | `string[]`          | Free-form labels for filtering (matches `CampaignTag` slugs) |
| `messageIds`  | `string[]`          | Ordered draft message IDs attached to this campaign   |
| `createdAt`   | `string`            | ISO 8601 timestamp (fake, deterministic)              |
| `updatedAt`   | `string`            | ISO 8601 timestamp (fake, deterministic)              |

Each `CampaignRecord` belongs to **exactly one** `CampaignGroup` and targets
**exactly one** `AudienceSegment`. The group lists it in `campaignIds` and the
record references back via `groupId` — both sides must agree.

### AudienceSegment

Defined in `types/audienceSegment.ts` and `fixtures/audienceSegmentFixtures.ts`.
Campaigns reference segments by `AudienceSegmentId`:

| ID                | Label             | Estimated size |
|-------------------|-------------------|---------------|
| `investors`       | Investors         | 340           |
| `founders`        | Founders          | 210           |
| `events`          | Event Attendees   | 580           |
| `relay-operators` | Relay Operators   | 95            |
| `unknown-senders` | Unknown Senders   | 1 200         |

### CampaignMessageLink

An explicit join between a `CampaignRecord` and a demo message draft.

| Field           | Type                   | Description                                         |
|-----------------|------------------------|-----------------------------------------------------|
| `campaignId`    | `string`               | ID of the parent `CampaignRecord`                   |
| `messageId`     | `string`               | ID of the demo message draft                        |
| `role`          | `CampaignMessageRole`  | `primary \| followup \| notification`               |
| `sequenceIndex` | `number`               | Zero-based position in the campaign message sequence|

Message roles:
- **primary** — the main campaign message (typically the first send).
- **followup** — a subsequent message in a multi-step sequence.
- **notification** — a transactional or triggered notice (not a marketing send).

### CampaignRelationshipMap

A pre-resolved snapshot that combines a campaign with its group, audience
label, audience size, and message links. Used by admin panels to display
the full picture without repeated lookups.

---

## Example relationship

```
CampaignGroup: "Onboarding Series" (group-onboarding)
  │
  ├── CampaignRecord: "Welcome Onboarding" (camp-welcome)
  │     audienceId: founders  →  AudienceSegment "Founders" (est. 210)
  │     messageIds: [msg-welcome-1, msg-welcome-2]
  │       CampaignMessageLink { role: primary,   sequenceIndex: 0 } → msg-welcome-1
  │       CampaignMessageLink { role: followup,  sequenceIndex: 1 } → msg-welcome-2
  │
  └── CampaignRecord: "Wallet Setup Prompt" (camp-wallet-setup)
        audienceId: founders  →  AudienceSegment "Founders" (est. 210)
        messageIds: [msg-wallet-1]
          CampaignMessageLink { role: notification, sequenceIndex: 0 } → msg-wallet-1
```

---

## Source files

| Purpose              | File                                              |
|----------------------|---------------------------------------------------|
| Types                | `types/campaignTaxonomy.ts`                       |
| Fixtures             | `fixtures/campaignTaxonomyFixtures.ts`            |
| Tests                | `__tests__/campaignTaxonomy.test.ts`              |
| Audience segments    | `types/audienceSegment.ts`, `fixtures/audienceSegmentFixtures.ts` |
| Campaign status      | `types/campaignSnapshot.ts`                       |
| Public exports       | `index.ts`                                        |

---

## Safety notes

- All `messageId` values in fixtures are demo identifiers.
  They do not reference real inbox messages or production mail records.
- All recipient hints in associated message drafts use reserved domains
  (`*.stealth.demo`, `example.com`, `example.org`).
- `audienceSize` values are fake estimates for display only.
- No live network calls, real wallet addresses, or real user data appear here.
