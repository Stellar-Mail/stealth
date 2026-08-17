import type { InboxRule, RuleId, CreateRuleInput, UpdateRuleInput, ServiceConfig } from "../types";

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
    const now = new Date().toISOString();
    const rule: InboxRule = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      enabled: true,
      priority: input.priority ?? 0,
      conditionGroups: input.conditionGroups,
      actions: input.actions,
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

    const updated: InboxRule = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.conditionGroups !== undefined ? { conditionGroups: input.conditionGroups } : {}),
      ...(input.actions !== undefined ? { actions: input.actions } : {}),
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
      this.rules.set(rule.id, { ...rule });
    }
  }
}
