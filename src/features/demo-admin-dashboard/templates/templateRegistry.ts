import { messageTemplates } from "./messageTemplates";
import { TEMPLATE_SCENARIOS } from "./templateScenarios";
import type { MessageTemplate, TemplateScenario } from "./types";

/** Raised when a template registry receives a duplicate id. */
export class TemplateRegistryConflictError extends Error {
  constructor(public readonly id: string) {
    super(`Template with id "${id}" is already registered`);
    this.name = "TemplateRegistryConflictError";
  }
}

/**
 * Read-only registry for deterministic demo message templates.
 *
 * The registry preserves insertion order, detects duplicate ids before
 * mutations, and can answer scenario-based lookup questions without mutating
 * the underlying template objects.
 */
export class TemplateRegistry<T extends MessageTemplate = MessageTemplate> {
  private readonly templates = new Map<string, T>();

  constructor(initial: readonly T[] = []) {
    this.registerAll(initial);
  }

  get size(): number {
    return this.templates.size;
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }

  get(id: string): T | undefined {
    return this.templates.get(id);
  }

  list(): T[] {
    return [...this.templates.values()];
  }

  ids(): string[] {
    return [...this.templates.keys()];
  }

  register(template: T): this {
    if (this.templates.has(template.id)) {
      throw new TemplateRegistryConflictError(template.id);
    }
    this.templates.set(template.id, template);
    return this;
  }

  registerAll(templates: readonly T[]): this {
    const conflicts = this.detectConflicts(templates);
    if (conflicts.length > 0) {
      throw new TemplateRegistryConflictError(conflicts[0]);
    }
    for (const template of templates) {
      this.templates.set(template.id, template);
    }
    return this;
  }

  detectConflicts(templates: readonly T[]): string[] {
    const seen = new Set<string>();
    const conflicts: string[] = [];
    for (const template of templates) {
      const duplicate = seen.has(template.id) || this.templates.has(template.id);
      if (duplicate && !conflicts.includes(template.id)) {
        conflicts.push(template.id);
      }
      seen.add(template.id);
    }
    return conflicts;
  }

  merge(
    templates: readonly T[],
    strategy: "error" | "skip" | "overwrite" = "error",
  ): string[] {
    if (strategy === "error") {
      const conflicts = this.detectConflicts(templates);
      if (conflicts.length > 0) {
        throw new TemplateRegistryConflictError(conflicts[0]);
      }
      for (const template of templates) {
        this.templates.set(template.id, template);
      }
      return [];
    }

    const conflicts: string[] = [];
    for (const template of templates) {
      if (this.templates.has(template.id)) {
        if (!conflicts.includes(template.id)) {
          conflicts.push(template.id);
        }
        if (strategy === "skip") {
          continue;
        }
      }
      this.templates.set(template.id, template);
    }
    return conflicts;
  }

  clear(): void {
    this.templates.clear();
  }

  /** Returns the scenario metadata that best matches the given template id. */
  getScenario(
    templateId: string,
    scenarios: readonly TemplateScenario[] = TEMPLATE_SCENARIOS,
  ): TemplateScenario | undefined {
    return scenarios.find((scenario) => scenario.templateIds.includes(templateId));
  }

  /** Returns the templates that belong to the given scenario id. */
  getTemplatesForScenario(
    scenarioId: string,
    scenarios: readonly TemplateScenario[] = TEMPLATE_SCENARIOS,
  ): T[] {
    const scenario = scenarios.find((entry) => entry.id === scenarioId);
    if (!scenario) return [];
    return scenario.templateIds.map((templateId) => this.templates.get(templateId)).filter(
      (template): template is T => template !== undefined,
    );
  }
}

/** Convenience factory mirroring the class constructor. */
export function createTemplateRegistry<T extends MessageTemplate = MessageTemplate>(
  initial: readonly T[] = [],
): TemplateRegistry<T> {
  return new TemplateRegistry<T>(initial);
}

/** Shared registry instance seeded with the built-in demo templates. */
export const defaultTemplateRegistry = createTemplateRegistry(messageTemplates);

export { getTemplateScenarioForTemplate } from "./templateScenarios";
