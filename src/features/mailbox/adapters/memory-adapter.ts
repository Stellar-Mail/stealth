import type { Contact, Message, MailboxState, Policy, Proof, SyncCursor, Thread } from "../types";
import type { IMailboxRepository } from "../repository";

const DEFAULT_POLICY: Policy = {
  allowUnknown: false,
  minimumPostage: "0",
  requireVerified: true,
};

const DEFAULT_SYNC_CURSOR: SyncCursor = {
  id: "memory-adapter",
  timestamp: Date.now(),
  source: "local",
};

export class MemoryMailboxAdapter implements IMailboxRepository {
  private messages = new Map<string, Message>();
  private threads = new Map<string, Thread>();
  private contacts = new Map<string, Contact>();
  private proofs = new Map<string, Proof>();
  private policy = DEFAULT_POLICY;
  private syncCursor = DEFAULT_SYNC_CURSOR;

  async getMessages(): Promise<Message[]> {
    return Array.from(this.messages.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  async getMessage(id: string): Promise<Message | null> {
    return this.messages.get(id) ?? null;
  }

  async createMessage(message: Message): Promise<Message> {
    this.messages.set(message.id, structuredClone(message));
    return structuredClone(message);
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message> {
    const existing = this.messages.get(id);
    if (!existing) throw new Error(`Message ${id} not found`);
    const updated = { ...existing, ...updates };
    this.messages.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async deleteMessage(id: string): Promise<void> {
    this.messages.delete(id);
  }

  async getThreads(): Promise<Thread[]> {
    return Array.from(this.threads.values()).sort(
      (a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp,
    );
  }

  async getThread(id: string): Promise<Thread | null> {
    return this.threads.get(id) ?? null;
  }

  async createThread(thread: Thread): Promise<Thread> {
    this.threads.set(thread.id, structuredClone(thread));
    return structuredClone(thread);
  }

  async updateThread(id: string, updates: Partial<Thread>): Promise<Thread> {
    const existing = this.threads.get(id);
    if (!existing) throw new Error(`Thread ${id} not found`);
    const updated = { ...existing, ...updates };
    this.threads.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async getContacts(): Promise<Contact[]> {
    return Array.from(this.contacts.values());
  }

  async getContact(address: string): Promise<Contact | null> {
    return this.contacts.get(address) ?? null;
  }

  async createContact(contact: Contact): Promise<Contact> {
    this.contacts.set(contact.address, structuredClone(contact));
    return structuredClone(contact);
  }

  async updateContact(address: string, updates: Partial<Contact>): Promise<Contact> {
    const existing = this.contacts.get(address);
    if (!existing) throw new Error(`Contact ${address} not found`);
    const updated = { ...existing, ...updates };
    this.contacts.set(address, structuredClone(updated));
    return structuredClone(updated);
  }

  async getProofs(): Promise<Proof[]> {
    return Array.from(this.proofs.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  async getProof(id: string): Promise<Proof | null> {
    return this.proofs.get(id) ?? null;
  }

  async createProof(proof: Proof): Promise<Proof> {
    this.proofs.set(proof.id, structuredClone(proof));
    return structuredClone(proof);
  }

  async updateProof(id: string, updates: Partial<Proof>): Promise<Proof> {
    const existing = this.proofs.get(id);
    if (!existing) throw new Error(`Proof ${id} not found`);
    const updated = { ...existing, ...updates };
    this.proofs.set(id, structuredClone(updated));
    return structuredClone(updated);
  }

  async getPolicy(): Promise<Policy> {
    return structuredClone(this.policy);
  }

  async setPolicy(policy: Policy): Promise<Policy> {
    this.policy = structuredClone(policy);
    return structuredClone(policy);
  }

  async getSyncCursor(): Promise<SyncCursor> {
    return structuredClone(this.syncCursor);
  }

  async setSyncCursor(cursor: SyncCursor): Promise<SyncCursor> {
    this.syncCursor = structuredClone(cursor);
    return structuredClone(cursor);
  }

  async getState(): Promise<MailboxState> {
    return {
      version: 1,
      messages: await this.getMessages(),
      threads: await this.getThreads(),
      contacts: await this.getContacts(),
      policy: await this.getPolicy(),
      proofs: await this.getProofs(),
      syncCursor: await this.getSyncCursor(),
    };
  }

  async setState(state: MailboxState): Promise<MailboxState> {
    this.messages.clear();
    this.threads.clear();
    this.contacts.clear();
    this.proofs.clear();

    state.messages.forEach((msg) => this.messages.set(msg.id, structuredClone(msg)));
    state.threads.forEach((thread) => this.threads.set(thread.id, structuredClone(thread)));
    state.contacts.forEach((contact) =>
      this.contacts.set(contact.address, structuredClone(contact)),
    );
    state.proofs.forEach((proof) => this.proofs.set(proof.id, structuredClone(proof)));

    this.policy = structuredClone(state.policy);
    this.syncCursor = structuredClone(state.syncCursor);

    return structuredClone(state);
  }
}
