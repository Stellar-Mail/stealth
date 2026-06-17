import { useCallback, useEffect, useState } from "react";

export type ActionType = "compose" | "approve" | "save-settings";

export interface QueuedAction {
  id: string;
  type: ActionType;
  payload: any;
  timestamp: number;
}

const STORAGE_KEY = "stealth-action-queue";

/**
 * Hook to manage the queue of actions to be performed offline.
 */
export function useActionQueue() {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setQueue(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse action queue", e);
      }
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
  }, [queue, isHydrated]);

  const enqueue = useCallback((type: ActionType, payload: any) => {
    const action: QueuedAction = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
    };
    setQueue((prev: QueuedAction[]) => [...prev, action]);
    return action;
  }, []);

  const dequeue = useCallback((id: string) => {
    setQueue((prev: QueuedAction[]) => prev.filter((a: QueuedAction) => a.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return { queue, enqueue, dequeue, clearQueue, isHydrated };
}
