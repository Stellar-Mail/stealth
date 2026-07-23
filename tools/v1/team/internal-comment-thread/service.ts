import { Comment, Thread, ThreadWithComments, User } from "./types";
import { mockThreads, mockComments, mockUsers } from "./fixtures";

export class CommentThreadService {
  private threads: Map<string, Thread> = new Map();
  private comments: Map<string, Comment[]> = new Map();
  private users: Map<string, User> = new Map();

  constructor() {
    this.initializeWithFixtures();
  }

  private initializeWithFixtures() {
    mockUsers.forEach((u) => this.users.set(u.id, u));
    mockThreads.forEach((t) => this.threads.set(t.id, t));
    mockComments.forEach((c) => {
      const threadComments = this.comments.get(c.threadId) || [];
      threadComments.push(c);
      this.comments.set(c.threadId, threadComments);
    });
  }

  // --- API Surface ---

  async getThread(threadId: string): Promise<ThreadWithComments | null> {
    await new Promise((r) => setTimeout(r, 50)); // simulate latency
    const thread = this.threads.get(threadId);
    if (!thread) return null;
    const threadComments = this.comments.get(threadId) || [];
    return { ...thread, comments: threadComments.filter((c) => !c.isDeleted) };
  }

  async getThreadsForTarget(targetId: string, targetType: string): Promise<ThreadWithComments[]> {
    await new Promise((r) => setTimeout(r, 50));
    const result: ThreadWithComments[] = [];
    for (const thread of this.threads.values()) {
      if (thread.targetId === targetId && thread.targetType === targetType) {
        const threadComments = this.comments.get(thread.id) || [];
        result.push({ ...thread, comments: threadComments.filter((c) => !c.isDeleted) });
      }
    }
    return result;
  }

  async createThread(
    targetId: string,
    targetType: string,
    initialComment: string,
    authorId: string,
  ): Promise<ThreadWithComments> {
    await new Promise((r) => setTimeout(r, 50));

    if (!this.users.has(authorId)) {
      throw new Error("Author not found");
    }

    const threadId = `th-${Date.now()}`;
    const now = new Date().toISOString();

    const newThread: Thread = {
      id: threadId,
      targetId,
      targetType,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    this.threads.set(threadId, newThread);

    const newComment: Comment = {
      id: `c-${Date.now()}`,
      threadId,
      authorId,
      content: initialComment,
      createdAt: now,
      isDeleted: false,
    };
    this.comments.set(threadId, [newComment]);

    return { ...newThread, comments: [newComment] };
  }

  async addComment(threadId: string, authorId: string, content: string): Promise<Comment> {
    await new Promise((r) => setTimeout(r, 50));

    if (!this.threads.has(threadId)) {
      throw new Error("Thread not found");
    }
    if (!this.users.has(authorId)) {
      throw new Error("Author not found");
    }

    const newComment: Comment = {
      id: `c-${Date.now()}`,
      threadId,
      authorId,
      content,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    const threadComments = this.comments.get(threadId) || [];
    threadComments.push(newComment);
    this.comments.set(threadId, threadComments);

    const thread = this.threads.get(threadId)!;
    thread.updatedAt = new Date().toISOString();

    return newComment;
  }

  async updateThreadStatus(threadId: string, status: Thread["status"]): Promise<Thread> {
    await new Promise((r) => setTimeout(r, 50));
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error("Thread not found");

    thread.status = status;
    thread.updatedAt = new Date().toISOString();
    return { ...thread };
  }

  async deleteComment(threadId: string, commentId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 50));
    const threadComments = this.comments.get(threadId);
    if (!threadComments) throw new Error("Thread not found");

    const comment = threadComments.find((c) => c.id === commentId);
    if (!comment) throw new Error("Comment not found");

    comment.isDeleted = true;
    comment.updatedAt = new Date().toISOString();
  }
}

export const commentThreadService = new CommentThreadService();
