# Campaign seeding guide

This guide explains how contributors should add deterministic campaign seed data inside the demo admin dashboard feature.

## Scope

- Keep all campaign seeding work under [src/features/demo-admin-dashboard](src/features/demo-admin-dashboard).
- Use fake recipients only (`*.stealth.demo`, `example.com`, or `example.org`).
- Avoid any production mail flow wiring or live integrations in this issue.

## Naming conventions

Use the following rules when creating new scenario records:

- `id`: stable, unique identifier such as `seed-<family>-<slug>`
- `slug`: kebab-case version of the scenario label
- `name`: human-readable label shown in review tools
- `category`: one of `onboarding`, `security`, `newsletter`, or `review`
- `tags`: short strings that help contributors filter the dataset

Prefer helpers such as `toCampaignSeedSlug()` and `validateCampaignSeedScenario()` instead of duplicating logic in multiple places.

## Where to add data

- Scenario metadata and examples: [seed-data/campaignSeedExamples.ts](../seed-data/campaignSeedExamples.ts)
- Shared validation and slug helpers: [seed-helpers/campaignSeed.ts](../seed-helpers/campaignSeed.ts)
- Type definitions: [types/campaignSeed.ts](../types/campaignSeed.ts)

## Example structure

```ts
{
  id: "seed-onboarding-welcome-series",
  slug: "onboarding-welcome-series",
  name: "Welcome Series",
  category: "onboarding",
  audience: "New signups",
  status: "ready",
  tags: ["campaign", "onboarding", "welcome"],
  recipientHints: ["welcome-team*stealth.demo", "new-user@example.com"],
  description: "A friendly onboarding flow for demo review.",
}
```

## Review checklist

- All recipients remain fake and deterministic.
- Slugs are kebab-case and stable.
- Scenario metadata is documented in the example fixtures.
- Validation helpers are used before the scenario reaches UI code.

## Validation expectations

Use the validation helper to check that:

- names, slugs, and descriptions are present
- recipient hints use safe demo domains
- tags and scenario metadata are non-empty
