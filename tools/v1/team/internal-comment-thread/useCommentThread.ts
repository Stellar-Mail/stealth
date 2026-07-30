import { useState, useCallback, useEffect, useMemo } from "react";
import { commentThreadService } from "./service";
import { ThreadWithComments, Thread } from "./types";

const MAX_RENDERED_COMMENTS = 50;

export function useCommentThread(targetId: string, targetType: string, currentUserId?: string) {
  const [threads, setThreads] = useState<ThreadWithComments[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchThreads = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await commentThreadService.getThreadsForTarget(targetId, targetType);
      setThreads(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [targetId, targetType]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const addThread = async (initialComment: string, authorId: string) => {
    try {
      setError(null);
      const newThread = await commentThreadService.createThread(
        targetId,
        targetType,
        initialComment,
        authorId,
      );
      setThreads((prev) => [...prev, newThread]);
      return newThread;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      throw errorObj;
    }
  };

  const addComment = async (threadId: string, authorId: string, content: string) => {
    try {
      setError(null);
      const newComment = await commentThreadService.addComment(threadId, authorId, content);
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === threadId) {
            return {
              ...t,
              comments: [...t.comments, newComment],
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        }),
      );
      return newComment;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      throw errorObj;
    }
  };

  const updateStatus = async (threadId: string, status: Thread["status"]) => {
    try {
      if (!currentUserId) throw new Error("currentUserId is required for status updates");
      await commentThreadService.updateThreadStatus(threadId, currentUserId, status);
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, status, updatedAt: new Date().toISOString() } : t,
        ),
      );
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      throw errorObj;
    }
  };

  const deleteComment = async (threadId: string, commentId: string) => {
    try {
      if (!currentUserId) throw new Error("currentUserId is required for comment deletion");
      await commentThreadService.deleteComment(threadId, commentId, currentUserId);
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === threadId) {
            return {
              ...t,
              comments: t.comments.map((c) =>
                c.id === commentId ? { ...c, isDeleted: true, updatedAt: new Date().toISOString() } : c,
              ),
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        }),
      );
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      throw errorObj;
    }
  };

  const memoizedThreads = useMemo(() => {
    return threads.map((thread) => ({
      ...thread,
      comments: thread.comments.slice(0, MAX_RENDERED_COMMENTS),
    }));
  }, [threads]);

  return {
    threads: memoizedThreads,
    rawThreads: threads,
    isLoading,
    error,
    addThread,
    addComment,
    updateStatus,
    deleteComment,
    refresh: fetchThreads,
  };
}
