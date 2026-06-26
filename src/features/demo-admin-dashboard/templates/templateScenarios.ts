import type { TemplateScenario } from "./types";

/**
 * Scenario metadata for the reusable demo message template library.
 *
 * Each scenario groups one or more templates into a reviewer-friendly story
 * that can be searched, documented, and reused by deterministic fixtures.
 */
export const TEMPLATE_SCENARIOS: TemplateScenario[] = [
  {
    id: "onboarding-welcome",
    name: "Onboarding Welcome",
    description: "New-account messaging that introduces Stealth and sets expectations.",
    category: "welcome",
    templateIds: ["welcome-intro"],
    tags: ["onboarding", "welcome", "first-run"],
  },
  {
    id: "settlement-receipt",
    name: "Settlement Receipt",
    description: "Postage and delivery receipts that show deterministic transaction follow-up.",
    category: "transactional",
    templateIds: ["postage-receipt", "delivery-proof"],
    tags: ["receipt", "settlement", "proof"],
  },
  {
    id: "identity-verification",
    name: "Identity Verification",
    description: "Login and security templates for code delivery and auth review.",
    category: "security",
    templateIds: ["verify-code"],
    tags: ["security", "otp", "authentication"],
  },
  {
    id: "event-rsvp",
    name: "Event RSVP",
    description: "Calendar-like invitations for demo event and roundtable workflows.",
    category: "event",
    templateIds: ["event-invite"],
    tags: ["event", "calendar", "rsvp"],
  },
  {
    id: "product-update",
    name: "Product Update",
    description: "Newsletter-style product updates for scanning longer demo content.",
    category: "newsletter",
    templateIds: ["product-newsletter"],
    tags: ["newsletter", "digest", "product"],
  },
  {
    id: "campaign-review",
    name: "Campaign Review",
    description: "Internal templates for validating campaign copy before release.",
    category: "internal",
    templateIds: ["campaign-review-note"],
    tags: ["internal", "campaign", "review"],
  },
];

/**
 * Returns the first scenario that references the given template id.
 *
 * The lookup is deterministic because the scenario list is static and the
 * first matching entry wins when a template is intentionally shared.
 */
export function getTemplateScenarioForTemplate(templateId: string): TemplateScenario | undefined {
  return TEMPLATE_SCENARIOS.find((scenario) => scenario.templateIds.includes(templateId));
}

