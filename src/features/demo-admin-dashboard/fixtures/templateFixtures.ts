import { messageTemplates } from "../templates/messageTemplates";
import { TEMPLATE_SCENARIOS } from "../templates/templateScenarios";
import type { TemplateDemoFixture } from "../templates/types";

/**
 * Builds deterministic fixture rows for the reusable template library.
 *
 * The output is static and repeatable: templates are emitted in scenario order,
 * then by template order inside each scenario. That keeps tests and docs stable
 * while still showing how a single template can appear in multiple contexts.
 */
export function buildTemplateFixtures(
  templates = messageTemplates,
  scenarios = TEMPLATE_SCENARIOS,
): TemplateDemoFixture[] {
  const templateById = new Map(templates.map((template) => [template.id, template] as const));
  const fixtures: TemplateDemoFixture[] = [];

  for (const scenario of scenarios) {
    for (const templateId of scenario.templateIds) {
      const template = templateById.get(templateId);
      if (!template) {
        throw new Error(`Missing template "${templateId}" for scenario "${scenario.id}"`);
      }

      fixtures.push({
        id: `template-fixture-${scenario.id}-${template.id}`,
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        templateId: template.id,
        templateName: template.name,
        category: template.category,
        subject: template.subject,
        body: template.body,
        recipients: [...template.recipients],
        tags: [...new Set([...scenario.tags, ...template.tags])],
      });
    }
  }

  return fixtures;
}

/** Built-in deterministic demo fixtures for the template library. */
export const templateFixtures = buildTemplateFixtures();

