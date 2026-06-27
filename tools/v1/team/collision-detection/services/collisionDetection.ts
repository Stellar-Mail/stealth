export interface ThreadTarget {
  threadId: string;
  subject: string;
  lastMessageAt: string;
}

export interface ActiveReply {
  userId: string;
  userName: string;
  threadId: string;
  startedAt: string;
  preview?: string;
}

export interface CollisionEvent {
  id: string;
  threadId: string;
  threadSubject: string;
  replies: ActiveReply[];
  detectedAt: string;
  severity: "warning" | "critical";
}

export interface ScanResult {
  events: CollisionEvent[];
  monitoredThreads: number;
  scannedAt: string;
}

export type CollisionErrorCode = "scan-failed" | "unreachable";

export type CollisionDetectionResult =
  | { status: "ok"; data: ScanResult }
  | { status: "error"; code: CollisionErrorCode; message: string };

export type CollisionDetectionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; events: CollisionEvent[]; monitoredThreads: number }
  | { status: "error"; code: CollisionErrorCode; message: string };

export function detectCollisions(replies: ActiveReply[]): CollisionEvent[] {
  const grouped = new Map<string, ActiveReply[]>();

  for (const reply of replies) {
    const existing = grouped.get(reply.threadId);
    if (existing) {
      existing.push(reply);
    } else {
      grouped.set(reply.threadId, [reply]);
    }
  }

  const events: CollisionEvent[] = [];
  let index = 0;

  for (const [threadId, threadReplies] of grouped) {
    if (threadReplies.length < 2) continue;

    const severity = threadReplies.length > 2 ? "critical" : "warning";

    events.push({
      id: `collision-${index++}`,
      threadId,
      threadSubject: threadReplies[0].preview ?? `Thread ${threadId}`,
      replies: [...threadReplies],
      detectedAt: new Date().toISOString(),
      severity,
    });
  }

  return events;
}

export function scanActiveReplies(
  replies: ActiveReply[],
  monitoredThreads: number,
): CollisionDetectionResult {
  if (!Array.isArray(replies)) {
    return {
      status: "error",
      code: "scan-failed",
      message: "Invalid reply data: expected an array of active replies.",
    };
  }

  if (monitoredThreads < 0) {
    return {
      status: "error",
      code: "scan-failed",
      message: "Monitored thread count cannot be negative.",
    };
  }

  const events = detectCollisions(replies);

  return {
    status: "ok",
    data: {
      events,
      monitoredThreads,
      scannedAt: new Date().toISOString(),
    },
  };
}

export function toReadyState(result: CollisionDetectionResult): CollisionDetectionState {
  if (result.status === "error") {
    return { status: "error", code: result.code, message: result.message };
  }
  return {
    status: "ready",
    events: result.data.events,
    monitoredThreads: result.data.monitoredThreads,
  };
}
