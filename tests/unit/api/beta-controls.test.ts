import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BetaControlService } from "@/server/api/beta-controls/service";
import { setBetaControlServiceForTests } from "@/server/api/beta-controls";
import { enforceCapability } from "@/server/api/beta-controls/guard";
import { BETA_CAPABILITIES, type BetaCapability } from "@/server/api/beta-controls/types";
import type { BetaControlConfig } from "@/config/schema";

function defaultConfig(overrides: Partial<BetaControlConfig> = {}): BetaControlConfig {
  const killSwitchDefaults = Object.fromEntries(
    BETA_CAPABILITIES.map((c) => [c, "open"]),
  ) as Record<BetaCapability, "open" | "closed">;
  return {
    controlTtlSeconds: 5,
    killSwitchDefaults,
    featureFlagDefaults: {},
    ...overrides,
  };
}

function makeService(
  overrides: Partial<BetaControlConfig> = {},
  now: () => number = () => Date.now(),
) {
  return new BetaControlService({ config: defaultConfig(overrides), now });
}

const ADMIN = "GADMIN77777777777777777777777777777777777777777777777777";
const ACC1 = "GUSER111111111111111111111111111111111111111111111111111";
const ACC2 = "GUSER222222222222222222222222222222222222222222222222222";
const ACC3 = "GUSER333333333333333333333333333333333333333333333333333";

describe("BETA-095 beta control service", () => {
  beforeEach(() => {
    setBetaControlServiceForTests(makeService());
  });
  afterEach(() => {
    setBetaControlServiceForTests(undefined);
  });

  describe("kill switches fail closed", () => {
    it("treats an unreachable control store as disabled (fail-closed)", async () => {
      const svc = makeService();
      // Force the backing store read to throw, simulating an unavailable store.
      (svc as any).store.listKillSwitches = () => {
        throw new Error("store unavailable");
      };
      const result = await svc.evaluateKillSwitch("signup");
      expect(result.enabled).toBe(false);
      expect(result.source).toBe("fail_closed");
    });

    it("uses the config baseline (open) when no operator override exists", async () => {
      const svc = makeService();
      const result = await svc.evaluateKillSwitch("signup");
      expect(result.enabled).toBe(true);
      expect(result.source).toBe("config");
    });

    it("disables the capability once an operator closes the switch", async () => {
      const svc = makeService();
      await svc.setKillSwitch("signup", "closed", { actor: ADMIN, reason: "incident" });
      const result = await svc.evaluateKillSwitch("signup");
      expect(result.enabled).toBe(false);
      expect(result.source).toBe("store");
    });

    it("enforceCapability throws 503 when closed", async () => {
      const svc = makeService();
      setBetaControlServiceForTests(svc);
      await svc.setKillSwitch("attachments", "closed", { actor: ADMIN, reason: "incident" });
      await expect(enforceCapability("attachments")).rejects.toMatchObject({
        status: 503,
        code: "beta_capability_disabled",
      });
    });
  });

  describe("stale cache and bounded propagation", () => {
    it("serves stale state within the TTL then propagates the update after TTL", async () => {
      let clock = 1_000_000;
      const svc = makeService({}, () => clock);
      await svc.setKillSwitch("funding", "closed", { actor: ADMIN, reason: "r" });
      expect((await svc.evaluateKillSwitch("funding")).enabled).toBe(false);

      // Simulate a concurrent operator on another node writing directly to the
      // store without invalidating this node's cache.
      await (svc as any).store.setKillSwitch("funding", "open", { actor: "GOTHER" });
      // Within the TTL the local cache is still stale (closed).
      expect((await svc.evaluateKillSwitch("funding")).enabled).toBe(false);

      // After the TTL elapses the updated (open) state is propagated.
      clock += (defaultConfig().controlTtlSeconds + 1) * 1000;
      expect((await svc.evaluateKillSwitch("funding")).enabled).toBe(true);
    });

    it("a local mutation is reflected immediately (no stale read for the writer)", async () => {
      const svc = makeService();
      await svc.setKillSwitch("sending", "closed", { actor: ADMIN, reason: "r" });
      expect((await svc.evaluateKillSwitch("sending")).enabled).toBe(false);
      await svc.setKillSwitch("sending", "open", { actor: ADMIN, reason: "r" });
      expect((await svc.evaluateKillSwitch("sending")).enabled).toBe(true);
    });
  });

  describe("rollback", () => {
    it("reopens a capability after it was closed (rollback path)", async () => {
      const svc = makeService();
      await svc.setKillSwitch("receipts", "closed", { actor: ADMIN, reason: "incident" });
      expect((await svc.evaluateKillSwitch("receipts")).enabled).toBe(false);
      await svc.setKillSwitch("receipts", "open", { actor: ADMIN, reason: "resolved" });
      expect((await svc.evaluateKillSwitch("receipts")).enabled).toBe(true);
    });
  });

  describe("concurrent operator changes", () => {
    it("rejects a stale write with a 409 conflict", async () => {
      const svc = makeService();
      const first = await svc.setKillSwitch("walletLinking", "closed", {
        actor: ADMIN,
        reason: "r",
      });
      expect(first.version).toBe(1);
      // Two operators both read version 1 and try to change it.
      const second = await svc.setKillSwitch("walletLinking", "open", {
        actor: ADMIN,
        reason: "r2",
        expectedVersion: 1,
      });
      expect(second.version).toBe(2);
      // The losing operator's retry with the stale version is rejected.
      await expect(
        svc.setKillSwitch("walletLinking", "closed", {
          actor: ADMIN,
          reason: "stale",
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ status: 409, code: "conflict" });
    });

    it("allows the stale operator to succeed after reloading current version", async () => {
      const svc = makeService();
      const first = await svc.setKillSwitch("walletLinking", "closed", {
        actor: ADMIN,
        reason: "r",
      });
      // Reload latest, then write without optimistic guard (retry path).
      const latest = (await svc.listKillSwitches()).find((k) => k.capability === "walletLinking")!;
      expect(latest.version).toBe(first.version);
      const updated = await svc.setKillSwitch("walletLinking", "open", {
        actor: ADMIN,
        reason: "retry",
        expectedVersion: latest.version,
      });
      expect(updated.version).toBe(first.version + 1);
    });
  });

  describe("feature flag precedence", () => {
    const flag = {
      key: "newComposer",
      enabled: true,
      accountAllow: [ACC1],
      accountDeny: [ACC2],
      percentage: 100,
      description: "",
      expiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: ADMIN,
      version: 1,
    };

    it("accountDeny beats accountAllow beats percentage beats default", async () => {
      const svc = makeService();
      await svc.upsertFlag(flag);
      expect((await svc.isFeatureEnabled("newComposer", { account: ACC2 })).enabled).toBe(false);
      expect((await svc.isFeatureEnabled("newComposer", { account: ACC1 })).enabled).toBe(true);
      // ACC3 is not in any list; percentage=100 rolls out to everyone.
      expect((await svc.isFeatureEnabled("newComposer", { account: ACC3 })).enabled).toBe(true);
    });

    it("percentage gates accounts when not explicitly listed", async () => {
      const svc = makeService();
      await svc.upsertFlag({ ...flag, accountAllow: [], accountDeny: [], percentage: 0 });
      expect((await svc.isFeatureEnabled("newComposer", { account: ACC3 })).enabled).toBe(false);
    });

    it("falls back to config default when flag unknown", async () => {
      const svc = makeService({ featureFlagDefaults: { ghost: true } });
      expect((await svc.isFeatureEnabled("ghost")).enabled).toBe(true);
      expect((await svc.isFeatureEnabled("neverDefined")).enabled).toBe(false);
    });

    it("expired flags fall back to the config default", async () => {
      const svc = makeService();
      await svc.upsertFlag({
        ...flag,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      const evalResult = await svc.isFeatureEnabled("newComposer", { account: ACC1 });
      expect(evalResult.enabled).toBe(false);
      expect(evalResult.source).toBe("expired");
    });

    it("never returns data, only a boolean (no data-access bypass)", async () => {
      const svc = makeService();
      await svc.upsertFlag({ ...flag, key: "exportAllUserData" });
      const result = await svc.isFeatureEnabled("exportAllUserData", { account: ACC1 });
      expect(typeof result.enabled).toBe("boolean");
      expect((result as any).data).toBeUndefined();
    });
  });

  describe("cohorts and invites", () => {
    it("enforces the cohort invite limit", async () => {
      const svc = makeService();
      const cohort = await svc.upsertCohort({
        id: "early",
        name: "Early Access",
        description: "",
        inviteLimit: 1,
        memberAccounts: [],
        featureFlags: [],
        expiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: ADMIN,
        version: 1,
      });
      await svc.createInvite({ code: "CODE1", cohortId: cohort.id, createdBy: ADMIN });
      await expect(
        svc.createInvite({ code: "CODE2", cohortId: cohort.id, createdBy: ADMIN }),
      ).rejects.toMatchObject({ status: 409, code: "conflict" });
    });

    it("rejects creating an invite for an unknown cohort", async () => {
      const svc = makeService();
      await expect(
        svc.createInvite({ code: "X", cohortId: "nope", createdBy: ADMIN }),
      ).rejects.toMatchObject({ status: 404, code: "not_found" });
    });

    it("redeems an active invite and records the account", async () => {
      const svc = makeService();
      await svc.createInvite({ code: "VALID", cohortId: null, createdBy: ADMIN });
      const redeemed = await svc.redeemInvite("VALID", ACC1);
      expect(redeemed.status).toBe("redeemed");
      expect(redeemed.usedBy).toBe(ACC1);
    });

    it("rejects an expired invite with 410", async () => {
      const svc = makeService();
      await svc.createInvite({
        code: "EXPIRED",
        cohortId: null,
        createdBy: ADMIN,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      await expect(svc.redeemInvite("EXPIRED", ACC1)).rejects.toMatchObject({
        status: 410,
        code: "invite_expired",
      });
    });

    it("rejects a duplicate invite code with 409", async () => {
      const svc = makeService();
      await svc.createInvite({ code: "DUP", cohortId: null, createdBy: ADMIN });
      await expect(
        svc.createInvite({ code: "DUP", cohortId: null, createdBy: ADMIN }),
      ).rejects.toMatchObject({ status: 409, code: "conflict" });
    });

    it("revokes an invite", async () => {
      const svc = makeService();
      await svc.createInvite({ code: "REV", cohortId: null, createdBy: ADMIN });
      const revoked = await svc.revokeInvite("REV", ADMIN, "abuse");
      expect(revoked.status).toBe("revoked");
    });
  });
});
