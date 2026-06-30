import { describe, it, expect, beforeEach } from "vitest";
import { DeterministicAdapter } from "@/services/data/adapters/deterministic";
import type { Message } from "@/services/data/types";

describe("DeterministicAdapter", () => {
  let adapter: DeterministicAdapter;

  beforeEach(() => {
    adapter = new DeterministicAdapter();
  });

  describe("messages repository", () => {
    it("should initialize with mock emails", async () => {
      const messages = await adapter.messages.getAll();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toHaveProperty("id");
      expect(messages[0]).toHaveProperty("from");
      expect(messages[0]).toHaveProperty("subject");
    });

    it("should get message by ID", async () => {
      const all = await adapter.messages.getAll();
      const first = all[0];

      const fetched = await adapter.messages.getById(first.id);
      expect(fetched).toEqual(first);
    });

    it("should return null for non-existent message", async () => {
      const result = await adapter.messages.getById("non-existent");
      expect(result).toBeNull();
    });

    it("should upsert a message", async () => {
      const message: Message = {
        id: "test-1",
        from: "Test",
        email: "test@example.com",
        subject: "Test",
        preview: "Test preview",
        body: "Test body",
        time: "Now",
        unread: true,
        starred: false,
        folder: "inbox",
        avatarColor: "#000",
      };

      const upserted = await adapter.messages.upsert(message);
      expect(upserted.id).toBe("test-1");
      expect(upserted.subject).toBe("Test");

      const fetched = await adapter.messages.getById("test-1");
      expect(fetched).toBeDefined();
      expect(fetched?.subject).toBe("Test");
    });

    it("should delete a message", async () => {
      const message: Message = {
        id: "test-delete",
        from: "Test",
        email: "test@example.com",
        subject: "Test",
        preview: "Test preview",
        body: "Test body",
        time: "Now",
        unread: true,
        starred: false,
        folder: "inbox",
        avatarColor: "#000",
      };

      await adapter.messages.upsert(message);
      expect(await adapter.messages.getById("test-delete")).toBeDefined();

      await adapter.messages.delete("test-delete");
      expect(await adapter.messages.getById("test-delete")).toBeNull();
    });

    it("should bulk update messages", async () => {
      const msg1: Message = {
        id: "bulk-1",
        from: "Test",
        email: "test@example.com",
        subject: "Original 1",
        preview: "Preview",
        body: "Body",
        time: "Now",
        unread: true,
        starred: false,
        folder: "inbox",
        avatarColor: "#000",
      };

      const msg2: Message = {
        id: "bulk-2",
        from: "Test",
        email: "test@example.com",
        subject: "Original 2",
        preview: "Preview",
        body: "Body",
        time: "Now",
        unread: true,
        starred: false,
        folder: "inbox",
        avatarColor: "#000",
      };

      await adapter.messages.upsert(msg1);
      await adapter.messages.upsert(msg2);

      const updates = [
        { id: "bulk-1", changes: { starred: true } },
        { id: "bulk-2", changes: { folder: "archive" as const } },
      ];

      const result = await adapter.messages.bulkUpdate(updates);
      expect(result).toHaveLength(2);
      expect(result[0].starred).toBe(true);
      expect(result[1].folder).toBe("archive");
    });

    it("should get messages by folder", async () => {
      const inboxMessages = await adapter.messages.getByFolder("inbox");
      expect(inboxMessages.length).toBeGreaterThan(0);
      expect(inboxMessages.every((m) => m.folder === "inbox")).toBe(true);
    });

    it("should be idempotent on upsert", async () => {
      const message: Message = {
        id: "idempotent-test",
        from: "Test",
        email: "test@example.com",
        subject: "Test",
        preview: "Test preview",
        body: "Test body",
        time: "Now",
        unread: true,
        starred: false,
        folder: "inbox",
        avatarColor: "#000",
      };

      const result1 = await adapter.messages.upsert(message);
      const result2 = await adapter.messages.upsert(message);

      expect(result1.id).toBe(result2.id);
      expect(result1.subject).toBe(result2.subject);
    });
  });

  describe("contacts repository", () => {
    it("should upsert and retrieve contacts", async () => {
      const contact = {
        id: "contact-1",
        email: "contact@example.com",
        name: "Test Contact",
        firstSeen: new Date().toISOString(),
      };

      const upserted = await adapter.contacts.upsert(contact);
      expect(upserted.id).toBe("contact-1");

      const fetched = await adapter.contacts.getById("contact-1");
      expect(fetched?.email).toBe("contact@example.com");
    });

    it("should get contact by email", async () => {
      const contact = {
        id: "contact-2",
        email: "unique@example.com",
        firstSeen: new Date().toISOString(),
      };

      await adapter.contacts.upsert(contact);
      const fetched = await adapter.contacts.getByEmail("unique@example.com");
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe("contact-2");
    });
  });

  describe("policies repository", () => {
    it("should upsert and retrieve policies", async () => {
      const policy = {
        id: "policy-1",
        contactId: "contact-1",
        email: "sender@example.com",
        policy: "allow" as const,
        appliedAt: new Date().toISOString(),
      };

      const upserted = await adapter.policies.upsert(policy);
      expect(upserted.policy).toBe("allow");

      const fetched = await adapter.policies.getByEmail("sender@example.com");
      expect(fetched?.policy).toBe("allow");
    });

    it("should get policies by type", async () => {
      const policy1 = {
        id: "policy-allow-1",
        contactId: "contact-1",
        email: "allow@example.com",
        policy: "allow" as const,
        appliedAt: new Date().toISOString(),
      };

      const policy2 = {
        id: "policy-block-1",
        contactId: "contact-2",
        email: "block@example.com",
        policy: "block" as const,
        appliedAt: new Date().toISOString(),
      };

      await adapter.policies.upsert(policy1);
      await adapter.policies.upsert(policy2);

      const allowPolicies = await adapter.policies.getByPolicy("allow");
      expect(allowPolicies.some((p) => p.id === "policy-allow-1")).toBe(true);
    });
  });

  describe("proofs repository", () => {
    it("should upsert and retrieve proofs", async () => {
      const proof = {
        id: "proof-1",
        messageId: "msg-1",
        contactId: "contact-1",
        proofHash: "hash123",
        status: "valid" as const,
        verifiedAt: new Date().toISOString(),
      };

      const upserted = await adapter.proofs.upsert(proof);
      expect(upserted.status).toBe("valid");

      const fetched = await adapter.proofs.getByMessageId("msg-1");
      expect(fetched?.proofHash).toBe("hash123");
    });

    it("should get valid proofs", async () => {
      const validProof = {
        id: "proof-valid",
        messageId: "msg-valid",
        contactId: "contact-1",
        proofHash: "hash-valid",
        status: "valid" as const,
        verifiedAt: new Date().toISOString(),
      };

      const pendingProof = {
        id: "proof-pending",
        messageId: "msg-pending",
        contactId: "contact-1",
        proofHash: "hash-pending",
        status: "pending" as const,
      };

      await adapter.proofs.upsert(validProof);
      await adapter.proofs.upsert(pendingProof);

      const valid = await adapter.proofs.getValid();
      expect(valid.some((p) => p.id === "proof-valid")).toBe(true);
      expect(valid.every((p) => p.status === "valid")).toBe(true);
    });
  });

  describe("sync cursors", () => {
    it("should manage sync state", async () => {
      const cursor = {
        id: "cursor-1",
        sourceId: "source-1",
        lastSyncedAt: new Date().toISOString(),
        pendingChanges: 0,
      };

      const upserted = await adapter.syncCursors.upsert(cursor);
      expect(upserted.pendingChanges).toBe(0);

      await adapter.syncCursors.incrementPending("cursor-1", 3);
      const updated = await adapter.syncCursors.getById("cursor-1");
      expect(updated?.pendingChanges).toBe(3);
    });
  });

  describe("reset and snapshot", () => {
    it("should reset messages to initial state", async () => {
      const message: Message = {
        id: "temp-msg",
        from: "Test",
        email: "test@example.com",
        subject: "Temporary",
        preview: "Test preview",
        body: "Test body",
        time: "Now",
        unread: true,
        starred: false,
        folder: "inbox",
        avatarColor: "#000",
      };

      // Create a custom message
      const customAdapter = new DeterministicAdapter();
      await customAdapter.messages.upsert(message);
      const messagesBefore = await customAdapter.messages.getAll();

      // Reset should restore to initial mock data
      customAdapter.reset();
      const messagesAfter = await customAdapter.messages.getAll();

      // Should have initial mock emails, not the custom one
      expect(messagesAfter.length).toBeGreaterThan(0);
      expect(messagesAfter.every((m) => m.id !== "temp-msg")).toBe(true);
    });

    it("should provide snapshot", async () => {
      const snapshot = adapter.snapshot();
      expect(snapshot.messages).toBeDefined();
      expect(Array.isArray(snapshot.messages)).toBe(true);
      expect(snapshot.messages.length).toBeGreaterThan(0);
    });
  });

  describe("adapter initialization", () => {
    it("should initialize without errors", async () => {
      const newAdapter = new DeterministicAdapter();
      await expect(newAdapter.initialize()).resolves.not.toThrow();
    });

    it("should have correct name", () => {
      expect(adapter.getName()).toBe("deterministic");
    });
  });
});
