import { describe, expect, it, beforeEach } from "vitest";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  createOrUpdateSenderRule,
  deleteSenderRule,
  listSenderRules,
  getSenderRuleRecord,
  transitionSenderRuleChainStatus,
  retrySenderRuleWrite,
  reconcileSenderRule,
  evaluateSenderRuleForAdmission,
} from "../../../src/server/api/sender-rule-service";
import { ApiError } from "../../../src/server/api/errors";

const OWNER = `G${"A".repeat(55)}`;
const SENDER = `G${"B".repeat(55)}`;
const OTHER_OWNER = `G${"C".repeat(55)}`;

describe("BETA-037: Sender Rule Service", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    repository = new MemoryApiRepository();
  });

  // ---------------------------------------------------------------------------
  // Domain rules, malformed input, and boundary cases
  // ---------------------------------------------------------------------------

  describe("Domain Rules & Validation", () => {
    it("creates an allow rule", async () => {
      const result = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
      });
      expect(result.created).toBe(true);
      expect(result.rule.rule).toBe("allow");
      expect(result.rule.version).toBe(1);
      expect(result.rule.chainStatus).toBe("pending");
    });

    it("creates a block rule", async () => {
      const result = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "block",
      });
      expect(result.created).toBe(true);
      expect(result.rule.rule).toBe("block");
    });

    it("creates a verify rule", async () => {
      const result = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "verify",
      });
      expect(result.created).toBe(true);
      expect(result.rule.rule).toBe("verify");
    });

    it("creates a price rule with minimumPostage", async () => {
      const result = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "price",
        pricePayload: { minimumPostage: "100" },
      });
      expect(result.created).toBe(true);
      expect(result.rule.rule).toBe("price");
      expect(result.rule.pricePayload?.minimumPostage).toBe("100");
    });

    it("rejects price rule without pricePayload", async () => {
      await expect(
        createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "price" }),
      ).rejects.toThrow();
    });

    it("does not store pricePayload for non-price rules", async () => {
      const result = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
        pricePayload: { minimumPostage: "50" },
      });
      expect(result.rule.pricePayload).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // CRUD operations
  // ---------------------------------------------------------------------------

  describe("CRUD Operations", () => {
    it("updates an existing rule with version check", async () => {
      const created = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
      });
      expect(created.rule.version).toBe(1);

      const updated = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "block",
        version: 1,
      });
      expect(updated.created).toBe(false);
      expect(updated.rule.rule).toBe("block");
      expect(updated.rule.version).toBe(2);
    });

    it("lists all rules for an owner", async () => {
      const sender2 = `G${"D".repeat(55)}`;
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await createOrUpdateSenderRule(repository, OWNER, sender2, { rule: "block" });

      const result = await listSenderRules(repository, OWNER);
      expect(result.records.length).toBe(2);
    });

    it("gets a single rule record", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      const record = await getSenderRuleRecord(repository, OWNER, SENDER);
      expect(record).not.toBeNull();
      expect(record!.rule).toBe("allow");
    });

    it("deletes a rule", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      const deleted = await deleteSenderRule(repository, OWNER, SENDER);
      expect(deleted.deleted).toBe(true);

      const record = await getSenderRuleRecord(repository, OWNER, SENDER);
      expect(record).toBeNull();
    });

    it("deleting a non-existent rule is a no-op", async () => {
      const deleted = await deleteSenderRule(repository, OWNER, SENDER);
      expect(deleted.deleted).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Version conflict handling (two concurrent edits)
  // ---------------------------------------------------------------------------

  describe("Version Conflict Handling", () => {
    it("rejects stale update with conflict", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });

      // Simulate concurrent edit
      await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "block",
        version: 1,
      });

      // Stale edit with version 1 should be rejected
      await expect(
        createOrUpdateSenderRule(repository, OWNER, SENDER, {
          rule: "verify",
          version: 1,
        }),
      ).rejects.toThrow(ApiError);

      try {
        await createOrUpdateSenderRule(repository, OWNER, SENDER, {
          rule: "verify",
          version: 1,
        });
      } catch (e) {
        expect((e as ApiError).code).toBe("conflict");
        expect((e as ApiError).status).toBe(409);
      }
    });

    it("allows update with correct version", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      const updated = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "block",
        version: 1,
      });
      expect(updated.rule.version).toBe(2);
      expect(updated.rule.rule).toBe("block");
    });

    it("rejects update without version on existing rule", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await expect(
        createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "block" }),
      ).rejects.toThrow(ApiError);
    });

    it("rejects versioned update on non-existent rule", async () => {
      await expect(
        createOrUpdateSenderRule(repository, OWNER, SENDER, {
          rule: "allow",
          version: 5,
        }),
      ).rejects.toThrow(ApiError);
    });
  });

  // ---------------------------------------------------------------------------
  // Idempotency
  // ---------------------------------------------------------------------------

  describe("Retry & Idempotency", () => {
    it("idempotent create with same idempotencyKey", async () => {
      const first = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
        idempotencyKey: "key-1",
      });
      const second = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
        idempotencyKey: "key-1",
      });
      expect(second.rule.version).toBe(1);
      expect(second.created).toBe(false);
    });

    it("idempotent create with same rule and no version", async () => {
      const first = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
      });
      const second = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
      });
      expect(second.rule.version).toBe(1);
      expect(second.created).toBe(false);
    });

    it("different idempotency key bumps version", async () => {
      const first = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
        idempotencyKey: "key-1",
      });
      expect(first.rule.version).toBe(1);
      // Different idempotency key with version supplied → bumps
      const second = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
        idempotencyKey: "key-2",
        version: 1,
      });
      expect(second.rule.version).toBe(2);
      expect(second.rule.idempotencyKey).toBe("key-2");
    });
  });

  // ---------------------------------------------------------------------------
  // Owner authorization
  // ---------------------------------------------------------------------------

  describe("Owner Authorization", () => {
    it("owner can create rule for their own sender", async () => {
      const result = await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
      });
      expect(result.rule.owner).toBe(OWNER);
    });

    it("rules are scoped per owner", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await createOrUpdateSenderRule(repository, OTHER_OWNER, SENDER, { rule: "block" });

      const ownerRule = await getSenderRuleRecord(repository, OWNER, SENDER);
      const otherRule = await getSenderRuleRecord(repository, OTHER_OWNER, SENDER);

      expect(ownerRule!.rule).toBe("allow");
      expect(otherRule!.rule).toBe("block");
    });

    it("listing is scoped per owner", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await createOrUpdateSenderRule(repository, OTHER_OWNER, SENDER, { rule: "block" });

      const ownerList = await listSenderRules(repository, OWNER);
      const otherList = await listSenderRules(repository, OTHER_OWNER);

      expect(ownerList.records.length).toBe(1);
      expect(otherList.records.length).toBe(1);
    });

    it("deleting is scoped per owner", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await createOrUpdateSenderRule(repository, OTHER_OWNER, SENDER, { rule: "block" });

      await deleteSenderRule(repository, OWNER, SENDER);

      const ownerRule = await getSenderRuleRecord(repository, OWNER, SENDER);
      const otherRule = await getSenderRuleRecord(repository, OTHER_OWNER, SENDER);

      expect(ownerRule).toBeNull();
      expect(otherRule!.rule).toBe("block");
    });
  });

  // ---------------------------------------------------------------------------
  // Chain state transitions
  // ---------------------------------------------------------------------------

  describe("Chain State Transitions", () => {
    it("pending → submitted → confirmed happy path", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });

      const submitted = await transitionSenderRuleChainStatus(
        repository,
        OWNER,
        SENDER,
        "submitted",
      );
      expect(submitted.chainStatus).toBe("submitted");

      const confirmed = await transitionSenderRuleChainStatus(
        repository,
        OWNER,
        SENDER,
        "confirmed",
        { txHash: "abc123" },
      );
      expect(confirmed.chainStatus).toBe("confirmed");
      expect(confirmed.txHash).toBe("abc123");
      expect(confirmed.confirmedAt).not.toBeNull();
    });

    it("pending → failed on error", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });

      const failed = await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "failed", {
        lastError: "network timeout",
      });
      expect(failed.chainStatus).toBe("failed");
      expect(failed.failureCount).toBe(1);
    });

    it("failed → pending on retry", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "failed");

      const retried = await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "pending");
      expect(retried.chainStatus).toBe("pending");
    });

    it("rejects invalid transition (confirmed → submitted)", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "submitted");
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "confirmed", {
        txHash: "abc",
      });

      await expect(
        transitionSenderRuleChainStatus(repository, OWNER, SENDER, "submitted"),
      ).rejects.toThrow(ApiError);
    });

    it("retrySenderRuleWrite is idempotent on confirmed", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "submitted");
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "confirmed", {
        txHash: "abc",
      });

      const result = await retrySenderRuleWrite(repository, OWNER, SENDER);
      expect(result.chainStatus).toBe("confirmed");
    });

    it("retrySenderRuleWrite resets failed to pending", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "failed");

      const result = await retrySenderRuleWrite(repository, OWNER, SENDER);
      expect(result.chainStatus).toBe("pending");
    });
  });

  // ---------------------------------------------------------------------------
  // Chain retry: failed write is retryable and reconciles
  // ---------------------------------------------------------------------------

  describe("Chain Retry & Reconciliation", () => {
    it("failed write can be retried and eventually confirmed", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "block" });
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "failed");

      // Retry
      await retrySenderRuleWrite(repository, OWNER, SENDER);
      const afterRetry = await getSenderRuleRecord(repository, OWNER, SENDER);
      expect(afterRetry!.chainStatus).toBe("pending");

      // Submit and confirm
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "submitted");
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "confirmed", {
        txHash: "retry-hash",
      });

      const final = await getSenderRuleRecord(repository, OWNER, SENDER);
      expect(final!.chainStatus).toBe("confirmed");
      expect(final!.txHash).toBe("retry-hash");
    });

    it("reconcile detects synced state", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "submitted");
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "confirmed", {
        txHash: "abc",
      });

      const result = await reconcileSenderRule(repository, OWNER, SENDER, {
        rule: "allow",
        version: 1,
      });
      expect(result.state).toBe("synced");
    });

    it("reconcile detects drift when chain diverges", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "submitted");
      await transitionSenderRuleChainStatus(repository, OWNER, SENDER, "confirmed", {
        txHash: "abc",
      });

      const result = await reconcileSenderRule(repository, OWNER, SENDER, {
        rule: "block",
        version: 2,
      });
      expect(result.state).toBe("drift");
    });

    it("reconcile returns pending for unconfirmed local rule", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });

      const result = await reconcileSenderRule(repository, OWNER, SENDER, null);
      expect(result.state).toBe("pending");
    });
  });

  // ---------------------------------------------------------------------------
  // Relay admission integration (rules affect relay admission)
  // ---------------------------------------------------------------------------

  describe("Relay Admission Integration", () => {
    it("allow rule admits sender", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "allow" });
      const result = await evaluateSenderRuleForAdmission(repository, {
        owner: OWNER,
        sender: SENDER,
        postage: "0",
        verified: false,
      });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("sender_allowed");
    });

    it("block rule rejects sender", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "block" });
      const result = await evaluateSenderRuleForAdmission(repository, {
        owner: OWNER,
        sender: SENDER,
        postage: "0",
        verified: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("sender_blocked");
    });

    it("verify rule rejects unverified sender", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "verify" });
      const result = await evaluateSenderRuleForAdmission(repository, {
        owner: OWNER,
        sender: SENDER,
        postage: "0",
        verified: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("verification_required");
    });

    it("verify rule admits verified sender", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "verify" });
      const result = await evaluateSenderRuleForAdmission(repository, {
        owner: OWNER,
        sender: SENDER,
        postage: "0",
        verified: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("sender_verified");
    });

    it("price rule rejects insufficient postage", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "price",
        pricePayload: { minimumPostage: "100" },
      });
      const result = await evaluateSenderRuleForAdmission(repository, {
        owner: OWNER,
        sender: SENDER,
        postage: "50",
        verified: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("insufficient_postage");
    });

    it("price rule admits sufficient postage", async () => {
      await createOrUpdateSenderRule(repository, OWNER, SENDER, {
        rule: "price",
        pricePayload: { minimumPostage: "100" },
      });
      const result = await evaluateSenderRuleForAdmission(repository, {
        owner: OWNER,
        sender: SENDER,
        postage: "200",
        verified: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("postage_sufficient");
    });

    it("no rule returns allowed (falls through to global policy)", async () => {
      const result = await evaluateSenderRuleForAdmission(repository, {
        owner: OWNER,
        sender: SENDER,
        postage: "0",
        verified: false,
      });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("no_rule");
    });

    it("rules persist and affect subsequent relay decisions", async () => {
      // Initially no rule → allowed
      const before = await evaluateSenderRuleForAdmission(repository, {
        owner: OWNER,
        sender: SENDER,
        postage: "0",
        verified: false,
      });
      expect(before.allowed).toBe(true);

      // Set block rule
      await createOrUpdateSenderRule(repository, OWNER, SENDER, { rule: "block" });

      // Now rejected
      const after = await evaluateSenderRuleForAdmission(repository, {
        owner: OWNER,
        sender: SENDER,
        postage: "0",
        verified: false,
      });
      expect(after.allowed).toBe(false);
      expect(after.reason).toBe("sender_blocked");
    });
  });
});
