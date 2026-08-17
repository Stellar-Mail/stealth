/**
 * Conformance tests for upgrade governance and state migration (issue #60).
 * Drives the reference state machine in src/services/contracts/upgradeGovernance.ts
 * and proves the acceptance criteria: authority/delay queryable, migration
 * idempotent, emergency powers explicit, runbook records artifact hashes.
 */
import { describe, expect, it } from "vitest";

import {
  UpgradeGovernance,
  UpgradeGovernanceError,
} from "../../../src/services/contracts/upgradeGovernance";

const AUTHORITY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const EMERGENCY = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function makeGov(opts: { now?: number; delay?: number; emergency?: string } = {}) {
  let now = opts.now ?? 1_000_000;
  const steps: Array<[number, number]> = [];
  const gov = new UpgradeGovernance({
    authority: AUTHORITY,
    emergency: opts.emergency ?? EMERGENCY,
    timelockDelaySeconds: opts.delay ?? 300,
    initialStateVersion: 1,
    nowSeconds: () => now,
    applyStep: (from, to) => steps.push([from, to]),
  });
  return { gov, tick: (by: number) => (now += by), steps };
}

describe("upgrade governance + state migration (#60)", () => {
  it("exposes authority and timelock delay (queryable)", () => {
    const { gov } = makeGov({ delay: 600 });
    expect(gov.upgradeAuthority()).toBe(AUTHORITY);
    expect(gov.timelockDelaySeconds()).toBe(600);
    expect(gov.stateVersion()).toBe(1);
    expect(gov.isFrozen()).toBe(false);
  });

  it("rejects upgrades proposed by a non-authority", () => {
    const { gov } = makeGov();
    expect(() => gov.proposeUpgrade("NOT_AUTHORITY", "deadbeef", 2)).toThrowError(
      UpgradeGovernanceError,
    );
  });

  it("enforces the timelock before execution", () => {
    const { gov, tick } = makeGov({ delay: 300 });
    gov.proposeUpgrade(AUTHORITY, "wasmhash-v2", 2);
    // Before timelock elapses.
    expect(() => gov.executeUpgrade(AUTHORITY)).toThrow(/timelock not elapsed/);
    // After timelock.
    tick(300);
    expect(() => gov.executeUpgrade(AUTHORITY)).not.toThrow();
    expect(gov.stateVersion()).toBe(2);
  });

  it("migration is idempotent (no-op when already at target)", () => {
    const { gov, steps, tick } = makeGov({ delay: 0 });
    gov.proposeUpgrade(AUTHORITY, "wasmhash-v3", 3);
    tick(1);
    gov.executeUpgrade(AUTHORITY);
    expect(gov.stateVersion()).toBe(3);
    const stepsAfterFirst = steps.length;

    // Re-run migration to the same target — must be a no-op.
    gov.migrateState(3);
    expect(gov.stateVersion()).toBe(3);
    expect(steps.length).toBe(stepsAfterFirst);

    // Re-run to a lower target is rejected, not silently applied.
    expect(() => gov.migrateState(2)).toThrow(/below current/);
  });

  it("applies each migration step exactly once across a multi-version jump", () => {
    const { gov, steps, tick } = makeGov({ delay: 0 });
    gov.proposeUpgrade(AUTHORITY, "wasmhash-v4", 4);
    tick(1);
    gov.executeUpgrade(AUTHORITY);
    expect(gov.stateVersion()).toBe(4);
    // Steps 1->2, 2->3, 3->4 applied exactly once.
    expect(steps).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
  });

  it("blocks propose/execute while frozen (explicit emergency power)", () => {
    const { gov, tick } = makeGov({ delay: 0 });
    gov.freeze(EMERGENCY);
    expect(gov.isFrozen()).toBe(true);
    expect(() => gov.proposeUpgrade(AUTHORITY, "h", 2)).toThrow(/frozen/i);
    tick(1);
    expect(() => gov.executeUpgrade(AUTHORITY)).toThrow(/frozen/i);
    gov.unfreeze(EMERGENCY);
    expect(gov.isFrozen()).toBe(false);
  });

  it("rollback is an explicit, idempotent emergency power", () => {
    const { gov, tick } = makeGov({ delay: 0 });
    gov.proposeUpgrade(AUTHORITY, "wasmhash-v5", 5);
    tick(1);
    gov.executeUpgrade(AUTHORITY);
    expect(gov.stateVersion()).toBe(5);

    // Rollback to 3 (explicit, requires emergency).
    gov.rollback(EMERGENCY, 3);
    expect(gov.stateVersion()).toBe(3);
    // Idempotent: rollback to same/current version is a no-op.
    gov.rollback(EMERGENCY, 3);
    expect(gov.stateVersion()).toBe(3);
    // Authority also holds emergency by default, so it can freeze/rollback too.
    gov.freeze(AUTHORITY);
    expect(gov.isFrozen()).toBe(true);
  });

  it("records artifact hashes in the deployment runbook for audit", () => {
    const { gov, tick } = makeGov({ delay: 0 });
    gov.proposeUpgrade(AUTHORITY, "wasmhash-audit", 2);
    tick(1);
    gov.executeUpgrade(AUTHORITY);
    const runbook = gov.deploymentRunbook();
    expect(runbook).toHaveLength(1);
    expect(runbook[0]).toMatchObject({
      version: 2,
      wasmHash: "wasmhash-audit",
      proposer: AUTHORITY,
      executor: AUTHORITY,
    });
    expect(typeof runbook[0].deployedAt).toBe("number");
  });

  it("rejects overwriting a pending upgrade", () => {
    const { gov } = makeGov({ delay: 300 });
    gov.proposeUpgrade(AUTHORITY, "h1", 2);
    expect(() => gov.proposeUpgrade(AUTHORITY, "h2", 3)).toThrow(/already pending/);
  });
});
