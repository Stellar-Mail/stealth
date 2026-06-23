/**
 * Policy Configuration Management Service
 * 
 * Manages user policy configurations during the pilot program.
 * Provides CRUD operations for policy rules and configurations.
 */

import type {
  PolicyRule,
  PolicyConfiguration,
  PilotPolicyCategory,
} from "./types";

export class PolicyConfigurationService {
  private configurations: Map<string, PolicyConfiguration> = new Map();

  /**
   * Initialize or get existing policy configuration for a user.
   */
  initializeConfiguration(
    userId: string,
    defaultCategory: PilotPolicyCategory = "request",
  ): PolicyConfiguration {
    if (this.configurations.has(userId)) {
      return this.configurations.get(userId)!;
    }

    const config: PolicyConfiguration = {
      userId,
      rules: [],
      defaultCategory,
      restrictivePolicyEnabled: false,
    };

    this.configurations.set(userId, config);
    return config;
  }

  /**
   * Get current policy configuration for a user.
   */
  getConfiguration(userId: string): PolicyConfiguration | undefined {
    return this.configurations.get(userId);
  }

  /**
   * Add a policy rule for a sender.
   */
  addRule(
    userId: string,
    senderIdentifier: string,
    category: PilotPolicyCategory,
  ): PolicyRule {
    const config = this.initializeConfiguration(userId);

    const rule: PolicyRule = {
      id: crypto.randomUUID(),
      senderIdentifier,
      category,
      createdAt: Date.now(),
      lastModifiedAt: Date.now(),
    };

    config.rules.push(rule);
    return rule;
  }

  /**
   * Update an existing policy rule.
   */
  updateRule(
    userId: string,
    ruleId: string,
    category: PilotPolicyCategory,
  ): PolicyRule | undefined {
    const config = this.getConfiguration(userId);
    if (!config) return undefined;

    const rule = config.rules.find((r) => r.id === ruleId);
    if (!rule) return undefined;

    rule.category = category;
    rule.lastModifiedAt = Date.now();
    return rule;
  }

  /**
   * Delete a policy rule.
   */
  deleteRule(userId: string, ruleId: string): boolean {
    const config = this.getConfiguration(userId);
    if (!config) return false;

    const index = config.rules.findIndex((r) => r.id === ruleId);
    if (index === -1) return false;

    config.rules.splice(index, 1);
    return true;
  }

  /**
   * Get a specific rule by ID.
   */
  getRule(userId: string, ruleId: string): PolicyRule | undefined {
    const config = this.getConfiguration(userId);
    return config?.rules.find((r) => r.id === ruleId);
  }

  /**
   * Get all rules for a user.
   */
  getRules(userId: string): PolicyRule[] {
    const config = this.getConfiguration(userId);
    return config?.rules || [];
  }

  /**
   * Find applicable rule for a sender (first match).
   */
  findApplicableRule(
    userId: string,
    senderIdentifier: string,
  ): PolicyRule | undefined {
    const config = this.getConfiguration(userId);
    if (!config) return undefined;

    return config.rules.find((rule) => {
      // Exact match or pattern match (if senderIdentifier contains *)
      if (rule.senderIdentifier.includes("*")) {
        const pattern = rule.senderIdentifier.replace(/\*/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(senderIdentifier);
      }
      return rule.senderIdentifier === senderIdentifier;
    });
  }

  /**
   * Determine policy category for a sender.
   * First checks specific rules, then returns default category.
   */
  determinePolicyCategory(
    userId: string,
    senderIdentifier: string,
  ): PilotPolicyCategory {
    const rule = this.findApplicableRule(userId, senderIdentifier);
    if (rule) {
      return rule.category;
    }

    const config = this.getConfiguration(userId);
    return config?.defaultCategory || "request";
  }

  /**
   * Enable restrictive policy mode for a user.
   */
  enableRestrictivePolicy(userId: string): boolean {
    const config = this.initializeConfiguration(userId);
    if (!config.restrictivePolicyEnabled) {
      config.restrictivePolicyEnabled = true;
      config.enabledAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Disable restrictive policy mode for a user.
   */
  disableRestrictivePolicy(userId: string): boolean {
    const config = this.getConfiguration(userId);
    if (config && config.restrictivePolicyEnabled) {
      config.restrictivePolicyEnabled = false;
      return true;
    }
    return false;
  }

  /**
   * Check if restrictive policy is enabled for a user.
   */
  isRestrictivePolicyEnabled(userId: string): boolean {
    return this.getConfiguration(userId)?.restrictivePolicyEnabled || false;
  }

  /**
   * Get all configurations (for admin/analysis).
   */
  getAllConfigurations(): PolicyConfiguration[] {
    return Array.from(this.configurations.values());
  }

  /**
   * Clear all data (useful for testing).
   */
  clearData(): void {
    this.configurations.clear();
  }
}

export const policyService = new PolicyConfigurationService();
