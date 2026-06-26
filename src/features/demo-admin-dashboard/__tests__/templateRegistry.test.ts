import { describe, expect, it } from "vitest";
import { messageTemplates } from "../templates/messageTemplates";
import {
  createTemplateRegistry,
  defaultTemplateRegistry,
  TemplateRegistry,
  TemplateRegistryConflictError,
} from "../templates/templateRegistry";
import { TEMPLATE_SCENARIOS } from "../templates/templateScenarios";
import type { MessageTemplate } from "../templates/types";

const template = messageTemplates[0];

function cloneTemplate(overrides: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    ...template,
    ...overrides,
    recipients: [...(overrides.recipients ?? template.recipients)],
    tags: [...(overrides.tags ?? template.tags)],
  };
}

describe("TemplateRegistry", () => {
  it("keeps insertion order and supports lookup", () => {
    const registry = new TemplateRegistry([messageTemplates[0], messageTemplates[1]]);
    expect(registry.size).toBe(2);
    expect(registry.ids()).toEqual([messageTemplates[0].id, messageTemplates[1].id]);
    expect(registry.get(messageTemplates[1].id)).toBe(messageTemplates[1]);
  });

  it("rejects duplicate ids with a stable error", () => {
    const registry = new TemplateRegistry([messageTemplates[0]]);
    expect(() => registry.register(messageTemplates[0])).toThrow(TemplateRegistryConflictError);
    expect(registry.size).toBe(1);
  });

  it("detects scenario-aware templates without mutating the registry", () => {
    const registry = createTemplateRegistry(messageTemplates);
    const scenario = registry.getScenario("campaign-review-note", TEMPLATE_SCENARIOS);
    expect(scenario?.id).toBe("campaign-review");
    expect(registry.getTemplatesForScenario("campaign-review")).toEqual([
      messageTemplates.find((item) => item.id === "campaign-review-note"),
    ]);
    expect(defaultTemplateRegistry.list()).toEqual(messageTemplates);
  });

  it("merges without mutating the input templates", () => {
    const registry = new TemplateRegistry([messageTemplates[0]]);
    const incoming = cloneTemplate({ id: "template-extra" });
    const conflicts = registry.merge([incoming], "skip");
    expect(conflicts).toEqual([]);
    expect(registry.has("template-extra")).toBe(true);
  });
});

