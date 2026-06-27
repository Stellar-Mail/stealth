/**
 * Deterministic adapter for testing.
 * In-memory storage with predictable behavior, seeded with mock data.
 * Useful for UI tests that need reproducible state.
 */

import { emails as mockEmails } from "@/components/mail/data";
import type {
  Message,
  Thread,
  Contact,
  SenderPolicyRecord,
  ProofRecord,
  SyncCursor,
  IdempotentMutation,
} from "../types";
import type {
  DataAdapter,
  MessageRepository,
  ThreadRepository,
  ContactRepository,
  SenderPolicyRepository,
  ProofRepository,
  SyncCursorRepository,
} from "../repositories";

/**
 * In-memory repository for messages.
 */
class DeterministicMessageRepository implements MessageRepository {
  private messages: Map<string, Message> = new Map();
  private mutations: Map<string, IdempotentMutation<Message>> = new Map();

  constructor(initialMessages: Message[]) {
    for (const msg of initialMessages) {
      this.messages.set(msg.id, msg);
    }
  }

  async getAll(): Promise<Message[]> {
    return Array.from(this.messages.values());
  }

  async getById(id: string): Promise<Message | null> {
    return this.messages.get(id) ?? null;
  }

  async getByFolder(folder: string): Promise<Message[]> {
    return Array.from(this.messages.values()).filter((m) => m.folder === folder);
  }

  async getByThreadId(threadId: string): Promise<Message[]> {
    // In this simplified implementation, we don't have explicit thread tracking.
    // Could be enhanced later with thread_id on messages.
    return [];
  }

  async upsert(message: Message): Promise<Message> {
    const updated = {
      ...message,
      updatedAt: new Date().toISOString(),
      syncStatus: "synced" as const,
    };
    this.messages.set(message.id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.messages.delete(id);
  }

  async bulkUpdate(updates: Array<{ id: string; changes: Partial<Message> }>): Promise<Message[]> {
    const result: Message[] = [];
    for (const { id, changes } of updates) {
      const msg = this.messages.get(id);
      if (msg) {
        const updated = { ...msg, ...changes, updatedAt: new Date().toISOString() };
        this.messages.set(id, updated);
        result.push(updated);
      }
    }
    return result;
  }

  async recordMutation(mutation: IdempotentMutation<Message>): Promise<void> {
    this.mutations.set(mutation.id, mutation);
  }

  async getPendingMutations(): Promise<IdempotentMutation<Message>[]> {
    return Array.from(this.mutations.values());
  }

  async clearMutations(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.mutations.delete(id);
    }
  }

  reset(): void {
    this.messages.clear();
    this.mutations.clear();
    for (const msg of mockEmails) {
      this.messages.set(msg.id, msg);
    }
  }

  /** Get snapshot of current state (for test assertions) */
  snapshot(): Message[] {
    return Array.from(this.messages.values());
  }
}

/**
 * In-memory repository for threads.
 */
class DeterministicThreadRepository implements ThreadRepository {
  private threads: Map<string, Thread> = new Map();

  async getAll(): Promise<Thread[]> {
    return Array.from(this.threads.values());
  }

  async getById(id: string): Promise<Thread | null> {
    return this.threads.get(id) ?? null;
  }

  async getByParticipant(email: string): Promise<Thread[]> {
    return Array.from(this.threads.values()).filter((t) => t.participants.includes(email));
  }

  async upsert(thread: Thread): Promise<Thread> {
    this.threads.set(thread.id, thread);
    return thread;
  }

  async delete(id: string): Promise<void> {
    this.threads.delete(id);
  }

  async updateMessages(threadId: string, messageIds: string[]): Promise<void> {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.messageIds = messageIds;
    }
  }
}

/**
 * In-memory repository for contacts.
 */
class DeterministicContactRepository implements ContactRepository {
  private contacts: Map<string, Contact> = new Map();
  private mutations: Map<string, IdempotentMutation<Contact>> = new Map();

  async getAll(): Promise<Contact[]> {
    return Array.from(this.contacts.values());
  }

  async getById(id: string): Promise<Contact | null> {
    return this.contacts.get(id) ?? null;
  }

  async getByEmail(email: string): Promise<Contact | null> {
    for (const contact of this.contacts.values()) {
      if (contact.email === email) return contact;
    }
    return null;
  }

  async getByPolicy(policy: string): Promise<Contact[]> {
    return Array.from(this.contacts.values()).filter((c) => c.policy === policy);
  }

  async upsert(contact: Contact): Promise<Contact> {
    this.contacts.set(contact.id, contact);
    return contact;
  }

  async delete(id: string): Promise<void> {
    this.contacts.delete(id);
  }

  async bulkUpdate(updates: Array<{ id: string; changes: Partial<Contact> }>): Promise<Contact[]> {
    const result: Contact[] = [];
    for (const { id, changes } of updates) {
      const contact = this.contacts.get(id);
      if (contact) {
        const updated = { ...contact, ...changes };
        this.contacts.set(id, updated);
        result.push(updated);
      }
    }
    return result;
  }

  async recordMutation(mutation: IdempotentMutation<Contact>): Promise<void> {
    this.mutations.set(mutation.id, mutation);
  }

  async getPendingMutations(): Promise<IdempotentMutation<Contact>[]> {
    return Array.from(this.mutations.values());
  }

  async clearMutations(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.mutations.delete(id);
    }
  }
}

/**
 * In-memory repository for sender policies.
 */
class DeterministicSenderPolicyRepository implements SenderPolicyRepository {
  private policies: Map<string, SenderPolicyRecord> = new Map();
  private mutations: Map<string, IdempotentMutation<SenderPolicyRecord>> = new Map();

  async getAll(): Promise<SenderPolicyRecord[]> {
    return Array.from(this.policies.values());
  }

  async getById(id: string): Promise<SenderPolicyRecord | null> {
    return this.policies.get(id) ?? null;
  }

  async getByEmail(email: string): Promise<SenderPolicyRecord | null> {
    for (const policy of this.policies.values()) {
      if (policy.email === email) return policy;
    }
    return null;
  }

  async getByPolicy(policy: string): Promise<SenderPolicyRecord[]> {
    return Array.from(this.policies.values()).filter((p) => p.policy === policy);
  }

  async upsert(policy: SenderPolicyRecord): Promise<SenderPolicyRecord> {
    this.policies.set(policy.id, policy);
    return policy;
  }

  async delete(id: string): Promise<void> {
    this.policies.delete(id);
  }

  async recordMutation(mutation: IdempotentMutation<SenderPolicyRecord>): Promise<void> {
    this.mutations.set(mutation.id, mutation);
  }

  async getPendingMutations(): Promise<IdempotentMutation<SenderPolicyRecord>[]> {
    return Array.from(this.mutations.values());
  }

  async clearMutations(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.mutations.delete(id);
    }
  }
}

/**
 * In-memory repository for proofs.
 */
class DeterministicProofRepository implements ProofRepository {
  private proofs: Map<string, ProofRecord> = new Map();
  private mutations: Map<string, IdempotentMutation<ProofRecord>> = new Map();

  async getAll(): Promise<ProofRecord[]> {
    return Array.from(this.proofs.values());
  }

  async getById(id: string): Promise<ProofRecord | null> {
    return this.proofs.get(id) ?? null;
  }

  async getByMessageId(messageId: string): Promise<ProofRecord | null> {
    for (const proof of this.proofs.values()) {
      if (proof.messageId === messageId) return proof;
    }
    return null;
  }

  async getByContactId(contactId: string): Promise<ProofRecord[]> {
    return Array.from(this.proofs.values()).filter((p) => p.contactId === contactId);
  }

  async getValid(): Promise<ProofRecord[]> {
    return Array.from(this.proofs.values()).filter((p) => p.status === "valid");
  }

  async upsert(proof: ProofRecord): Promise<ProofRecord> {
    this.proofs.set(proof.id, proof);
    return proof;
  }

  async delete(id: string): Promise<void> {
    this.proofs.delete(id);
  }

  async recordMutation(mutation: IdempotentMutation<ProofRecord>): Promise<void> {
    this.mutations.set(mutation.id, mutation);
  }

  async getPendingMutations(): Promise<IdempotentMutation<ProofRecord>[]> {
    return Array.from(this.mutations.values());
  }

  async clearMutations(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.mutations.delete(id);
    }
  }
}

/**
 * In-memory repository for sync cursors.
 */
class DeterministicSyncCursorRepository implements SyncCursorRepository {
  private cursors: Map<string, SyncCursor> = new Map();

  async getAll(): Promise<SyncCursor[]> {
    return Array.from(this.cursors.values());
  }

  async getById(id: string): Promise<SyncCursor | null> {
    return this.cursors.get(id) ?? null;
  }

  async getBySourceId(sourceId: string): Promise<SyncCursor | null> {
    for (const cursor of this.cursors.values()) {
      if (cursor.sourceId === sourceId) return cursor;
    }
    return null;
  }

  async upsert(cursor: SyncCursor): Promise<SyncCursor> {
    this.cursors.set(cursor.id, cursor);
    return cursor;
  }

  async delete(id: string): Promise<void> {
    this.cursors.delete(id);
  }

  async updateSyncTimestamp(id: string, timestamp: string): Promise<void> {
    const cursor = this.cursors.get(id);
    if (cursor) {
      cursor.lastSyncedAt = timestamp;
    }
  }

  async incrementPending(id: string, count: number): Promise<void> {
    const cursor = this.cursors.get(id);
    if (cursor) {
      cursor.pendingChanges += count;
    }
  }
}

/**
 * Deterministic adapter implementation.
 */
export class DeterministicAdapter implements DataAdapter {
  readonly messages: DeterministicMessageRepository;
  readonly threads: DeterministicThreadRepository;
  readonly contacts: DeterministicContactRepository;
  readonly policies: DeterministicSenderPolicyRepository;
  readonly proofs: DeterministicProofRepository;
  readonly syncCursors: DeterministicSyncCursorRepository;

  constructor() {
    this.messages = new DeterministicMessageRepository(mockEmails);
    this.threads = new DeterministicThreadRepository();
    this.contacts = new DeterministicContactRepository();
    this.policies = new DeterministicSenderPolicyRepository();
    this.proofs = new DeterministicProofRepository();
    this.syncCursors = new DeterministicSyncCursorRepository();
  }

  async initialize(): Promise<void> {
    // No-op for deterministic adapter
  }

  async clear(): Promise<void> {
    this.messages.reset();
    const threads = Array.from(this.threads.getAll());
    const contacts = Array.from(this.contacts.getAll());
    const policies = Array.from(this.policies.getAll());
    const proofs = Array.from(this.proofs.getAll());

    threads.forEach((t) => this.threads.delete(t.id));
    contacts.forEach((c) => this.contacts.delete(c.id));
    policies.forEach((p) => this.policies.delete(p.id));
    proofs.forEach((p) => this.proofs.delete(p.id));
  }

  getName(): string {
    return "deterministic";
  }

  /** Reset to initial state */
  reset(): void {
    this.messages.reset();
  }

  /** Get current state snapshot */
  snapshot() {
    return {
      messages: this.messages.snapshot(),
      threads: this.threads.getAll(),
      contacts: this.contacts.getAll(),
      policies: this.policies.getAll(),
      proofs: this.proofs.getAll(),
      syncCursors: this.syncCursors.getAll(),
    };
  }
}
