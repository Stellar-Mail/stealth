import { describe, it, expect } from "vitest";
import { generateDemoMessages } from "./messageGeneration";
import { fakePersonas } from "./fixtures";
import type { TemplateCategory } from "./templates/types";
import { CAMPAIGN_TEMPLATES as messageTemplates } from "./fixtures/campaignFixtures";

describe("generateDemoMessages", () => {
  const options = {
    count: 5,
    personas: fakePersonas,
    templates: messageTemplates.flatMap((t) =>
      t.checklist.map((c) => ({
        ...t, // Spread the rest of the properties from the template
        id: c.id, // Override with specific checklist item id
        subject: c.label, // Use checklist item label as subject
        body: c.description, // Use checklist item description as body
        name: c.label, // Use checklist item label as name
        description: c.description, // Use checklist item description
        category: t.name as TemplateCategory, // Assign category from parent template
        recipients: [], // Add missing property
        tags: [], // Add missing property
      })),
    ),
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
