import type { CampaignSeedScenario } from "../types/campaignSeed";

const SAFE_DEMO_RECIPIENT_PATTERN = /^(?:[^@\s]+\*stealth\.demo|[^@\s]+@example\.(?:com|org))$/;

/**
 * Convert a human-friendly scenario name into a deterministic slug.
 */
export function toCampaignSeedSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validate that a recipient is safe for demo campaign data.
 */
export function isSafeDemoRecipient(recipient: string): boolean {
  return SAFE_DEMO_RECIPIENT_PATTERN.test(recipient);
}

/**
 * Validate a seed scenario for deterministic, review-safe campaign metadata.
 */
export function validateCampaignSeedScenario(scenario: CampaignSeedScenario): string[] {
  const issues: string[] = [];

  if (!scenario.id.trim()) {
    issues.push("Scenario id is required.");
  }

  if (!scenario.slug.trim()) {
    issues.push("Scenario slug is required.");
  }

  if (!scenario.name.trim()) {
    issues.push("Scenario name is required.");
  }

  if (!scenario.description.trim()) {
    issues.push("Scenario description is required.");
  }

  if (scenario.tags.length === 0) {
    issues.push("At least one campaign tag is required.");
  }

  if (scenario.recipientHints.length === 0) {
    issues.push("At least one recipient hint is required.");
  }

  for (const recipient of scenario.recipientHints) {
    if (!isSafeDemoRecipient(recipient)) {
      issues.push(`Recipient '${recipient}' is not a safe demo address.`);
    }
  }

  return issues;
}
