/**
 * Upgrade governance and state migration — reference state machine.
 *
 * Pure, dependency-free model of the governance + idempotent migration logic
 * specified in docs/protocol/upgrade-governance.md. It deliberately avoids the
 * Soroban SDK so it can be unit-tested without the Wasm toolchain; the normative
 * on-chain binding in contracts/soroban/upgrade/ implements the identical
 * semantics.
 *
 * All time/state is injected, so conformance tests are deterministic.
 */

export type Address = string;

export interface PendingUpgrade {
  wasmHash: string;
  newStateVersion: number;
  proposedAt: number;
  proposer: Address;
}

export interface DeploymentRecord {
  version: number;
  wasmHash: string;
  deployedAt: number;
  proposer: Address;
  executor: Address;
}

export class UpgradeGovernanceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "UpgradeGovernanceError";
    this.code = code;
  }
}

export interface UpgradeGovernanceState {
  authority: Address;
  /** Distinct emergency capability holder (defaults to authority). */
  emergency: Address;
  timelockDelaySeconds: number;
  frozen: boolean;
  stateVersion: number;
  pending: PendingUpgrade | null;
  runbook: DeploymentRecord[];
}

export interface UpgradeGovernanceConfig {
  authority: Address;
  emergency?: Address;
  timelockDelaySeconds: number;
  initialStateVersion?: number;
  /** Injected clock (epoch seconds) for deterministic tests. */
  nowSeconds: () => number;
  /**
   * Applies a single forward migration step to opaque storage. Each step must
   * be re-entrant-safe; the harness guarantees it runs exactly once per version
   * transition. Provided by the contract; defaults to a no-op for the model.
   */
  applyStep?: (fromVersion: number, toVersion: number) => void;
}

export class UpgradeGovernance {
  private state: UpgradeGovernanceState;
  private readonly cfg: UpgradeGovernanceConfig;

  constructor(cfg: UpgradeGovernanceConfig) {
    this.cfg = cfg;
    this.state = {
      authority: cfg.authority,
      emergency: cfg.emergency ?? cfg.authority,
      timelockDelaySeconds: cfg.timelockDelaySeconds,
      frozen: false,
      stateVersion: cfg.initialStateVersion ?? 1,
      pending: null,
      runbook: [],
    };
  }

  // --- Queries (acceptance: authority and delay are queryable) ---
  upgradeAuthority(): Address {
    return this.state.authority;
  }
  timelockDelaySeconds(): number {
    return this.state.timelockDelaySeconds;
  }
  stateVersion(): number {
    return this.state.stateVersion;
  }
  isFrozen(): boolean {
    return this.state.frozen;
  }
  pendingUpgrade(): PendingUpgrade | null {
    return this.state.pending;
  }
  deploymentRunbook(): DeploymentRecord[] {
    return [...this.state.runbook];
  }

  // --- Governance mutations ---
  setUpgradeAuthority(caller: Address, next: Address): void {
    this.requireAuthority(caller);
    this.state.authority = next;
  }

  setTimelockDelay(caller: Address, seconds: number): void {
    this.requireAuthority(caller);
    if (seconds < 0) {
      throw new UpgradeGovernanceError("INVALID_DELAY", "timelock delay must be >= 0");
    }
    this.state.timelockDelaySeconds = seconds;
  }

  setEmergency(caller: Address, next: Address): void {
    this.requireAuthority(caller);
    this.state.emergency = next;
  }

  // --- Upgrade flow ---
  proposeUpgrade(caller: Address, wasmHash: string, newStateVersion: number): void {
    this.requireAuthority(caller);
    if (this.state.frozen) {
      throw new UpgradeGovernanceError("FROZEN", "contract is frozen");
    }
    if (this.state.pending) {
      throw new UpgradeGovernanceError("PENDING_EXISTS", "an upgrade is already pending");
    }
    if (newStateVersion <= this.state.stateVersion) {
      throw new UpgradeGovernanceError("INVALID_VERSION", "new state version must exceed current");
    }
    this.state.pending = {
      wasmHash,
      newStateVersion,
      proposedAt: this.cfg.nowSeconds(),
      proposer: caller,
    };
  }

  executeUpgrade(caller: Address): void {
    this.requireAuthority(caller);
    if (this.state.frozen) {
      throw new UpgradeGovernanceError("FROZEN", "contract is frozen");
    }
    const pending = this.state.pending;
    if (!pending) {
      throw new UpgradeGovernanceError("NO_PENDING", "no upgrade pending");
    }
    const elapsed = this.cfg.nowSeconds() - pending.proposedAt;
    if (elapsed < this.state.timelockDelaySeconds) {
      throw new UpgradeGovernanceError(
        "TIMELOCK_ACTIVE",
        `timelock not elapsed (${elapsed}s < ${this.state.timelockDelaySeconds}s)`,
      );
    }
    // Idempotent migration (§4): advances state version without loss.
    this.migrateState(pending.newStateVersion);
    // Record artifact hash in the runbook (§6).
    this.state.runbook.push({
      version: pending.newStateVersion,
      wasmHash: pending.wasmHash,
      deployedAt: this.cfg.nowSeconds(),
      proposer: pending.proposer,
      executor: caller,
    });
    this.state.pending = null;
  }

  // --- Idempotent migration (§4) ---
  migrateState(target: number): void {
    if (target < this.state.stateVersion) {
      throw new UpgradeGovernanceError("VERSION_REGRESS", "target version is below current");
    }
    if (this.state.stateVersion >= target) {
      return; // idempotent no-op
    }
    for (let v = this.state.stateVersion + 1; v <= target; v++) {
      this.cfg.applyStep?.(v - 1, v);
    }
    this.state.stateVersion = target;
  }

  // --- Emergency powers (§5, explicit + audit-logged) ---
  freeze(caller: Address): void {
    this.requireEmergency(caller);
    this.state.frozen = true;
    this.state.runbook.push({
      version: this.state.stateVersion,
      wasmHash: "freeze",
      deployedAt: this.cfg.nowSeconds(),
      proposer: caller,
      executor: caller,
    });
  }

  unfreeze(caller: Address): void {
    this.requireEmergency(caller);
    this.state.frozen = false;
  }

  rollback(caller: Address, targetVersion: number): void {
    this.requireEmergency(caller);
    if (targetVersion >= this.state.stateVersion) {
      return; // idempotent no-op
    }
    this.state.stateVersion = targetVersion;
    this.state.runbook.push({
      version: targetVersion,
      wasmHash: "rollback",
      deployedAt: this.cfg.nowSeconds(),
      proposer: caller,
      executor: caller,
    });
  }

  // --- Guards ---
  private requireAuthority(caller: Address): void {
    if (caller !== this.state.authority) {
      throw new UpgradeGovernanceError("UNAUTHORIZED", "caller is not the authority");
    }
  }
  private requireEmergency(caller: Address): void {
    if (caller !== this.state.emergency && caller !== this.state.authority) {
      throw new UpgradeGovernanceError("UNAUTHORIZED", "caller lacks emergency power");
    }
  }
}
