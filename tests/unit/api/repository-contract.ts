import { beforeEach, describe, expect, it } from "vitest";

import type { StoredEnvelope } from "../../../src/server/api/domain";
import type { ApiRepository } from "../../../src/server/api/repository";

// Issue #1494: one reusable repository conformance suite that every adapter must
// satisfy, so memory and future production adapters cannot diverge on CRUD,
// ordering, conflict, and not-found semantics.
//
// `makeRepository` is an async factory so adapter-specific setup (connections,
// migrations, fixtures) is injected without changing the expected behavior.
export function runRepositoryContractTests(
  adapterName: string,
  makeRepository: () => Promise<ApiRepository> | ApiRepository,
) {
  const owner = `G${"A".repeat(55)}`;
  const sender = `G${"B".repeat(55)}`;
  const messageId = "a".repeat(64);
  const paymentHash = "b".repeat(64);

  describe(`ApiRepository contract: ${adapterName}`, () => {
    let repo: ApiRepository;

    beforeEach(async () => {
      repo = await makeRepository();
    });

    describe("policy CRUD", () => {
      it("returns null for a missing policy", async () => {
        await expect(repo.getPolicy(owner)).resolves.toBeNull();
      });

      it("round-trips a stored policy", async () => {
        await repo.setPolicy(owner, {
          allowUnknown: true,
          minimumPostage: "100",
          requireVerified: false,
        });
        await expect(repo.getPolicy(owner)).resolves.toMatchObject({
          allowUnknown: true,
          minimumPostage: "100",
          requireVerified: false,
        });
      });

      it("overwrites an existing policy on repeated set", async () => {
        await repo.setPolicy(owner, {
          allowUnknown: true,
          minimumPostage: "100",
          requireVerified: false,
        });
        await repo.setPolicy(owner, {
          allowUnknown: false,
          minimumPostage: "200",
          requireVerified: true,
        });
        await expect(repo.getPolicy(owner)).resolves.toMatchObject({
          minimumPostage: "200",
          requireVerified: true,
        });
      });
    });

    describe("sender rules", () => {
      it("defaults to 'default' when no rule exists", async () => {
        await expect(repo.getSenderRule(owner, sender)).resolves.toBe("default");
      });

      it("stores and clears explicit rules", async () => {
        await repo.setSenderRule(owner, sender, "allow");
        await expect(repo.getSenderRule(owner, sender)).resolves.toBe("allow");

        await repo.setSenderRule(owner, sender, "default");
        await expect(repo.getSenderRule(owner, sender)).resolves.toBe("default");
      });

      it("isolates rules per (owner, sender) pair", async () => {
        const otherSender = `G${"C".repeat(55)}`;
        await repo.setSenderRule(owner, sender, "block");
        await expect(repo.getSenderRule(owner, otherSender)).resolves.toBe("default");
      });
    });

    describe("postage and receipt records", () => {
      it("returns null for missing postage and receipts", async () => {
        await expect(repo.getPostage(messageId)).resolves.toBeNull();
        await expect(repo.getReceipt(messageId)).resolves.toBeNull();
      });

      it("round-trips postage keyed by messageId", async () => {
        await repo.setPostage({
          amount: "100",
          createdAt: "2026-01-01T00:00:00.000Z",
          messageId,
          paymentHash,
          recipient: owner,
          sender,
          status: "pending",
        });
        await expect(repo.getPostage(messageId)).resolves.toMatchObject({
          messageId,
          status: "pending",
        });
      });

      it("round-trips receipts keyed by messageId", async () => {
        await repo.setReceipt({
          deliveredAt: "2026-01-01T00:00:00.000Z",
          messageId,
          readAt: null,
          recipient: owner,
          sender,
        });
        await expect(repo.getReceipt(messageId)).resolves.toMatchObject({
          messageId,
          readAt: null,
        });
      });
    });

    describe("atomic postage transitions", () => {
      it("reports not-found for a message with no postage", async () => {
        await expect(repo.transitionPostage(messageId, "pending", "settled")).resolves.toEqual({
          outcome: "not-found",
        });
      });

      it("applies a pending -> settled transition and reflects it in getPostage", async () => {
        await repo.setPostage({
          amount: "100",
          createdAt: "2026-01-01T00:00:00.000Z",
          messageId,
          paymentHash,
          recipient: owner,
          sender,
          status: "pending",
        });

        const result = await repo.transitionPostage(messageId, "pending", "settled");
        expect(result).toMatchObject({ outcome: "applied", postage: { status: "settled" } });
        await expect(repo.getPostage(messageId)).resolves.toMatchObject({ status: "settled" });
      });

      it("reports a conflict with the current status when already terminal", async () => {
        await repo.setPostage({
          amount: "100",
          createdAt: "2026-01-01T00:00:00.000Z",
          messageId,
          paymentHash,
          recipient: owner,
          sender,
          status: "settled",
        });

        await expect(
          repo.transitionPostage(messageId, "pending", "settled"),
        ).resolves.toMatchObject({ outcome: "conflict", postage: { status: "settled" } });
      });

      it("allows exactly one winner out of concurrent settlement attempts", async () => {
        await repo.setPostage({
          amount: "100",
          createdAt: "2026-01-01T00:00:00.000Z",
          messageId,
          paymentHash,
          recipient: owner,
          sender,
          status: "pending",
        });

        const results = await Promise.all(
          Array.from({ length: 5 }, () => repo.transitionPostage(messageId, "pending", "settled")),
        );

        const applied = results.filter((result) => result.outcome === "applied");
        const conflicts = results.filter((result) => result.outcome === "conflict");
        expect(applied).toHaveLength(1);
        expect(conflicts).toHaveLength(4);
        await expect(repo.getPostage(messageId)).resolves.toMatchObject({ status: "settled" });
      });
    });

    describe("idempotency records", () => {
      it("returns null for a missing idempotency key", async () => {
        await expect(repo.getIdempotencyRecord("missing")).resolves.toBeNull();
      });

      it("round-trips an idempotency record", async () => {
        await repo.setIdempotencyRecord("key-1", {
          state: "completed",
          status: 200,
          body: { ok: true },
          requestDigest: "digest-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:01.000Z",
        });
        await expect(repo.getIdempotencyRecord("key-1")).resolves.toMatchObject({
          status: 200,
        });
      });

      // Issue #1498: acquiring a lease binds it to a canonical request digest,
      // so a same-key-different-payload retry never blocks behind or replays
      // an unrelated request's response.
      it("acquires, blocks concurrent followers, and replays the completed response", async () => {
        const acquired = await repo.acquireIdempotencyRecord("key-2", "digest-a", 30_000);
        expect(acquired).toEqual({ status: "acquired" });

        const inProgress = await repo.acquireIdempotencyRecord("key-2", "digest-a", 30_000);
        expect(inProgress).toEqual({ status: "in_progress" });

        await repo.setIdempotencyRecord("key-2", {
          state: "completed",
          status: 200,
          body: { ok: true },
          requestDigest: "digest-a",
          createdAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:01.000Z",
        });

        const completed = await repo.acquireIdempotencyRecord("key-2", "digest-a", 30_000);
        expect(completed).toMatchObject({ status: "completed", record: { body: { ok: true } } });
      });

      it("returns conflict when the same key is reused with a different payload digest", async () => {
        await repo.acquireIdempotencyRecord("key-3", "digest-a", 30_000);

        const conflict = await repo.acquireIdempotencyRecord("key-3", "digest-b", 30_000);
        expect(conflict).toEqual({ status: "conflict" });
      });

      it("only lets one of many concurrent duplicate acquires win", async () => {
        const results = await Promise.all(
          Array.from({ length: 5 }, () =>
            repo.acquireIdempotencyRecord("key-4", "digest-a", 30_000),
          ),
        );

        const acquired = results.filter((result) => result.status === "acquired");
        const inProgress = results.filter((result) => result.status === "in_progress");
        expect(acquired).toHaveLength(1);
        expect(inProgress).toHaveLength(4);
      });
    });

    describe("username reservation", () => {
      const record = {
        username: "alice",
        ownerAddress: owner,
        stealthAddress: "alice@stealth.me",
        federationAddress: "alice*stealth.me",
        createdAt: "2026-01-01T00:00:00.000Z",
      };

      it("returns null for an unreserved username", async () => {
        await expect(repo.getUsernameRecord("alice")).resolves.toBeNull();
      });

      it("reserves an absent username and round-trips it via getUsernameRecord", async () => {
        await expect(repo.reserveUsernameIfAbsent(record)).resolves.toEqual({
          outcome: "reserved",
          record,
        });
        await expect(repo.getUsernameRecord("alice")).resolves.toEqual(record);
      });

      it("reports the existing owner as 'taken' on a second reservation attempt", async () => {
        await repo.reserveUsernameIfAbsent(record);

        const otherOwner = `G${"C".repeat(55)}`;
        await expect(
          repo.reserveUsernameIfAbsent({
            ...record,
            ownerAddress: otherOwner,
            createdAt: "2026-01-02T00:00:00.000Z",
          }),
        ).resolves.toEqual({ outcome: "taken", record });

        // The original reservation is never overwritten by a losing attempt.
        await expect(repo.getUsernameRecord("alice")).resolves.toEqual(record);
      });

      it("isolates reservations across distinct usernames", async () => {
        await repo.reserveUsernameIfAbsent(record);
        await expect(repo.getUsernameRecord("bob")).resolves.toBeNull();
      });

      it("allows exactly one winner out of concurrent reservation attempts", async () => {
        const results = await Promise.all(
          Array.from({ length: 5 }, (_, index) =>
            repo.reserveUsernameIfAbsent({
              ...record,
              ownerAddress: `G${String(index).repeat(55)}`.slice(0, 56),
            }),
          ),
        );

        const reserved = results.filter((result) => result.outcome === "reserved");
        const taken = results.filter((result) => result.outcome === "taken");
        expect(reserved).toHaveLength(1);
        expect(taken).toHaveLength(4);

        // Every loser observed the single winner's record, not its own payload.
        const winner = reserved[0]!.record;
        for (const result of taken) {
          expect(result.record).toEqual(winner);
        }
      });
    });

    describe("counters", () => {
      it("starts at zero and increments within a window", async () => {
        await expect(repo.getCounter("rl:test")).resolves.toBe(0);
        const first = await repo.incrementCounter("rl:test", 60);
        const second = await repo.incrementCounter("rl:test", 60);
        expect(first).toBe(1);
        expect(second).toBe(2);
      });
    });

    describe("stored values are isolated from caller mutation", () => {
      it("does not reflect post-write mutation of the input object", async () => {
        const policy = {
          allowUnknown: true,
          minimumPostage: "100",
          requireVerified: false,
        };
        await repo.setPolicy(owner, policy);
        policy.minimumPostage = "999";
        await expect(repo.getPolicy(owner)).resolves.toMatchObject({
          minimumPostage: "100",
        });
      });
    });

    describe("BETA-002: user account, profile, and credential management", () => {
      const sampleUser = {
        userId: "usr_test_1",
        address: `G${"D".repeat(55)}`,
        email: "alice@stealth.mail",
        username: "alice_stealth",
        status: "active" as const,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
      };

      const sampleProfile = {
        userId: "usr_test_1",
        username: "alice_stealth",
        displayName: "Alice Stealth",
        avatarUrl: "https://stealth.mail/avatars/alice.png",
        bio: "Crypto privacy enthusiast",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const sampleCredential = {
        credentialId: "cred_test_1",
        userId: "usr_test_1",
        authMethod: "stellar_header" as const,
        secretHash: "hash_super_secret_123",
        walletKeyRef: "vault_ref_abc_456",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      it("returns null for non-existent user, profile, or credential", async () => {
        await expect(repo.getUserById("missing")).resolves.toBeNull();
        await expect(repo.getUserByEmail("missing@stealth.mail")).resolves.toBeNull();
        await expect(repo.getUserByUsername("missing_user")).resolves.toBeNull();
        await expect(repo.getUserByAddress(`G${"E".repeat(55)}`)).resolves.toBeNull();
        await expect(repo.getProfile("missing")).resolves.toBeNull();
        await expect(repo.getCredential("missing")).resolves.toBeNull();
      });

      it("creates a user and satisfies email, username, address lookups", async () => {
        const created = await repo.createUser(sampleUser, sampleCredential, sampleProfile);
        expect(created).toMatchObject({ userId: "usr_test_1", email: "alice@stealth.mail" });

        await expect(repo.getUserById("usr_test_1")).resolves.toMatchObject({
          username: "alice_stealth",
        });
        await expect(repo.getUserByEmail("ALICE@STEALTH.MAIL")).resolves.toMatchObject({
          userId: "usr_test_1",
        });
        await expect(repo.getUserByUsername("ALICE_STEALTH")).resolves.toMatchObject({
          userId: "usr_test_1",
        });
        await expect(repo.getUserByAddress(sampleUser.address)).resolves.toMatchObject({
          userId: "usr_test_1",
        });
        await expect(repo.getProfile("usr_test_1")).resolves.toMatchObject({
          displayName: "Alice Stealth",
        });
        await expect(repo.getCredential("usr_test_1")).resolves.toMatchObject({
          secretHash: "hash_super_secret_123",
        });
      });

      it("rejects duplicate email, username, or address creation with 409 conflict", async () => {
        await repo.createUser(sampleUser);

        // Duplicate email
        await expect(
          repo.createUser({
            ...sampleUser,
            userId: "usr_test_2",
            username: "bob_stealth",
            address: `G${"E".repeat(55)}`,
          }),
        ).rejects.toMatchObject({ status: 409 });

        // Duplicate username
        await expect(
          repo.createUser({
            ...sampleUser,
            userId: "usr_test_3",
            email: "bob@stealth.mail",
            address: `G${"F".repeat(55)}`,
          }),
        ).rejects.toMatchObject({ status: 409 });

        // Duplicate address
        await expect(
          repo.createUser({
            ...sampleUser,
            userId: "usr_test_4",
            email: "carol@stealth.mail",
            username: "carol_stealth",
          }),
        ).rejects.toMatchObject({ status: 409 });
      });

      it("updates a user with optimistic concurrency version check", async () => {
        await repo.createUser(sampleUser);

        // Stale update (expectedVersion = 999 instead of 1)
        const staleRes = await repo.updateUser(
          { ...sampleUser, email: "alice2@stealth.mail" },
          999,
        );
        expect(staleRes.updated).toBe(false);
        if (!staleRes.updated) {
          expect(staleRes.current).toMatchObject({ version: 1 });
        }

        // Valid update (expectedVersion = 1)
        const validRes = await repo.updateUser(
          { ...sampleUser, email: "alice_new@stealth.mail" },
          1,
        );
        expect(validRes.updated).toBe(true);
        if (validRes.updated) {
          expect(validRes.user.version).toBe(2);
          expect(validRes.user.email).toBe("alice_new@stealth.mail");
        }

        await expect(repo.getUserByEmail("alice_new@stealth.mail")).resolves.toMatchObject({
          userId: "usr_test_1",
        });
      });
    });

    // -------------------------------------------------------------------------
    // Issue #1936 (BETA-029) — Envelope persistence contract
    // Every ApiRepository adapter must satisfy these invariants.
    // -------------------------------------------------------------------------

    describe("encrypted envelope persistence (BETA-029 / Issue #1936)", () => {
      const ephemeralKey = `G${"C".repeat(55)}`;
      const envMessageId = "e".repeat(64);
      const envMessageId2 = "f".repeat(64);
      const commitment = "c".repeat(64);
      const mac = "d".repeat(64);
      const nonce = "ab12cd34ef56";

      function makeEnvelope(overrides: Partial<StoredEnvelope> = {}): StoredEnvelope {
        return {
          messageId: envMessageId,
          senderId: sender,
          recipientId: owner,
          ciphertext: "dGVzdC1jaXBoZXJ0ZXh0",
          protectedHeaders: {
            algorithm: "AES-256-GCM",
            ephemeral_public_key: ephemeralKey,
            nonce,
            mac,
            version: "v1",
          },
          contentCommitment: commitment,
          createdAt: "2026-01-01T00:00:00.000Z",
          ...overrides,
        };
      }

      it("returns null for a missing envelope", async () => {
        await expect(repo.getEnvelope(envMessageId)).resolves.toBeNull();
      });

      it("returns 'inserted' on the first insert and retrieves the record", async () => {
        const envelope = makeEnvelope();
        const result = await repo.insertEnvelope(envelope);
        expect(result.outcome).toBe("inserted");

        const retrieved = await repo.getEnvelope(envMessageId);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.messageId).toBe(envMessageId);
        expect(retrieved?.senderId).toBe(sender);
        expect(retrieved?.recipientId).toBe(owner);
        // Plaintext must never appear in the retrieved record.
        expect((retrieved as any)?.subject).toBeUndefined();
        expect((retrieved as any)?.body).toBeUndefined();
      });

      it("returns 'duplicate' for a byte-identical resubmission (idempotent)", async () => {
        const envelope = makeEnvelope();
        await repo.insertEnvelope(envelope);

        const retry = await repo.insertEnvelope({ ...envelope });
        expect(retry.outcome).toBe("duplicate");
        if (retry.outcome === "duplicate") {
          expect(retry.envelope.messageId).toBe(envMessageId);
        }
      });

      it("returns 'conflict' when a different payload uses the same messageId", async () => {
        await repo.insertEnvelope(makeEnvelope());
        const different = makeEnvelope({ ciphertext: "ZGlmZmVyZW50AA==" });
        const result = await repo.insertEnvelope(different);
        expect(result.outcome).toBe("conflict");
      });

      it("allows exactly one winner out of 5 concurrent inserts", async () => {
        const envelope = makeEnvelope();
        const results = await Promise.all(
          Array.from({ length: 5 }, () => repo.insertEnvelope({ ...envelope })),
        );

        const inserted = results.filter((r) => r.outcome === "inserted");
        const duplicates = results.filter((r) => r.outcome === "duplicate");
        const conflicts = results.filter((r) => r.outcome === "conflict");

        expect(inserted).toHaveLength(1);
        expect(duplicates).toHaveLength(4);
        expect(conflicts).toHaveLength(0);
      });

      it("isolates envelopes by messageId", async () => {
        await repo.insertEnvelope(makeEnvelope({ messageId: envMessageId }));
        await repo.insertEnvelope(makeEnvelope({ messageId: envMessageId2 }));

        await expect(repo.getEnvelope(envMessageId)).resolves.toMatchObject({
          messageId: envMessageId,
        });
        await expect(repo.getEnvelope(envMessageId2)).resolves.toMatchObject({
          messageId: envMessageId2,
        });
      });

      it("is insert-only: a different ciphertext cannot overwrite the stored record", async () => {
        const original = makeEnvelope();
        await repo.insertEnvelope(original);

        await repo.insertEnvelope(makeEnvelope({ ciphertext: "bmV3Y2lwaGVydGV4dA==" }));

        const stored = await repo.getEnvelope(envMessageId);
        expect(stored?.ciphertext).toBe(original.ciphertext);
      });
    });
  });
}
