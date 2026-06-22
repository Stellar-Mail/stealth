import type { CampaignSeedScenario } from "../types/campaignSeed";

/**
 * Deterministic example seed scenarios that contributors can reuse when
 * building demo campaign data for the admin dashboard.
 */
export const campaignSeedExamples: CampaignSeedScenario[] = [
  {
    id: "seed-onboarding-welcome-series",
    slug: "onboarding-welcome-series",
    name: "Welcome Series",
    category: "onboarding",
    audience: "New signups",
    status: "ready",
    tags: ["campaign", "onboarding", "welcome"],
    recipientHints: ["welcome-team*stealth.demo", "new-user@example.com", "ops@example.org"],
    description:
      "A friendly onboarding flow that introduces the demo mailbox and core account actions.",
  },
  {
    id: "seed-security-alert-review",
    slug: "security-alert-review",
    name: "Security Alert Review",
    category: "security",
    audience: "Admin reviewers",
    status: "needs-review",
    tags: ["campaign", "security", "review"],
    recipientHints: ["security-team*stealth.demo", "review@example.com", "compliance@example.org"],
    description:
      "A review-oriented security scenario used to validate copy, urgency, and audit language.",
  },
  {
    id: "seed-newsletter-product-update",
    slug: "newsletter-product-update",
    name: "Product Update Newsletter",
    category: "newsletter",
    audience: "Existing subscribers",
    status: "draft",
    tags: ["campaign", "newsletter", "product"],
    recipientHints: ["updates*stealth.demo", "subscribers@example.com", "support@example.org"],
    description:
      "A recurring newsletter scenario that exercises campaign metadata and preview layout.",
  },
];

/**
 * Return the seed scenarios that match a specific tag.
 */
export function getCampaignSeedExamplesByTag(
  examples: readonly CampaignSeedScenario[],
  tag: string,
): CampaignSeedScenario[] {
  return examples.filter((example) => example.tags.includes(tag));
}

/**
 * Return seed scenarios that match a specific campaign category.
 */
export function getCampaignSeedExamplesByCategory(
  examples: readonly CampaignSeedScenario[],
  category: CampaignSeedScenario["category"],
): CampaignSeedScenario[] {
  return examples.filter((example) => example.category === category);
}
