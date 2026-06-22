import { describe, expect, it } from "vitest";
import { messageTemplates } from "../templates/messageTemplates";
import {
  buildTemplateRegistry,
  getTemplatesForScenario,
  messageTemplateScenarios,
  validateTemplateRegistry,
} from "../templates/templateRegistry";

describe("message template scenario registry", () => {
  it("builds deterministic scenario entries from the template catalog", () => {
    const registry = buildTemplateRegistry(messageTemplates, messageTemplateScenarios);
    const second = buildTemplateRegistry(messageTemplates, messageTemplateScenarios);

    expect(registry).toEqual(second);
    expect(registry.map((entry) => entry.scenario.id)).toEqual([
      "first-run-onboarding",
      "paid-message-proof",
      "account-security",
      "event-follow-up",
      "product-update",
      "internal-review",
    ]);
    expect(registry[0].templates.map((template) => template.id)).toEqual(["welcome-intro"]);
  });

  it("returns templates for a known scenario id", () => {
    const templates = getTemplatesForScenario(
      "paid-message-proof",
      messageTemplates,
      messageTemplateScenarios,
    );

    expect(templates.map((template) => template.id)).toEqual([
      "postage-receipt",
      "delivery-proof",
    ]);
  });

  it("validates duplicate scenario ids and missing template references", () => {
    const [firstScenario] = messageTemplateScenarios;
    const issues = validateTemplateRegistry(messageTemplates, [
      firstScenario,
      firstScenario,
      {
        id: "broken-scenario",
        label: "Broken scenario",
        description: "References a missing template.",
        templateIds: ["not-a-template"],
        metadata: {
          demoGoal: "invalid fixture",
          safeDataNotes: ["synthetic only"],
          previewSurface: "templates",
        },
      },
    ]);

    expect(issues).toEqual([
      'Duplicate scenario id "first-run-onboarding".',
      'Scenario "broken-scenario" references missing template "not-a-template".',
    ]);
  });

  it("keeps every catalog template covered by at least one scenario", () => {
    const covered = new Set(messageTemplateScenarios.flatMap((scenario) => scenario.templateIds));
    expect(messageTemplates.every((template) => covered.has(template.id))).toBe(true);
    expect(validateTemplateRegistry(messageTemplates, messageTemplateScenarios)).toEqual([]);
  });
});
