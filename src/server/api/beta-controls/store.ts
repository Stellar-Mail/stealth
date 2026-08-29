import { ApiError } from "../errors";
import {
  type BetaCapability,
  type BetaControlAuditEvent,
  type BetaInvite,
  type Cohort,
  type FeatureFlag,
  type KillSwitchRecord,
  type KillSwitchState,
  betaInviteSchema,
  cohortSchema,
  featureFlagSchema,
  killSwitchRecordSchema,
} from "./types";

/**
 * Optional persistence adapter. The default in-memory adapter is used for local
 * and test runs; a production deployment injects a KV-backed adapter so operator
 * mutations survive restarts and are visible across workers (combined with the
 * bounded-TTL cache for propagation).
 */
export interface BetaControlPersistence {
  load(): Promise<BetaControlSnapshotData | null>;
  save(snapshot: BetaControlSnapshotData): Promise<void>;
}

export interface BetaControlSnapshotData {
  killSwitches: Record<string, KillSwitchRecord>;
  flags: Record<string, FeatureFlag>;
  cohorts: Record<string, Cohort>;
  invites: Record<string, BetaInvite>;
  audit: BetaControlAuditEvent[];
}

export class MemoryPersistence implements BetaControlPersistence {
  private data: BetaControlSnapshotData | null = null;
  async load() {
    return this.data;
  }
  async save(snapshot: BetaControlSnapshotData) {
    this.data = snapshot;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${rand}`;
}

/**
 * Authoritative, in-process store for beta controls. All mutations are
 * serialized through an async mutex so concurrent operator changes are safe,
 * and optimistic-concurrency is enforced via per-record `version` numbers
 * (stale writes are rejected with a 409 conflict).
 */
export class BetaControlStore {
  private killSwitches = new Map<string, KillSwitchRecord>();
  private flags = new Map<string, FeatureFlag>();
  private cohorts = new Map<string, Cohort>();
  private invites = new Map<string, BetaInvite>();
  private audit: BetaControlAuditEvent[] = [];
  private mutex: Promise<unknown> = Promise.resolve();
  private persistence: BetaControlPersistence;

  constructor(persistence?: BetaControlPersistence) {
    this.persistence = persistence ?? new MemoryPersistence();
  }

  /** Serialize a mutating operation. */
  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.mutex.then(fn, fn);
    this.mutex = next.catch(() => undefined);
    return next;
  }

  async init(): Promise<void> {
    const loaded = await this.persistence.load();
    if (loaded) {
      this.killSwitches = new Map(Object.entries(loaded.killSwitches));
      this.flags = new Map(Object.entries(loaded.flags));
      this.cohorts = new Map(Object.entries(loaded.cohorts));
      this.invites = new Map(Object.entries(loaded.invites));
      this.audit = loaded.audit ?? [];
    }
  }

  private async persist(): Promise<void> {
    await this.persistence.save({
      killSwitches: Object.fromEntries(this.killSwitches),
      flags: Object.fromEntries(this.flags),
      cohorts: Object.fromEntries(this.cohorts),
      invites: Object.fromEntries(this.invites),
      audit: this.audit,
    });
  }

  private appendAudit(event: Omit<BetaControlAuditEvent, "id" | "at">): void {
    this.audit.push({ id: genId("bca"), at: nowIso(), ...event });
    if (this.audit.length > 1000) this.audit.splice(0, this.audit.length - 1000);
  }

  getAudit(): BetaControlAuditEvent[] {
    return [...this.audit];
  }

  // ---- Kill switches ----

  listKillSwitches(): KillSwitchRecord[] {
    return [...this.killSwitches.values()];
  }

  getKillSwitch(capability: BetaCapability): KillSwitchRecord | undefined {
    return this.killSwitches.get(capability);
  }

  setKillSwitch(
    capability: BetaCapability,
    state: KillSwitchState,
    opts: { actor: string; reason?: string; expectedVersion?: number; requestId?: string },
  ): Promise<KillSwitchRecord> {
    return this.runExclusive(async () => {
      const existing = this.killSwitches.get(capability);
      if (
        opts.expectedVersion !== undefined &&
        existing &&
        existing.version !== opts.expectedVersion
      ) {
        throw new ApiError(
          409,
          "conflict",
          "Kill switch was modified by another operator; reload and retry.",
          {
            capability,
            currentVersion: existing.version,
          },
        );
      }
      const record: KillSwitchRecord = {
        capability,
        state,
        updatedAt: nowIso(),
        updatedBy: opts.actor,
        reason: opts.reason,
        version: (existing?.version ?? 0) + 1,
      };
      this.killSwitches.set(capability, record);
      this.appendAudit({
        actor: opts.actor,
        action: "killswitch.set",
        target: `killswitch:${capability}`,
        reason: opts.reason,
        before: existing ? { state: existing.state, version: existing.version } : null,
        after: { state, version: record.version },
        requestId: opts.requestId,
        result: "success",
      });
      await this.persist();
      return record;
    });
  }

  // ---- Feature flags ----

  listFlags(): FeatureFlag[] {
    return [...this.flags.values()];
  }

  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  upsertFlag(flag: FeatureFlag): Promise<FeatureFlag> {
    return this.runExclusive(async () => {
      const parsed = featureFlagSchema.parse(flag);
      this.flags.set(parsed.key, parsed);
      this.appendAudit({
        actor: parsed.createdBy,
        action: "flag.upsert",
        target: `flag:${parsed.key}`,
        before: flag.version > 1 ? { key: parsed.key } : null,
        after: { key: parsed.key, enabled: parsed.enabled, version: parsed.version },
        result: "success",
      });
      await this.persist();
      return parsed;
    });
  }

  deleteFlag(key: string, actor: string, requestId?: string): Promise<void> {
    return this.runExclusive(async () => {
      if (!this.flags.has(key))
        throw new ApiError(404, "not_found", `Feature flag '${key}' not found`);
      this.flags.delete(key);
      this.appendAudit({
        actor,
        action: "flag.delete",
        target: `flag:${key}`,
        result: "success",
        requestId,
      });
      await this.persist();
    });
  }

  // ---- Cohorts ----

  listCohorts(): Cohort[] {
    return [...this.cohorts.values()];
  }

  getCohort(id: string): Cohort | undefined {
    return this.cohorts.get(id);
  }

  upsertCohort(cohort: Cohort, opts: { expectedVersion?: number } = {}): Promise<Cohort> {
    return this.runExclusive(async () => {
      const parsed = cohortSchema.parse(cohort);
      // Enforce optimistic concurrency *inside* the serialized write so two
      // concurrent PUTs carrying the same expectedVersion cannot both pass a
      // pre-check and then silently overwrite one another.
      if (opts.expectedVersion !== undefined) {
        const current = this.cohorts.get(parsed.id);
        const currentVersion = current ? current.version : 0;
        if (currentVersion !== opts.expectedVersion) {
          throw new ApiError(
            409,
            "conflict",
            "Cohort was modified by another operator; reload and retry.",
            { currentVersion },
          );
        }
      }
      const isNew = !this.cohorts.has(parsed.id);
      this.cohorts.set(parsed.id, parsed);
      this.appendAudit({
        actor: parsed.createdBy,
        action: isNew ? "cohort.create" : "cohort.update",
        target: `cohort:${parsed.id}`,
        after: { id: parsed.id, name: parsed.name, version: parsed.version },
        result: "success",
      });
      await this.persist();
      return parsed;
    });
  }

  deleteCohort(id: string, actor: string, requestId?: string): Promise<void> {
    return this.runExclusive(async () => {
      if (!this.cohorts.has(id)) throw new ApiError(404, "not_found", `Cohort '${id}' not found`);
      this.cohorts.delete(id);
      this.appendAudit({
        actor,
        action: "cohort.delete",
        target: `cohort:${id}`,
        result: "success",
        requestId,
      });
      await this.persist();
    });
  }

  // ---- Invites ----

  listInvites(): BetaInvite[] {
    return [...this.invites.values()];
  }

  getInvite(code: string): BetaInvite | undefined {
    return this.invites.get(code.toUpperCase());
  }

  createInvite(input: {
    code: string;
    cohortId: string | null;
    createdBy: string;
    expiresAt?: string | null;
    reason?: string;
  }): Promise<BetaInvite> {
    return this.runExclusive(async () => {
      const code = input.code.trim().toUpperCase();
      if (this.invites.has(code)) {
        throw new ApiError(409, "conflict", `Invite code '${code}' already exists`);
      }
      if (input.cohortId) {
        const cohort = this.cohorts.get(input.cohortId);
        if (!cohort) throw new ApiError(404, "not_found", `Cohort '${input.cohortId}' not found`);
        if (cohort.inviteLimit > 0) {
          const active = [...this.invites.values()].filter(
            (i) => i.cohortId === input.cohortId && i.status === "active",
          ).length;
          if (active >= cohort.inviteLimit) {
            throw new ApiError(
              409,
              "conflict",
              `Cohort '${input.cohortId}' invite limit (${cohort.inviteLimit}) reached`,
            );
          }
        }
      }
      const invite: BetaInvite = {
        code,
        cohortId: input.cohortId,
        status: "active",
        createdAt: nowIso(),
        createdBy: input.createdBy,
        expiresAt: input.expiresAt ?? null,
        usedBy: null,
        usedAt: null,
        reason: input.reason,
        version: 1,
      };
      const parsed = betaInviteSchema.parse(invite);
      this.invites.set(parsed.code, parsed);
      this.appendAudit({
        actor: input.createdBy,
        action: "invite.create",
        target: `invite:${parsed.code}`,
        after: { code: parsed.code, cohortId: parsed.cohortId },
        result: "success",
      });
      await this.persist();
      return parsed;
    });
  }

  redeemInvite(code: string, account: string): Promise<BetaInvite> {
    return this.runExclusive(async () => {
      const existing = this.invites.get(code.toUpperCase());
      if (!existing) throw new ApiError(404, "not_found", `Invite code '${code}' not found`);
      if (existing.status !== "active") {
        throw new ApiError(409, "conflict", `Invite code '${code}' is ${existing.status}`);
      }
      if (existing.expiresAt && new Date(existing.expiresAt).getTime() < Date.now()) {
        existing.status = "expired";
        await this.persist();
        throw new ApiError(410, "invite_expired", `Invite code '${code}' has expired`);
      }
      const updated: BetaInvite = {
        ...existing,
        status: "redeemed",
        usedBy: account,
        usedAt: nowIso(),
        version: existing.version + 1,
      };
      this.invites.set(updated.code, updated);
      this.appendAudit({
        actor: account,
        action: "invite.redeem",
        target: `invite:${updated.code}`,
        after: { code: updated.code, usedBy: account },
        result: "success",
      });
      await this.persist();
      return updated;
    });
  }

  revokeInvite(
    code: string,
    actor: string,
    reason?: string,
    requestId?: string,
  ): Promise<BetaInvite> {
    return this.runExclusive(async () => {
      const existing = this.invites.get(code.toUpperCase());
      if (!existing) throw new ApiError(404, "not_found", `Invite code '${code}' not found`);
      const updated: BetaInvite = { ...existing, status: "revoked", version: existing.version + 1 };
      this.invites.set(updated.code, updated);
      this.appendAudit({
        actor,
        action: "invite.revoke",
        target: `invite:${updated.code}`,
        reason,
        result: "success",
        requestId,
      });
      await this.persist();
      return updated;
    });
  }

  /**
   * Rolls back a previously redeemed invite back to `active` (e.g. when the
   * account it was bound to could not be created). Only a redeemed invite is
   * affected; other states are returned unchanged. Serialized through the mutex
   * so concurrent operators observe a consistent state.
   */
  releaseInviteRedemption(code: string, actor = "system"): Promise<BetaInvite> {
    return this.runExclusive(async () => {
      const existing = this.invites.get(code.toUpperCase());
      if (!existing) throw new ApiError(404, "not_found", `Invite code '${code}' not found`);
      if (existing.status !== "redeemed") return existing;
      const updated: BetaInvite = {
        ...existing,
        status: "active",
        usedBy: null,
        usedAt: null,
        version: existing.version + 1,
      };
      this.invites.set(updated.code, updated);
      this.appendAudit({
        actor,
        action: "invite.release",
        target: `invite:${updated.code}`,
        after: { code: updated.code, status: updated.status },
        result: "success",
      });
      await this.persist();
      return updated;
    });
  }
}
