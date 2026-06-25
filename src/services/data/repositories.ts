import type {
  Message,
  Thread,
  Contact,
  SenderPolicyRecord,
  ProofRecord,
  SyncCursor,
  IdempotentMutation,
} from "./types";

/**
 * MessageRepository interface for accessing message data.
 * All mutations are idempotent and can be safely retried.
 */
export interface MessageRepository {
  /** Get all messages */
  getAll(): Promise<Message[]>;

  /** Get a single message by ID */
  getById(id: string): Promise<Message | null>;

  /** Get messages by folder */
  getByFolder(folder: string): Promise<Message[]>;

  /** Get messages by thread ID */
  getByThreadId(threadId: string): Promise<Message[]>;

  /** Create or update a message (idempotent) */
  upsert(message: Message): Promise<Message>;

  /** Delete a message */
  delete(id: string): Promise<void>;

  /** Bulk update messages (idempotent) */
  bulkUpdate(updates: Array<{ id: string; changes: Partial<Message> }>): Promise<Message[]>;

  /** Record an idempotent mutation for retry logic */
  recordMutation(mutation: IdempotentMutation<Message>): Promise<void>;

  /** Get pending mutations */
  getPendingMutations(): Promise<IdempotentMutation<Message>[]>;

  /** Clear mutations after successful sync */
  clearMutations(ids: string[]): Promise<void>;
}

/**
 * ThreadRepository interface for accessing thread data.
 */
export interface ThreadRepository {
  getAll(): Promise<Thread[]>;

  getById(id: string): Promise<Thread | null>;

  getByParticipant(email: string): Promise<Thread[]>;

  upsert(thread: Thread): Promise<Thread>;

  delete(id: string): Promise<void>;

  /** Update message IDs in a thread */
  updateMessages(threadId: string, messageIds: string[]): Promise<void>;
}

/**
 * ContactRepository interface for managing contacts.
 */
export interface ContactRepository {
  getAll(): Promise<Contact[]>;

  getById(id: string): Promise<Contact | null>;

  getByEmail(email: string): Promise<Contact | null>;

  /** Get all contacts with a specific policy */
  getByPolicy(policy: string): Promise<Contact[]>;

  upsert(contact: Contact): Promise<Contact>;

  delete(id: string): Promise<void>;

  /** Bulk update contacts */
  bulkUpdate(updates: Array<{ id: string; changes: Partial<Contact> }>): Promise<Contact[]>;

  recordMutation(mutation: IdempotentMutation<Contact>): Promise<void>;

  getPendingMutations(): Promise<IdempotentMutation<Contact>[]>;

  clearMutations(ids: string[]): Promise<void>;
}

/**
 * SenderPolicyRepository interface for managing sender policies.
 */
export interface SenderPolicyRepository {
  getAll(): Promise<SenderPolicyRecord[]>;

  getById(id: string): Promise<SenderPolicyRecord | null>;

  /** Get policy for a specific sender email */
  getByEmail(email: string): Promise<SenderPolicyRecord | null>;

  /** Get all policies of a specific type */
  getByPolicy(policy: string): Promise<SenderPolicyRecord[]>;

  upsert(policy: SenderPolicyRecord): Promise<SenderPolicyRecord>;

  delete(id: string): Promise<void>;

  recordMutation(mutation: IdempotentMutation<SenderPolicyRecord>): Promise<void>;

  getPendingMutations(): Promise<IdempotentMutation<SenderPolicyRecord>[]>;

  clearMutations(ids: string[]): Promise<void>;
}

/**
 * ProofRepository interface for managing identity proofs.
 */
export interface ProofRepository {
  getAll(): Promise<ProofRecord[]>;

  getById(id: string): Promise<ProofRecord | null>;

  /** Get proof for a specific message */
  getByMessageId(messageId: string): Promise<ProofRecord | null>;

  /** Get proofs for a contact */
  getByContactId(contactId: string): Promise<ProofRecord[]>;

  /** Get all valid/verified proofs */
  getValid(): Promise<ProofRecord[]>;

  upsert(proof: ProofRecord): Promise<ProofRecord>;

  delete(id: string): Promise<void>;

  recordMutation(mutation: IdempotentMutation<ProofRecord>): Promise<void>;

  getPendingMutations(): Promise<IdempotentMutation<ProofRecord>[]>;

  clearMutations(ids: string[]): Promise<void>;
}

/**
 * SyncCursorRepository for tracking sync state.
 */
export interface SyncCursorRepository {
  getAll(): Promise<SyncCursor[]>;

  getById(id: string): Promise<SyncCursor | null>;

  getBySourceId(sourceId: string): Promise<SyncCursor | null>;

  upsert(cursor: SyncCursor): Promise<SyncCursor>;

  delete(id: string): Promise<void>;

  /** Update last synced timestamp */
  updateSyncTimestamp(id: string, timestamp: string): Promise<void>;

  /** Increment pending changes count */
  incrementPending(id: string, count: number): Promise<void>;
}

/**
 * DataAdapter is the root interface that provides all repositories.
 * This allows switching between different implementations (deterministic, production, etc).
 */
export interface DataAdapter {
  messages: MessageRepository;
  threads: ThreadRepository;
  contacts: ContactRepository;
  policies: SenderPolicyRepository;
  proofs: ProofRepository;
  syncCursors: SyncCursorRepository;

  /** Initialize the adapter (e.g., load from storage) */
  initialize(): Promise<void>;

  /** Clear all data */
  clear(): Promise<void>;

  /** Get adapter name for debugging */
  getName(): string;
}
