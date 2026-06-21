import { describe, it, expect } from "vitest";
import {
  generateCampaignFixtures,
  DEFAULT_CAMPAIGN_SCENARIOS,
  DEFAULT_CAMPAIGN_PERSONAS,
  DEFAULT_CAMPAIGN_TEMPLATES,
  type CampaignFixture,
} from "./campaignFixtureGenerator";

describe("generateCampaignFixtures", () => {
  it("generates the requested number of fixtures", () => {
    expect(generateCampaignFixtures({ seed: "demo", count: 4 })).toHaveLength(4);
  });

  it("defaults to five fixtures", () => {
    expect(generateCampaignFixtures({ seed: 1 })).toHaveLength(5);
  });

  it("is deterministic for the same seed", () => {
    const first = generateCampaignFixtures({ seed: "launch", count: 6 });
    const second = generateCampaignFixtures({ seed: "launch", count: 6 });
    expect(first).toEqual(second);
  });

  it("produces different data for different seeds", () => {
    const a = generateCampaignFixtures({ seed: "seed-a", count: 6 });
    const b = generateCampaignFixtures({ seed: "seed-b", count: 6 });
    expect(a).not.toEqual(b);
  });

  it("only uses values from the provided catalogs", () => {
    const fixtures = generateCampaignFixtures({ seed: "catalog", count: 10 });
    const scenarioIds = DEFAULT_CAMPAIGN_SCENARIOS.map((scenario) => scenario.id);
    const personaIds = DEFAULT_CAMPAIGN_PERSONAS.map((persona) => persona.id);
    const templateIds = DEFAULT_CAMPAIGN_TEMPLATES.map((template) => template.id);
    fixtures.forEach((fixture) => {
      expect(scenarioIds).toContain(fixture.scenarioId);
      expect(personaIds).toContain(fixture.personaId);
      expect(templateIds).toContain(fixture.templateId);
    });
  });

  it("keeps recipient emails on safe demo domains", () => {
    const fixtures = generateCampaignFixtures({ seed: "safe", count: 8 });
    fixtures.forEach((fixture) => {
      expect(fixture.recipientEmail).toMatch(/@example\.com$/);
    });
  });

  it("renders template placeholders with persona and scenario names", () => {
    const fixtures: CampaignFixture[] = generateCampaignFixtures({ seed: "render", count: 3 });
    fixtures.forEach((fixture) => {
      expect(fixture.subject).not.toContain("{");
      expect(fixture.body).not.toContain("{");
    });
  });

  it("throws when a catalog is empty", () => {
    expect(() => generateCampaignFixtures({ seed: "x", scenarios: [] })).toThrow();
  });
});
