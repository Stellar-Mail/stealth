import { describe, it, expect, beforeEach } from "vitest";
import { CommentThreadService } from "./service";

describe("CommentThreadService", () => {
  let service: CommentThreadService;

  beforeEach(() => {
    service = new CommentThreadService();
  });

  it("should get threads for a specific target", async () => {
    const threads = await service.getThreadsForTarget("txn-123", "transaction");
    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe("th-1");
    expect(threads[0].comments).toHaveLength(2);
  });

  it("should create a new thread and add the initial comment", async () => {
    const thread = await service.createThread("doc-456", "document", "First comment", "u-1");
    expect(thread.targetId).toBe("doc-456");
    expect(thread.status).toBe("open");
    expect(thread.comments).toHaveLength(1);
    expect(thread.comments[0].content).toBe("First comment");
    expect(thread.comments[0].authorId).toBe("u-1");
  });

  it("should throw error when creating a thread with unknown author", async () => {
    await expect(service.createThread("doc-456", "document", "Test", "u-unknown")).rejects.toThrow(
      "Author not found",
    );
  });

  it("should add a comment to an existing thread", async () => {
    const newComment = await service.addComment("th-1", "u-2", "New reply");
    expect(newComment.content).toBe("New reply");

    const thread = await service.getThread("th-1");
    expect(thread?.comments).toHaveLength(3);
    expect(thread?.comments.some((c) => c.id === newComment.id)).toBe(true);
  });

  it("should update thread status", async () => {
    const thread = await service.updateThreadStatus("th-1", "resolved");
    expect(thread.status).toBe("resolved");

    const fetched = await service.getThread("th-1");
    expect(fetched?.status).toBe("resolved");
  });

  it("should delete a comment", async () => {
    const threads = await service.getThreadsForTarget("txn-123", "transaction");
    const commentId = threads[0].comments[0].id;

    await service.deleteComment("th-1", commentId);

    const threadAfter = await service.getThread("th-1");
    expect(threadAfter?.comments).toHaveLength(1); // One should be filtered out because it's deleted
  });
});
