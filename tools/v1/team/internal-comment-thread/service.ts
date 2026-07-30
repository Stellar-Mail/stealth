import { Comment, Thread, ThreadWithComments, User } from "./types";
import { mockThreads, mockComments, mockUsers } from "./fixtures";

const MAX_COMMENTS_PER_THREAD = 500;
const MAX_THREADS_PER_TARGET = 100;
const MAX_CONTENT_LENGTH = 4000;

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function truncateCommentBody(body: string, maxLength = 200): string {
  if (body.length <= maxLength) return body;
  return `${body.slice(0, maxLength - 3)}...`;
}

export class CommentThreadService {
  private threads: Map<string, Thread> = new Map();
  private comments: Map<string, Comment[]> = new Map();
  private users: Map<string, User> = new Map();
  private threadTargetIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeWithFixtures();
  }

  private initializeWithFixtures() {
    mockUsers.forEach((u) => this.users.set(u.id, deepClone(u)));
    mockThreads.forEach((t) => {
      const cloned = deepClone(t);
      this.threads.set(cloned.id, cloned);
      this.indexThreadForTarget(cloned);
    });
    mockComments.forEach((c) => {
      const cloned = deepClone(c);
      const threadComments = this.comments.get(cloned.threadId) || [];
      threadComments.push(cloned);
      this.comments.set(cloned.threadId, threadComments);
    });
  }

  private indexThreadForTarget(thread: Thread) {
    const key = `${thread.targetType}:${thread.targetId}`;
    const set = this.threadTargetIndex.get(key) || new Set();
    set.add(thread.id);
    this.threadTargetIndex.set(key, set);
  }

  private removeThreadFromTargetIndex(thread: Thread) {
    const key = `${thread.targetType}:${thread.targetId}`;
    const set = this.threadTargetIndex.get(key);
    if (set) {
      set.delete(thread.id);
      if (set.size === 0) this.threadTargetIndex.delete(key);
    }
  }

  private sanitizeContent(content: string): string {
    return content.replace(/<[^>]*>/g, "").trim();
  }

  private assertValidContent(content: string): void {
    if (!content) {
      throw new Error("Content must not be empty");
    }
    const sanitized = this.sanitizeContent(content);
    if (sanitized.length > MAX_CONTENT_LENGTH) {
      throw new Error(`Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
    }
  }

  // --- API Surface ---

  async getThread(threadId: string): Promise<ThreadWithComments | null> {
    const thread = this.threads.get(threadId);
    if (!thread) return null;
    const threadComments = this.comments.get(threadId) || [];
    return {
      ...thread,
      comments: threadComments.filter((c) => !c.isDeleted).slice(0, MAX_COMMENTS_PER_THREAD),
    };
  }

  async getThreadsForTarget(targetId: string, targetType: string): Promise<ThreadWithComments[]> {
    const key = `${targetType}:${targetId}`;
    const threadIds = this.threadTargetIndex.get(key);
    if (!threadIds || threadIds.size === 0) return [];

    const result: ThreadWithComments[] = [];
    for (const threadId of threadIds) {
      const thread = this.threads.get(threadId);
      if (!thread) continue;
      const threadComments = this.comments.get(threadId) || [];
      result.push({
        ...thread,
        comments: threadComments.filter((c) => !c.isDeleted).slice(0, MAX_COMMENTS_PER_THREAD),
      });
      if (result.length >= MAX_THREADS_PER_TARGET) break;
    }
    return result;
  }

  async createThread(
    targetId: string,
    targetType: string,
    initialComment: string,
    authorId: string,
  ): Promise<ThreadWithComments> {
    if (!this.users.has(authorId)) {
      throw new Error("Author not found");
    }
    this.assertValidContent(initialComment);

    const threadId = generateId("th");
    const now = new Date().toISOString();

    const newThread: Thread = {
      id: threadId,
      targetId,
      targetType,
      status: "open",
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    this.threads.set(threadId, newThread);
    this.indexThreadForTarget(newThread);

    const sanitized = this.sanitizeContent(initialComment);
    const newComment: Comment = {
      id: generateId("c"),
      threadId,
      authorId,
      content: sanitized,
      createdAt: now,
      isDeleted: false,
    };
    this.comments.set(threadId, [newComment]);

    return { ...newThread, comments: [newComment] };
  }

  async addComment(threadId: string, authorId: string, content: string): Promise<Comment> {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error("Thread not found");
    if (!this.users.has(authorId)) {
      throw new Error("Author not found");
    }
    this.assertValidContent(content);

    const sanitized = this.sanitizeContent(content);
    const newComment: Comment = {
      id: generateId("c"),
      threadId,
      authorId,
      content: sanitized,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    const threadComments = this.comments.get(threadId) || [];
    if (threadComments.length >= MAX_COMMENTS_PER_THREAD) {
      throw new Error(`Thread has reached maximum of ${MAX_COMMENTS_PER_THREAD} comments`);
    }
    threadComments.push(newComment);
    this.comments.set(threadId, threadComments);

    const updatedThread = { ...thread, updatedAt: new Date().toISOString(), version: (thread.version || 1) + 1 };
    this.threads.set(threadId, updatedThread);

    return newComment;
  }

  async updateThreadStatus(threadId: string, authorId: string, status: Thread["status"]): Promise<Thread> {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error("Thread not found");

    const user = this.users.get(authorId);
    if (!user) throw new Error("Author not found");
    if (user.role !== "admin") {
      throw new Error("Only admins can update thread status");
    }

    const updatedThread = { ...thread, status, updatedAt: new Date().toISOString(), version: (thread.version || 1) + 1 };
    this.threads.set(threadId, updatedThread);
    return updatedThread;
  }

  async deleteComment(threadId: string, commentId: string, authorId: string): Promise<void> {
    const threadComments = this.comments.get(threadId);
    if (!threadComments) throw new Error("Thread not found");

    const comment = threadComments.find((c) => c.id === commentId);
    if (!comment) throw new Error("Comment not found");

    const user = this.users.get(authorId);
    if (!user) throw new Error("Author not found");
    if (comment.authorId !== authorId && user.role !== "admin") {
      throw new Error("Only the comment author or an admin can delete this comment");
    }

    const updatedComment = { ...comment, isDeleted: true, updatedAt: new Date().toISOString() };
    const index = threadComments.findIndex((c) => c.id === commentId);
    if (index >= 0) {
      threadComments[index] = updatedComment;
      this.comments.set(threadId, threadComments);
    }

    const thread = this.threads.get(threadId);
    if (thread) {
      const updatedThread = { ...thread, updatedAt: new Date().toISOString(), version: (thread.version || 1) + 1 };
      this.threads.set(threadId, updatedThread);
    }
  }
}

export const commentThreadService = new CommentThreadService();
