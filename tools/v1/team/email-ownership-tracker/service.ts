import type {
  ClaimThreadInput,
  OwnershipEvent,
  OwnershipThread,
  ReleaseThreadInput,
} from "./types";

function cloneThread(thread: OwnershipThread): OwnershipThread {
  return { ...thread };
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

export class OwnershipTrackerService {
  private readonly threads = new Map<string, OwnershipThread>();
  private readonly events: OwnershipEvent[] = [];

  constructor(seedThreads: OwnershipThread[] = []) {
    for (const thread of seedThreads) {
      this.threads.set(thread.id, cloneThread(thread));
    }
  }

  listThreads(): OwnershipThread[] {
    return Array.from(this.threads.values()).map(cloneThread);
  }

  getThread(threadId: string): OwnershipThread {
    const id = requireText(threadId, "threadId");
    const thread = this.threads.get(id);
    if (!thread) {
      throw new Error(`Thread ${id} was not found.`);
    }
    return cloneThread(thread);
  }

  claimThread(threadId: string, input: ClaimThreadInput): OwnershipThread {
    const id = requireText(threadId, "threadId");
    const teammateId = requireText(input.teammateId, "teammateId");
    const teammateName = requireText(input.teammateName, "teammateName");
    const now = requireText(input.now, "now");
    const thread = this.threads.get(id);

    if (!thread) {
      throw new Error(`Thread ${id} was not found.`);
    }

    if (thread.ownerId && thread.ownerId !== teammateId) {
      throw new Error(`Thread is already owned by ${thread.ownerName ?? thread.ownerId}.`);
    }

    const assigned: OwnershipThread = {
      ...thread,
      status: "assigned",
      ownerId: teammateId,
      ownerName: teammateName,
      updatedAt: now,
    };

    this.threads.set(id, assigned);
    this.events.push({
      threadId: id,
      type: "claimed",
      teammateId,
      teammateName,
      occurredAt: now,
    });
    return cloneThread(assigned);
  }

  releaseThread(threadId: string, input: ReleaseThreadInput): OwnershipThread {
    const id = requireText(threadId, "threadId");
    const teammateId = requireText(input.teammateId, "teammateId");
    const now = requireText(input.now, "now");
    const thread = this.threads.get(id);

    if (!thread) {
      throw new Error(`Thread ${id} was not found.`);
    }

    if (!thread.ownerId) {
      throw new Error("Thread is not currently owned.");
    }

    if (thread.ownerId !== teammateId) {
      throw new Error("Only the current owner can release this thread.");
    }

    const released: OwnershipThread = {
      ...thread,
      status: "released",
      ownerId: null,
      ownerName: null,
      updatedAt: now,
    };

    this.threads.set(id, released);
    this.events.push({
      threadId: id,
      type: "released",
      teammateId,
      teammateName: null,
      occurredAt: now,
    });
    return cloneThread(released);
  }

  getHistory(threadId?: string): OwnershipEvent[] {
    const events = threadId
      ? this.events.filter((event) => event.threadId === requireText(threadId, "threadId"))
      : this.events;
    return events.map((event) => ({ ...event }));
  }
}
