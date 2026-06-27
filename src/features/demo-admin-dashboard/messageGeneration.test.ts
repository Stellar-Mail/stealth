import { describe, it, expect } from "vitest";
import { generateDemoMessages } from "./messageGeneration";
import { fakePersonas } from "./fixtures";
import type { MessageTemplate, TemplateCategory } from "./templates/types";
import { CAMPAIGN_TEMPLATES as messageTemplates } from "./fixtures/campaignFixtures";
import type { CampaignTemplate, CampaignChecklistItem } from "./types/campaign";

/** Converts campaign templates into a flat list of message templates for testing. */
const getTestTemplates = (campaignTemplates: CampaignTemplate[]): MessageTemplate[] => {
  return campaignTemplates.flatMap((t) =>
    t.checklist.map(
      (c: CampaignChecklistItem): MessageTemplate => ({
        id: c.id,
        name: c.label,
        subject: c.label,
        body: c.description,
        description: c.description,
        category: t.name as TemplateCategory,
        recipients: [],
        tags: [],
      }),
    ),
  );
};

describe("generateDemoMessages", () => {
  const options = {
    count: 5,
    personas: fakePersonas,
    templates: getTestTemplates(messageTemplates),
    seed: "test-seed",
  };

  it("should generate the requested number of messages", () => {
    const messages = generateDemoMessages(options);
    expect(messages).toHaveLength(5);
  });

  it("should be deterministic for a given seed", () => {
    const messages1 = generateDemoMessages(options);
    const messages2 = generateDemoMessages(options);
    expect(messages1).toEqual(messages2);
  });

  it("should produce different results for different seeds", () => {
    const messages1 = generateDemoMessages(options);
    const messages2 = generateDemoMessages({ ...options, seed: "different-seed" });
    expect(messages1).not.toEqual(messages2);
  });

  it("should use data from personas and templates", () => {
    const messages = generateDemoMessages(options);
    const firstMessage = messages[0];

    const personaNames = options.personas.map((p) => p.name);
    const templateSubjects = options.templates.map((t) => t.subject);

    expect(personaNames).toContain(firstMessage.from);
    expect(templateSubjects).toContain(firstMessage.subject);
  });
});
