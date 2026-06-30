/**
 * Offline-first adapter for production use.
 * Combines localStorage (persistent) with in-memory cache for performance.
 * Handles optimistic updates and background sync placeholder.
 */

import { runMigrations } from "../migrations";
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

const STORAGE_KEY_MESSAGES = "stealth-mailbox-messages.v1";
const STORAGE_KEY_CONTACTS = "stealth-mailbox-contacts.v1";
const STORAGE_KEY_POLICIES = "stealth-mailbox-policies.v1";
const STORAGE_KEY_PROOFS = "stealth-mailbox-proofs.v1";
const STORAGE_KEY_THREADS = "stealth-mailbox-threads.v1";
const STORAGE_KEY_SYNC = "stealth-mailbox-sync.v1";

/**
 * Helper to safely read from localStorage.
 */
function safeLocalStorageRead<T>(key: string, defaultValue: T): T {
  try {
    if (typeof globalThis === "undefined" || !globalThis.localStorage) {
      return defaultValue;
    }
    const item = globalThis.localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage:`, error);
    return defaultValue;
  }
}

/**
 * Helper to safely write to localStorage.
 */
function safeLocalStorageWrite(key: string, value: unknown): boolean {
  try {
    if (typeof globalThis === "undefined" || !globalThis.localStorage) {
      return false;
    }
    globalThis.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to write ${key} to localStorage:`, error);
    return false;
  }
}

/**
 * Offline-first message repository.
 */
class OfflineFirstMessageRepository implements MessageRepository {
  private messages: Map<string, Message> = new Map();
  private mutations: Map<string, IdempotentMutation<Message>> = new Map();

  async initialize(): Promise<void> {
    const stored = safeLocalStorageRead<Message[]>(STORAGE_KEY_MESSAGES, []);
    const migrated = (await runMigrations(stored)) as Message[];
    for (const msg of migrated) {
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

  async getByThreadId(_threadId: string): Promise<Message[]> {
    return [];
  }

  async upsert(message: Message): Promise<Message> {
    const updated = {
      ...message,
      updatedAt: new Date().toISOString(),
      syncStatus: "synced" as const,
    };
    this.messages.set(message.id, updated);
    this.persist();
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.messages.delete(id);
    this.persist();
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
    this.persist();
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

  private persist(): void {
    const data = Array.from(this.messages.values());
    safeLocalStorageWrite(STORAGE_KEY_MESSAGES, data);
  }

  async reset(): Promise<void> {
    this.messages.clear();
    for (const msg of mockEmails) {
      this.messages.set(msg.id, msg);
    }
    this.persist();
  }
}

/**
 * Offline-first thread repository.
 */
class OfflineFirstThreadRepository implements ThreadRepository {
  private threads: Map<string, Thread> = new Map();

  async initialize(): Promise<void> {
    const stored = safeLocalStorageRead<Thread[]>(STORAGE_KEY_THREADS, []);
    for (const thread of stored) {
      this.threads.set(thread.id, thread);
    }
  }

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
    this.persist();
    return thread;
  }

  async delete(id: string): Promise<void> {
    this.threads.delete(id);
    this.persist();
  }

  async updateMessages(threadId: string, messageIds: string[]): Promise<void> {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.messageIds = messageIds;
      this.persist();
    }
  }

  private persist(): void {
    const data = Array.from(this.threads.values());
    safeLocalStorageWrite(STORAGE_KEY_THREADS, data);
  }
}

/**
 * Offline-first contact repository.
 */
class OfflineFirstContactRepository implements ContactRepository {
  private contacts: Map<string, Contact> = new Map();
  private mutations: Map<string, IdempotentMutation<Contact>> = new Map();

  async initialize(): Promise<void> {
    const stored = safeLocalStorageRead<Contact[]>(STORAGE_KEY_CONTACTS, []);
    for (const contact of stored) {
      this.contacts.set(contact.id, contact);
    }
  }

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
    this.persist();
    return contact;
  }

  async delete(id: string): Promise<void> {
    this.contacts.delete(id);
    this.persist();
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
    this.persist();
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

  private persist(): void {
    const data = Array.from(this.contacts.values());
    safeLocalStorageWrite(STORAGE_KEY_CONTACTS, data);
  }
}

/**
 * Offline-first sender policy repository.
 */
class OfflineFirstSenderPolicyRepository implements SenderPolicyRepository {
  private policies: Map<string, SenderPolicyRecord> = new Map();
  private mutations: Map<string, IdempotentMutation<SenderPolicyRecord>> = new Map();

  async initialize(): Promise<void> {
    const stored = safeLocalStorageRead<SenderPolicyRecord[]>(STORAGE_KEY_POLICIES, []);
    for (const policy of stored) {
      this.policies.set(policy.id, policy);
    }
  }

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
    this.persist();
    return policy;
  }

  async delete(id: string): Promise<void> {
    this.policies.delete(id);
    this.persist();
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

  private persist(): void {
    const data = Array.from(this.policies.values());
    safeLocalStorageWrite(STORAGE_KEY_POLICIES, data);
  }
}

/**
 * Offline-first proof repository.
 */
class OfflineFirstProofRepository implements ProofRepository {
  private proofs: Map<string, ProofRecord> = new Map();
  private mutations: Map<string, IdempotentMutation<ProofRecord>> = new Map();

  async initialize(): Promise<void> {
    const stored = safeLocalStorageRead<ProofRecord[]>(STORAGE_KEY_PROOFS, []);
    for (const proof of stored) {
      this.proofs.set(proof.id, proof);
    }
  }

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
    this.persist();
    return proof;
  }

  async delete(id: string): Promise<void> {
    this.proofs.delete(id);
    this.persist();
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

  private persist(): void {
    const data = Array.from(this.proofs.values());
    safeLocalStorageWrite(STORAGE_KEY_PROOFS, data);
  }
}

/**
 * Offline-first sync cursor repository.
 */
class OfflineFirstSyncCursorRepository implements SyncCursorRepository {
  private cursors: Map<string, SyncCursor> = new Map();

  async initialize(): Promise<void> {
    const stored = safeLocalStorageRead<SyncCursor[]>(STORAGE_KEY_SYNC, []);
    for (const cursor of stored) {
      this.cursors.set(cursor.id, cursor);
    }
  }

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
    this.persist();
    return cursor;
  }

  async delete(id: string): Promise<void> {
    this.cursors.delete(id);
    this.persist();
  }

  async updateSyncTimestamp(id: string, timestamp: string): Promise<void> {
    const cursor = this.cursors.get(id);
    if (cursor) {
      cursor.lastSyncedAt = timestamp;
      this.persist();
    }
  }

  async incrementPending(id: string, count: number): Promise<void> {
    const cursor = this.cursors.get(id);
    if (cursor) {
      cursor.pendingChanges += count;
      this.persist();
    }
  }

  private persist(): void {
    const data = Array.from(this.cursors.values());
    safeLocalStorageWrite(STORAGE_KEY_SYNC, data);
  }
}

/**
 * Offline-first adapter for production use.
 */
export class OfflineFirstAdapter implements DataAdapter {
  readonly messages: OfflineFirstMessageRepository;
  readonly threads: OfflineFirstThreadRepository;
  readonly contacts: OfflineFirstContactRepository;
  readonly policies: OfflineFirstSenderPolicyRepository;
  readonly proofs: OfflineFirstProofRepository;
  readonly syncCursors: OfflineFirstSyncCursorRepository;

  constructor() {
    this.messages = new OfflineFirstMessageRepository();
    this.threads = new OfflineFirstThreadRepository();
    this.contacts = new OfflineFirstContactRepository();
    this.policies = new OfflineFirstSenderPolicyRepository();
    this.proofs = new OfflineFirstProofRepository();
    this.syncCursors = new OfflineFirstSyncCursorRepository();
  }

  async initialize(): Promise<void> {
    await this.messages.initialize();
    await this.threads.initialize();
    await this.contacts.initialize();
    await this.policies.initialize();
    await this.proofs.initialize();
    await this.syncCursors.initialize();
  }

  async clear(): Promise<void> {
    await this.messages.reset();
    const threads = await this.threads.getAll();
    const contacts = await this.contacts.getAll();
    const policies = await this.policies.getAll();
    const proofs = await this.proofs.getAll();

    for (const thread of Array.from(threads)) {
      await this.threads.delete(thread.id);
    }
    for (const contact of Array.from(contacts)) {
      await this.contacts.delete(contact.id);
    }
    for (const policy of Array.from(policies)) {
      await this.policies.delete(policy.id);
    }
    for (const proof of Array.from(proofs)) {
      await this.proofs.delete(proof.id);
    }
  }

  getName(): string {
    return "offline-first";
  }
}
