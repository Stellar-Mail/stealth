import type { Contact, Message, MailboxState, Policy, Proof, SyncCursor, Thread } from "./types";

export interface IMailboxRepository {
  // Messages
  getMessages(): Promise<Message[]>;
  getMessage(id: string): Promise<Message | null>;
  createMessage(message: Message): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message>;
  deleteMessage(id: string): Promise<void>;

  // Threads
  getThreads(): Promise<Thread[]>;
  getThread(id: string): Promise<Thread | null>;
  createThread(thread: Thread): Promise<Thread>;
  updateThread(id: string, updates: Partial<Thread>): Promise<Thread>;

  // Contacts
  getContacts(): Promise<Contact[]>;
  getContact(address: string): Promise<Contact | null>;
  createContact(contact: Contact): Promise<Contact>;
  updateContact(address: string, updates: Partial<Contact>): Promise<Contact>;

  // Policy
  getPolicy(): Promise<Policy>;
  setPolicy(policy: Policy): Promise<Policy>;

  // Proofs
  getProofs(): Promise<Proof[]>;
  getProof(id: string): Promise<Proof | null>;
  createProof(proof: Proof): Promise<Proof>;
  updateProof(id: string, updates: Partial<Proof>): Promise<Proof>;

  // Sync
  getSyncCursor(): Promise<SyncCursor>;
  setSyncCursor(cursor: SyncCursor): Promise<SyncCursor>;

  // Full state
  getState(): Promise<MailboxState>;
  setState(state: MailboxState): Promise<MailboxState>;
}
