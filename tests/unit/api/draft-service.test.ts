import { beforeEach, describe, expect, it } from "vitest";
import {
  createDraft,
  deleteDraft,
  getDraft,
  listDrafts,
  updateDraft,
} from "@/server/api/draft-service";
import { MemoryApiRepository } from "@/server/api/memory-repository";

describe("draft-service (BETA-058 / Issue #1965)", () => {
  let repo: MemoryApiRepository;
  const owner = `G${"A".repeat(55)}`;
  const otherOwner = `G${"B".repeat(55)}`;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  describe("createDraft", () => {
    it("creates a draft with version 1 and encrypted-at-rest payload", async () => {
      const draft = await createDraft(repo, owner, {
        to: ["alice@stealth.xyz"],
        subject: "Meeting Tomorrow",
        body: "Let's review the proposal at 10am.",
        attachments: [
          {
            filename: "proposal.pdf",
            contentType: "application/pdf",
            sizeBytes: 2048,
          },
        ],
      });

      expect(draft.draftId).toBeDefined();
      expect(draft.owner).toBe(owner);
      expect(draft.version).toBe(1);
      expect(draft.subject).toBe("Meeting Tomorrow");
      expect(draft.to).toEqual(["alice@stealth.xyz"]);
      expect(draft.attachments).toHaveLength(1);

      // Verify at repository level that raw record is encrypted at rest
      const rawRecord = await repo.getDraft(owner, draft.draftId);
      expect(rawRecord).not.toBeNull();
      expect(rawRecord?.encryptedPayload).toBeDefined();
      expect(rawRecord?.algorithm).toBe("AES-256-GCM");
    });
  });

  describe("getDraft", () => {
    it("retrieves and decrypts a draft for its owner", async () => {
      const created = await createDraft(repo, owner, {
        to: ["bob@stealth.xyz"],
        subject: "Hello Bob",
        body: "Checking in.",
      });

      const fetched = await getDraft(repo, owner, created.draftId);
      expect(fetched).toEqual(created);
    });

    it("throws 404 for a missing draft", async () => {
      await expect(getDraft(repo, owner, "d_ghost")).rejects.toMatchObject({
        status: 404,
        code: "not_found",
      });
    });

    it("throws 404 when requested by another owner (isolation)", async () => {
      const created = await createDraft(repo, owner, {
        to: ["secret@stealth.xyz"],
        subject: "Top Secret",
        body: "Classified content",
      });

      await expect(getDraft(repo, otherOwner, created.draftId)).rejects.toMatchObject({
        status: 404,
        code: "not_found",
      });
    });
  });

  describe("updateDraft with optimistic concurrency (expectedVersion)", () => {
    it("updates draft and increments version when expectedVersion matches", async () => {
      const created = await createDraft(repo, owner, {
        to: ["alice@stealth.xyz"],
        subject: "Draft V1",
        body: "Initial thoughts",
      });

      const updated = await updateDraft(
        repo,
        owner,
        created.draftId,
        {
          subject: "Draft V2",
          body: "Updated thoughts and details",
          expectedVersion: 1,
        },
        1,
      );

      expect(updated.version).toBe(2);
      expect(updated.subject).toBe("Draft V2");
      expect(updated.body).toBe("Updated thoughts and details");

      const fetched = await getDraft(repo, owner, created.draftId);
      expect(fetched.version).toBe(2);
      expect(fetched.subject).toBe("Draft V2");
    });

    it("rejects with 409 conflict when expectedVersion is stale and returns current server draft", async () => {
      const created = await createDraft(repo, owner, {
        to: ["alice@stealth.xyz"],
        subject: "Initial",
        body: "Initial body",
      });

      // Tab A updates to v2
      await updateDraft(
        repo,
        owner,
        created.draftId,
        {
          body: "Tab A edit",
          expectedVersion: 1,
        },
        1,
      );

      // Tab B tries to update with stale expectedVersion: 1
      try {
        await updateDraft(
          repo,
          owner,
          created.draftId,
          {
            body: "Tab B concurrent edit",
            expectedVersion: 1,
          },
          1,
        );
        expect.unreachable("Should have thrown 409 conflict");
      } catch (err: any) {
        expect(err.status).toBe(409);
        expect(err.code).toBe("conflict");
        expect(err.details?.current).toBeDefined();
        expect(err.details.current.version).toBe(2);
        expect(err.details.current.body).toBe("Tab A edit");
      }
    });
  });

  describe("deleteDraft", () => {
    it("deletes a draft", async () => {
      const created = await createDraft(repo, owner, {
        to: ["alice@stealth.xyz"],
        subject: "To be discarded",
        body: "Discard me",
      });

      await deleteDraft(repo, owner, created.draftId);
      await expect(getDraft(repo, owner, created.draftId)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("listDrafts", () => {
    it("lists and decrypts drafts scoped to the owner", async () => {
      await createDraft(repo, owner, { subject: "Draft 1", body: "Body 1" });
      await createDraft(repo, owner, { subject: "Draft 2", body: "Body 2" });
      await createDraft(repo, otherOwner, { subject: "Other Draft", body: "Other Body" });

      const result = await listDrafts(repo, owner);
      expect(result.items).toHaveLength(2);
      expect(result.items.every((d) => d.owner === owner)).toBe(true);
      expect(result.items.map((d) => d.subject)).toContain("Draft 1");
      expect(result.items.map((d) => d.subject)).toContain("Draft 2");
    });
  });
});
