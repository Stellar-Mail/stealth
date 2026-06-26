/**
 * Deterministic metadata for demo campaign seed scenarios.
 */
export interface CampaignSeedScenario {
  /** Stable identifier used for fixture lookup and docs. */
  id: string;
  /** URL-friendly slug that follows the contributor naming convention. */
  slug: string;
  /** Human-readable campaign label shown in review tooling. */
  name: string;
  /** Campaign family used for grouping related demo scenarios. */
  category: "onboarding" | "security" | "newsletter" | "review";
  /** Intended audience label for story-driven previews. */
  audience: string;
  /** Review status used by maintainers when triaging scenarios. */
  status: "draft" | "ready" | "needs-review";
  /** Tags that help contributors search and filter seed scenarios. */
  tags: string[];
  /** Reserved demo recipients used for preview examples. */
  recipientHints: string[];
  /** Short summary that explains why the scenario matters. */
  description: string;
}

/**
 * A seeded example that pairs a scenario with helpful reviewer notes.
 */
export interface CampaignSeedExample {
  /** The scenario being documented. */
  scenario: CampaignSeedScenario;
  /** Reviewer-facing notes for previewing the example safely. */
  notes: string[];
}
