import type { MessageTemplate } from "./types";

export interface TemplateScenarioMetadata {
  /** Why this group is useful for maintainers populating demo data. */
  demoGoal: string;
  /** Safety notes reviewers can use to confirm the data stays fake. */
  safeDataNotes: string[];
  /** Where the scenario is expected to be previewed inside the demo admin dashboard. */
  previewSurface: "templates" | "mail" | "campaigns" | "audit";
}

export interface MessageTemplateScenario {
  id: string;
  label: string;
  description: string;
  templateIds: string[];
  metadata: TemplateScenarioMetadata;
}

export interface TemplateRegistryEntry {
  scenario: MessageTemplateScenario;
  templates: MessageTemplate[];
}

export const messageTemplateScenarios: MessageTemplateScenario[] = [
  {
    id: "first-run-onboarding",
    label: "First-run onboarding",
    description: "Welcome copy for a brand-new Stealth demo mailbox.",
    templateIds: ["welcome-intro"],
    metadata: {
      demoGoal: "Populate a new-account inbox with a friendly first message.",
      safeDataNotes: ["Uses only the reserved new.user*stealth.demo recipient."],
      previewSurface: "templates",
    },
  },
  {
    id: "paid-message-proof",
    label: "Paid message proof",
    description: "Receipt-style messages that show fake postage and proof metadata.",
    templateIds: ["postage-receipt", "delivery-proof"],
    metadata: {
      demoGoal: "Exercise proof, receipt, and postage-like preview states without live value.",
      safeDataNotes: [
        "Amounts are tiny synthetic XLM examples.",
        "Proof references are demo strings and not live settlement data.",
      ],
      previewSurface: "mail",
    },
  },
  {
    id: "account-security",
    label: "Account security",
    description: "One-time code copy for security and OTP demo surfaces.",
    templateIds: ["verify-code"],
    metadata: {
      demoGoal: "Show a security-sensitive message shape using a fixed fake code.",
      safeDataNotes: ["The passkey is deterministic demo text and is not an auth secret."],
      previewSurface: "mail",
    },
  },
  {
    id: "event-follow-up",
    label: "Event follow-up",
    description: "Calendar-style invitation copy for event preview cards.",
    templateIds: ["event-invite"],
    metadata: {
      demoGoal: "Populate calendar and RSVP preview states with a fake event invitation.",
      safeDataNotes: ["Date, location, and organizer details are synthetic."],
      previewSurface: "mail",
    },
  },
  {
    id: "product-update",
    label: "Product update",
    description: "Digest-style product copy for long-form message rendering.",
    templateIds: ["product-newsletter"],
    metadata: {
      demoGoal: "Exercise newsletter and list rendering in the demo inbox.",
      safeDataNotes: ["No external links or real subscriber data are included."],
      previewSurface: "templates",
    },
  },
  {
    id: "internal-review",
    label: "Internal review",
    description: "Maintainer-facing status note for campaign and copy review flows.",
    templateIds: ["campaign-review-note"],
    metadata: {
      demoGoal: "Support admin review scenarios before template copy is inserted.",
      safeDataNotes: ["Recipients use only the campaign-team*stealth.demo handle."],
      previewSurface: "campaigns",
    },
  },
];

function templateMap(templates: readonly MessageTemplate[]): Map<string, MessageTemplate> {
  return new Map(templates.map((template) => [template.id, template]));
}

export function validateTemplateRegistry(
  templates: readonly MessageTemplate[],
  scenarios: readonly MessageTemplateScenario[],
): string[] {
  const templatesById = templateMap(templates);
  const seenScenarioIds = new Set<string>();
  const issues: string[] = [];

  for (const scenario of scenarios) {
    if (seenScenarioIds.has(scenario.id)) {
      issues.push('Duplicate scenario id "' + scenario.id + '".');
    }
    seenScenarioIds.add(scenario.id);

    for (const templateId of scenario.templateIds) {
      if (!templatesById.has(templateId)) {
        issues.push(
          'Scenario "' + scenario.id + '" references missing template "' + templateId + '".',
        );
      }
    }
  }

  return issues;
}

export function buildTemplateRegistry(
  templates: readonly MessageTemplate[],
  scenarios: readonly MessageTemplateScenario[] = messageTemplateScenarios,
): TemplateRegistryEntry[] {
  const templatesById = templateMap(templates);

  return scenarios.map((scenario) => ({
    scenario,
    templates: scenario.templateIds
      .map((templateId) => templatesById.get(templateId))
      .filter((template): template is MessageTemplate => Boolean(template)),
  }));
}

export function getTemplatesForScenario(
  scenarioId: string,
  templates: readonly MessageTemplate[],
  scenarios: readonly MessageTemplateScenario[] = messageTemplateScenarios,
): MessageTemplate[] {
  return buildTemplateRegistry(templates, scenarios).find(
    (entry) => entry.scenario.id === scenarioId,
  )?.templates ?? [];
}
