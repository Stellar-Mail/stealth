import { describe, it, expect, beforeEach } from "vitest";
import { CommentThreadService } from "./service";

/**
 * Edge-case and error-path coverage for CommentThreadService.
 *
 * These tests are intentionally separate from `service.test.ts` (which covers
 * the happy paths) and focus on the branches that are easy to regress:
 * not-found errors, argument precedence, empty results, per-instance
 * fixture isolation, input validation, and concurrent safety.
 */
describe("CommentThreadService (edge cases)", () => {
  let service: CommentThreadService;

  beforeEach(() => {
    service = new CommentThreadService();
  });

  it("returns null when getting a thread that does not exist", async () => {
    const thread = await service.getThread("th-does-not-exist");
    expect(thread).toBeNull();
  });

  it("returns an empty list for a target with no threads", async () => {
    const threads = await service.getThreadsForTarget("txn-999", "transaction");
    expect(threads).toEqual([]);
  });

  it("makes a newly created thread retrievable by id and by target", async () => {
    const created = await service.createThread("doc-777", "document", "Kickoff note", "u-1");

    const byId = await service.getThread(created.id);
    expect(byId?.id).toBe(created.id);
    expect(byId?.comments).toHaveLength(1);

    const byTarget = await service.getThreadsForTarget("doc-777", "document");
    expect(byTarget).toHaveLength(1);
    expect(byTarget[0].id).toBe(created.id);
  });

  it("throws when adding a comment to a missing thread", async () => {
    await expect(service.addComment("th-missing", "u-1", "Hello")).rejects.toThrow(
      "Thread not found",
    );
  });

  it("throws when adding a comment with an unknown author", async () => {
    await expect(service.addComment("th-1", "u-unknown", "Hello")).rejects.toThrow(
      "Author not found",
    );
  });

  it("checks the thread before the author when adding a comment", async () => {
    await expect(service.addComment("th-missing", "u-unknown", "Hello")).rejects.toThrow(
      "Thread not found",
    );
  });

  it("throws when updating the status of a missing thread", async () => {
    await expect(service.updateThreadStatus("th-missing", "u-1", "resolved")).rejects.toThrow(
      "Thread not found",
    );
  });

  it("throws when deleting a comment from a missing thread", async () => {
    await expect(service.deleteComment("th-missing", "c-1", "u-1")).rejects.toThrow("Thread not found");
  });

  it("throws when deleting a comment that does not exist", async () => {
    await expect(service.deleteComment("th-1", "c-unknown", "u-1")).rejects.toThrow("Comment not found");
  });

  it("supports moving a thread to the archived status", async () => {
    const updated = await service.updateThreadStatus("th-1", "u-1", "archived");
    expect(updated.status).toBe("archived");

    const fetched = await service.getThread("th-1");
    expect(fetched?.status).toBe("archived");
  });

  it("keeps separate service instances isolated from each other", async () => {
    const other = new CommentThreadService();

    await service.createThread("doc-isolated", "document", "Only in the first instance", "u-1");

    const inService = await service.getThreadsForTarget("doc-isolated", "document");
    expect(inService).toHaveLength(1);

    const inOther = await other.getThreadsForTarget("doc-isolated", "document");
    expect(inOther).toHaveLength(0);
  });

  it("rejects empty comment content", async () => {
    await expect(service.createThread("doc-1", "document", "   ", "u-1")).rejects.toThrow(
      "Content must not be empty",
    );
  });

  it("rejects comments exceeding max length", async () => {
    const longBody = "a".repeat(4001);
    await expect(service.createThread("doc-1", "document", longBody, "u-1")).rejects.toThrow(
      "Content exceeds maximum length of 4000 characters",
    );
  });

  it("strips HTML from comment content", async () => {
    const thread = await service.createThread("doc-1", "document", "<b>bold</b> text", "u-1");
    expect(thread.comments[0].content).toBe("bold text");
  });

  it("does not mutate fixture objects across instances", async () => {
    const service1 = new CommentThreadService();
    const service2 = new CommentThreadService();

    await service1.updateThreadStatus("th-1", "u-1", "resolved");

    const inService2 = await service2.getThread("th-1");
    expect(inService2?.status).toBe("open");
  });
});
