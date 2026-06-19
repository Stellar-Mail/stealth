import type { InboxRule, RuleId, CreateRuleInput, UpdateRuleInput, ServiceConfig } from "../types";
import {
  ValidationService,
  MAX_RULE_NAME_LENGTH,
  MAX_RULE_DESCRIPTION_LENGTH,
} from "./validation.service";

export class RuleStorageService {
  private rules: Map<RuleId, InboxRule>;
  private config: ServiceConfig;

  constructor(seedRules?: InboxRule[], config?: Partial<ServiceConfig>) {
    this.rules = new Map();
    this.config = { delayMs: 0, ...config };
    if (seedRules) {
      for (const rule of seedRules) {
        this.rules.set(rule.id, { ...rule });
      }
    }
  }

  private async delay(): Promise<void> {
    if (this.config.delayMs > 0) {
      return new Promise((resolve) => setTimeout(resolve, this.config.delayMs));
    }
  }

  async addRule(input: CreateRuleInput): Promise<InboxRule> {
    await this.delay();

    // Security hardening: Validate and sanitize input
    const validatedInput = ValidationService.validateCreateRule(input);
    const now = new Date().toISOString();

    const rule: InboxRule = {
      id: crypto.randomUUID(),
      name: ValidationService.sanitizeString(validatedInput.name, MAX_RULE_NAME_LENGTH),
      description: ValidationService.sanitizeString(
        validatedInput.description ?? "",
        MAX_RULE_DESCRIPTION_LENGTH
      ),
      enabled: true,
      priority: validatedInput.priority ?? 0,
      conditionGroups: validatedInput.conditionGroups,
      actions: validatedInput.actions,
      createdAt: now,
      updatedAt: now,
    };

    this.rules.set(rule.id, rule);
    return { ...rule };
  }

  async getRule(id: RuleId): Promise<InboxRule | undefined> {
    await this.delay();
    const rule = this.rules.get(id);
    return rule ? { ...rule } : undefined;
  }

  async getAllRules(): Promise<InboxRule[]> {
    await this.delay();
    return Array.from(this.rules.values())
      .map((r) => ({ ...r }))
      .sort((a, b) => a.priority - b.priority);
  }

  async updateRule(id: RuleId, input: UpdateRuleInput): Promise<InboxRule | undefined> {
    await this.delay();
    const existing = this.rules.get(id);
    if (!existing) return undefined;

    // Security hardening: Validate and sanitize input
    const validatedInput = ValidationService.validateUpdateRule(input);

    const updated: InboxRule = {
      ...existing,
      ...(validatedInput.name !== undefined
        ? { name: ValidationService.sanitizeString(validatedInput.name, MAX_RULE_NAME_LENGTH) }
        : {}),
      ...(validatedInput.description !== undefined
        ? {
            description: ValidationService.sanitizeString(
              validatedInput.description,
              MAX_RULE_DESCRIPTION_LENGTH
            ),
          }
        : {}),
      ...(validatedInput.enabled !== undefined ? { enabled: validatedInput.enabled } : {}),
      ...(validatedInput.priority !== undefined ? { priority: validatedInput.priority } : {}),
      ...(validatedInput.conditionGroups !== undefined
        ? { conditionGroups: validatedInput.conditionGroups }
        : {}),
      ...(validatedInput.actions !== undefined ? { actions: validatedInput.actions } : {}),
      updatedAt: new Date().toISOString(),
    };

    this.rules.set(id, updated);
    return { ...updated };
  }

  async deleteRule(id: RuleId): Promise<boolean> {
    await this.delay();
    return this.rules.delete(id);
  }

  async toggleRule(id: RuleId): Promise<InboxRule | undefined> {
    await this.delay();
    const existing = this.rules.get(id);
    if (!existing) return undefined;

    const updated: InboxRule = {
      ...existing,
      enabled: !existing.enabled,
      updatedAt: new Date().toISOString(),
    };

    this.rules.set(id, updated);
    return { ...updated };
  }

  async searchRules(query: string): Promise<InboxRule[]> {
    await this.delay();
    const q = query.toLowerCase();
    return Array.from(this.rules.values())
      .filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q))
      .map((r) => ({ ...r }))
      .sort((a, b) => a.priority - b.priority);
  }

  exportRules(): InboxRule[] {
    return Array.from(this.rules.values()).map((r) => ({ ...r }));
  }

  importRules(rules: InboxRule[]): void {
    for (const rule of rules) {
      try {
        // Security hardening: Validate each rule before import
        const validatedRule = ValidationService.validateRule(rule);
        this.rules.set(validatedRule.id, { ...validatedRule });
      } catch (err) {
        console.error(`Skipping invalid rule during import: ${rule.id}`, err);
      }
    }
  }
}
