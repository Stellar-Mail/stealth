import type {
  ActorId,
  OwnershipAnomaly,
  OwnershipEvent,
  OwnershipHistoryEntry,
  OwnershipRecord,
  OwnershipReport,
  OwnershipState,
} from "../types";

interface ThreadAccumulator {
  threadId: string;
  currentOwner: ActorId | null;
  handoffCount: number;
  firstEventAt: string;
  lastEventAt: string;
  previousTimestamp: string;
  history: OwnershipHistoryEntry[];
}

function compareByTimestamp(a: OwnershipEvent, b: OwnershipEvent): number {
  return a.timestamp.localeCompare(b.timestamp);
}

/** Return a timestamp-sorted copy of the events without mutating the input. */
export function sortOwnershipEvents(events: OwnershipEvent[]): OwnershipEvent[] {
  return [...events].sort(compareByTimestamp);
}

function toHistoryEntry(
  event: OwnershipEvent,
  previousOwner: ActorId | null,
): OwnershipHistoryEntry {
  return {
    eventId: event.id,
    action: event.action,
    actor: event.actor,
    owner: event.owner,
    previousOwner,
    timestamp: event.timestamp,
    note: event.note ?? null,
  };
}

/**
 * Reconstruct per-thread ownership history from a flat list of ownership
 * events. Events are processed in the order received so that malformed or
 * out-of-order input is reported as an anomaly rather than silently reordered.
 */
export function trackOwnership(events: OwnershipEvent[]): OwnershipReport {
  const threads = new Map<string, ThreadAccumulator>();
  const anomalies: OwnershipAnomaly[] = [];

  for (const event of events) {
    let accumulator = threads.get(event.threadId);
    if (!accumulator) {
      accumulator = {
        threadId: event.threadId,
        currentOwner: null,
        handoffCount: 0,
        firstEventAt: event.timestamp,
        lastEventAt: event.timestamp,
        previousTimestamp: event.timestamp,
        history: [],
      };
      threads.set(event.threadId, accumulator);
    } else if (event.timestamp.localeCompare(accumulator.previousTimestamp) < 0) {
      anomalies.push({
        eventId: event.id,
        threadId: event.threadId,
        code: "out-of-order-timestamp",
        message:
          "Event " +
          event.id +
          " is older than the previous event on thread " +
          event.threadId +
          ".",
      });
    }

    const previousOwner = accumulator.currentOwner;

    if (event.previousOwner !== undefined && event.previousOwner !== previousOwner) {
      anomalies.push({
        eventId: event.id,
        threadId: event.threadId,
        code: "owner-mismatch",
        message:
          "Event " +
          event.id +
          " expected owner " +
          String(event.previousOwner) +
          " but the thread owner was " +
          String(previousOwner) +
          ".",
      });
    }

    switch (event.action) {
      case "assigned":
      case "claimed": {
        if (previousOwner !== null && previousOwner === event.owner) {
          anomalies.push({
            eventId: event.id,
            threadId: event.threadId,
            code: "duplicate-owner-assignment",
            message:
              "Event " +
              event.id +
              " re-assigned thread " +
              event.threadId +
              " to its current owner.",
          });
        } else if (previousOwner !== null && event.owner !== null) {
          accumulator.handoffCount += 1;
        }
        accumulator.currentOwner = event.owner;
        break;
      }
      case "reassigned": {
        if (previousOwner === null) {
          anomalies.push({
            eventId: event.id,
            threadId: event.threadId,
            code: "reassign-without-existing-owner",
            message:
              "Event " +
              event.id +
              " reassigned thread " +
              event.threadId +
              " with no current owner.",
          });
        } else if (event.owner !== null && event.owner !== previousOwner) {
          accumulator.handoffCount += 1;
        }
        accumulator.currentOwner = event.owner;
        break;
      }
      case "released": {
        if (previousOwner === null) {
          anomalies.push({
            eventId: event.id,
            threadId: event.threadId,
            code: "release-without-owner",
            message:
              "Event " +
              event.id +
              " released thread " +
              event.threadId +
              " with no current owner.",
          });
        }
        accumulator.currentOwner = null;
        break;
      }
    }

    accumulator.history.push(toHistoryEntry(event, previousOwner));
    if (event.timestamp.localeCompare(accumulator.firstEventAt) < 0) {
      accumulator.firstEventAt = event.timestamp;
    }
    if (event.timestamp.localeCompare(accumulator.lastEventAt) > 0) {
      accumulator.lastEventAt = event.timestamp;
    }
    accumulator.previousTimestamp = event.timestamp;
  }

  const records: OwnershipRecord[] = [];
  let ownedThreads = 0;
  let totalHandoffs = 0;

  for (const accumulator of threads.values()) {
    const state: OwnershipState = accumulator.currentOwner === null ? "unassigned" : "owned";
    if (state === "owned") {
      ownedThreads += 1;
    }
    totalHandoffs += accumulator.handoffCount;

    records.push({
      threadId: accumulator.threadId,
      currentOwner: accumulator.currentOwner,
      state,
      handoffCount: accumulator.handoffCount,
      firstEventAt: accumulator.firstEventAt,
      lastEventAt: accumulator.lastEventAt,
      history: accumulator.history,
    });
  }

  return {
    records,
    anomalies,
    summary: {
      totalEvents: events.length,
      totalThreads: records.length,
      ownedThreads,
      unassignedThreads: records.length - ownedThreads,
      totalHandoffs,
      anomalies: anomalies.length,
    },
  };
}
