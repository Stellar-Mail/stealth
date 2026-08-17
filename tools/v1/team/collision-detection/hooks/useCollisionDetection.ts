import { useState, useCallback } from "react";
import type { ActiveReply, CollisionDetectionState } from "../services/collisionDetection";
import { scanActiveReplies, toReadyState } from "../services/collisionDetection";

export interface UseCollisionDetectionReturn {
  state: CollisionDetectionState;
  scan: (replies: ActiveReply[], monitoredThreads: number) => void;
  reset: () => void;
}

export function useCollisionDetection(): UseCollisionDetectionReturn {
  const [state, setState] = useState<CollisionDetectionState>({ status: "idle" });

  const scan = useCallback((replies: ActiveReply[], monitoredThreads: number) => {
    setState({ status: "loading" });
    const result = scanActiveReplies(replies, monitoredThreads);
    setState(toReadyState(result));
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return { state, scan, reset };
}
