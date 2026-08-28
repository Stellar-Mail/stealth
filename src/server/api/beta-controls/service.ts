import type { BetaControlConfig } from "../../../config/schema";
import { BetaControlStore, type BetaControlPersistence } from "./store";
import type {
  BetaCapability,
  BetaInvite,
  Cohort,
  FeatureFlag,
  KillSwitchRecord,
  KillSwitchState,
} from "./types";

export interface KillSwitchEvaluation {
  capability: BetaCapability;
  enabled: boolean;
  state: KillSwitchState;
  version: number;
  updatedAt: string | null;
  /** "store" = live operator state, "config" = baseline default, "fail_closed" = store unavailable. */
  source: "store" | "config" | "fail_closed";
}

export interface FeatureFlagEvaluation {
  key: string;
  enabled: boolean;
  source: "flag" | "config_default" | "expired";
  reason:
    | "accountDeny"
    | "accountAllow"
    | "percentage"
    | "flagDefault"
    | "configDefault"
    | "expired";
}

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

/**
 * Operator-facing service that evaluates and mutates beta controls. Kill-switch
 * evaluation is fail-closed: if the store cannot be read, the capability is
 * reported disabled. Feature-flag evaluation never bypasses authorization — it
 * only returns a boolean used for gating UI/behavior, never for data access.
 */
export class BetaControlService {
  private store: BetaControlStore;
  private config: BetaControlConfig;
  private ttlMs: number;
  private now: () => number;
  private cache: {
    at: number;
    killSwitches: Record<string, KillSwitchRecord>;
    flags: Record<string, FeatureFlag>;
  } | null = null;

  constructor(opts: {
    config: BetaControlConfig;
    persistence?: BetaControlPersistence;
    now?: () => number;
  }) {
    this.store = new BetaControlStore(opts.persistence);
    this.config = opts.config;
    this.ttlMs = Math.max(1, opts.config.controlTtlSeconds) * 1000;
    this.now = opts.now ?? (() => Date.now());
  }

  async init(): Promise<void> {
    await this.store.init();
  }

  /** Force a cache refresh (used after a local mutation and for tests). */
  invalidateCache(): void {
    this.cache = null;
  }

  private async getEffectiveControls(): Promise<{
    killSwitches: Record<string, KillSwitchRecord>;
    flags: Record<string, FeatureFlag>;
  }> {
    if (this.cache && this.now() - this.cache.at < this.ttlMs) {
      return this.cache;
    }
    const killSwitches = Object.fromEntries(
      this.store.listKillSwitches().map((k) => [k.capability, k]),
    );
    const flags = Object.fromEntries(this.store.listFlags().map((f) => [f.key, f]));
    this.cache = { at: this.now(), killSwitches, flags };
    return this.cache;
  }

  // ---- Kill switches ----

  async evaluateKillSwitch(capability: BetaCapability): Promise<KillSwitchEvaluation> {
    try {
      const controls = await this.getEffectiveControls();
      const rec = controls.killSwitches[capability];
      if (rec) {
        return {
          capability,
          enabled: rec.state !== "closed",
          state: rec.state,
          version: rec.version,
          updatedAt: rec.updatedAt,
          source: "store",
        };
      }
      const def = this.config.killSwitchDefaults[capability] ?? "open";
      return {
        capability,
        enabled: def !== "closed",
        state: def,
        version: 0,
        updatedAt: null,
        source: "config",
      };
    } catch {
      // Fail closed: if we cannot determine state, disable the capability.
      return {
        capability,
        enabled: false,
        state: "closed",
        version: 0,
        updatedAt: null,
        source: "fail_closed",
      };
    }
  }

  async listKillSwitches(): Promise<KillSwitchRecord[]> {
    return this.store.listKillSwitches();
  }

  async setKillSwitch(
    capability: BetaCapability,
    state: KillSwitchState,
    opts: { actor: string; reason?: string; expectedVersion?: number; requestId?: string },
  ): Promise<KillSwitchRecord> {
    const record = await this.store.setKillSwitch(capability, state, opts);
    this.invalidateCache();
    return record;
  }

  // ---- Feature flags ----

  async isFeatureEnabled(
    key: string,
    opts: { account?: string } = {},
  ): Promise<FeatureFlagEvaluation> {
    const controls = await this.getEffectiveControls();
    const flag = controls.flags[key];
    if (!flag) {
      const def = this.config.featureFlagDefaults[key] ?? false;
      return { key, enabled: def, source: "config_default", reason: "configDefault" };
    }
    if (flag.expiresAt && new Date(flag.expiresAt).getTime() < this.now()) {
      return {
        key,
        enabled: this.config.featureFlagDefaults[key] ?? false,
        source: "expired",
        reason: "expired",
      };
    }
    if (
      opts.account &&
      flag.accountDeny.map((a) => a.toUpperCase()).includes(opts.account.toUpperCase())
    ) {
      return { key, enabled: false, source: "flag", reason: "accountDeny" };
    }
    if (
      opts.account &&
      flag.accountAllow.map((a) => a.toUpperCase()).includes(opts.account.toUpperCase())
    ) {
      return { key, enabled: true, source: "flag", reason: "accountAllow" };
    }
    if (flag.percentage !== null && opts.account) {
      const rollout = stableHash(`${key}:${opts.account}`);
      return { key, enabled: rollout < flag.percentage, source: "flag", reason: "percentage" };
    }
    return { key, enabled: flag.enabled, source: "flag", reason: "flagDefault" };
  }

  async listFlags(): Promise<FeatureFlag[]> {
    return this.store.listFlags();
  }

  async getFlag(key: string): Promise<FeatureFlag | undefined> {
    return this.store.getFlag(key);
  }

  async upsertFlag(flag: FeatureFlag): Promise<FeatureFlag> {
    const saved = await this.store.upsertFlag(flag);
    this.invalidateCache();
    return saved;
  }

  async deleteFlag(key: string, actor: string, requestId?: string): Promise<void> {
    await this.store.deleteFlag(key, actor, requestId);
    this.invalidateCache();
  }

  // ---- Cohorts ----

  async listCohorts(): Promise<Cohort[]> {
    return this.store.listCohorts();
  }

  async getCohort(id: string): Promise<Cohort | undefined> {
    return this.store.getCohort(id);
  }

  async upsertCohort(cohort: Cohort, opts: { expectedVersion?: number } = {}): Promise<Cohort> {
    const saved = await this.store.upsertCohort(cohort, opts);
    this.invalidateCache();
    return saved;
  }

  async deleteCohort(id: string, actor: string, requestId?: string): Promise<void> {
    await this.store.deleteCohort(id, actor, requestId);
    this.invalidateCache();
  }

  // ---- Invites ----

  async listInvites(): Promise<BetaInvite[]> {
    return this.store.listInvites();
  }

  async getInvite(code: string): Promise<BetaInvite | undefined> {
    return this.store.getInvite(code);
  }

  async createInvite(input: {
    code: string;
    cohortId: string | null;
    createdBy: string;
    expiresAt?: string | null;
    reason?: string;
  }): Promise<BetaInvite> {
    const saved = await this.store.createInvite(input);
    this.invalidateCache();
    return saved;
  }

  async redeemInvite(code: string, account: string): Promise<BetaInvite> {
    const saved = await this.store.redeemInvite(code, account);
    this.invalidateCache();
    return saved;
  }

  async revokeInvite(
    code: string,
    actor: string,
    reason?: string,
    requestId?: string,
  ): Promise<BetaInvite> {
    const saved = await this.store.revokeInvite(code, actor, reason, requestId);
    this.invalidateCache();
    return saved;
  }

  /** Rolls a redeemed invite back to active (used to release a failed registration). */
  async releaseInviteRedemption(code: string, actor = "system"): Promise<BetaInvite> {
    const saved = await this.store.releaseInviteRedemption(code, actor);
    this.invalidateCache();
    return saved;
  }

  getAudit() {
    return this.store.getAudit();
  }
}
