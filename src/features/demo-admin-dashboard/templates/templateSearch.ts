import type { MessageTemplate, TemplateCategory } from "./types";

/**
 * Filter and rank templates against a free-text query.
 *
 * Matching is a case-insensitive substring test across the name, subject,
 * category, description, and tags. Results are ranked so name/subject hits
 * surface above tag/description hits, and ties keep their original (stable)
 * order. An empty query returns every template unchanged.
 */
export function searchTemplates(templates: MessageTemplate[], query: string): MessageTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return templates;

  return templates
    .map((template, index) => ({ template, index, score: scoreTemplate(template, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.template);
}

function scoreTemplate(template: MessageTemplate, q: string): number {
  const name = template.name.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (template.subject.toLowerCase().includes(q)) return 40;
  if (template.category.toLowerCase().includes(q)) return 30;
  if (template.tags.some((tag) => tag.toLowerCase().includes(q))) return 20;
  if (template.description.toLowerCase().includes(q)) return 10;
  return 0;
}

/** Group templates by category, preserving list order within each group. */
export function groupByCategory(
  templates: MessageTemplate[],
): Array<{ category: TemplateCategory; templates: MessageTemplate[] }> {
  const groups = new Map<TemplateCategory, MessageTemplate[]>();
  for (const template of templates) {
    const bucket = groups.get(template.category) ?? [];
    bucket.push(template);
    groups.set(template.category, bucket);
  }
  return Array.from(groups, ([category, items]) => ({ category, templates: items }));
}
