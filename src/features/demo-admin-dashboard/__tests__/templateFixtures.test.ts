import { describe, expect, it } from "vitest";
import { templateFixtures, buildTemplateFixtures } from "../fixtures/templateFixtures";
import { messageTemplates } from "../templates/messageTemplates";
import { TEMPLATE_SCENARIOS } from "../templates/templateScenarios";

describe("templateFixtures", () => {
  it("are deterministic and derived from the built-in templates", () => {
    const fixtures = buildTemplateFixtures();
    expect(fixtures).toEqual(templateFixtures);
    expect(buildTemplateFixtures(messageTemplates, TEMPLATE_SCENARIOS)).toEqual(templateFixtures);
  });

  it("link every fixture back to a valid scenario and template", () => {
    const templateIds = new Set(messageTemplates.map((template) => template.id));
    const scenarioIds = new Set(TEMPLATE_SCENARIOS.map((scenario) => scenario.id));

    for (const fixture of templateFixtures) {
      expect(templateIds.has(fixture.templateId)).toBe(true);
      expect(scenarioIds.has(fixture.scenarioId)).toBe(true);
      expect(fixture.templateName.trim()).not.toBe("");
      expect(fixture.scenarioName.trim()).not.toBe("");
      expect(fixture.subject.trim()).not.toBe("");
      expect(fixture.body.trim()).not.toBe("");
      expect(fixture.recipients.length).toBeGreaterThan(0);
      expect(fixture.tags.length).toBeGreaterThan(0);
    }
  });
});

