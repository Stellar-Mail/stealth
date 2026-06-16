import type { Contact, Message, MailboxState, Policy, Proof, SyncCursor, Thread } from "../types";
import type { IMailboxRepository } from "../repository";
import { MemoryMailboxAdapter } from "./memory-adapter";

const STORAGE_KEY = "stealth-mailbox-v1";
const DEFAULT_POLICY: Policy = {
  allowUnknown: false,
  minimumPostage: "0",
  requireVerified: true,
};

const DEFAULT_SYNC_CURSOR: SyncCursor = {
  id: "storage-adapter",
  timestamp: Date.now(),
  source: "local",
};

export class StorageMailboxAdapter implements IMailboxRepository {
  private memory: MemoryMailboxAdapter;
  private initialized = false;

  constructor() {
    this.memory = new MemoryMailboxAdapter();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const state = JSON.parse(stored) as MailboxState;
          await this.memory.setState(state);
        } else {
          await this.initializeDefaults();
        }
      } catch (error) {
        console.error("Failed to load mailbox from storage:", error);
        await this.initializeDefaults();
      }
    } else {
      await this.initializeDefaults();
    }

    this.initialized = true;
  }

  private async initializeDefaults(): Promise<void> {
    await this.memory.setPolicy(DEFAULT_POLICY);
    await this.memory.setSyncCursor(DEFAULT_SYNC_CURSOR);
  }

  private async persist(): Promise<void> {
    if (typeof window !== "undefined" && window.localStorage) {
      const state = await this.memory.getState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }

  async getMessages(): Promise<Message[]> {
    await this.ensureInitialized();
    return this.memory.getMessages();
  }

  async getMessage(id: string): Promise<Message | null> {
    await this.ensureInitialized();
    return this.memory.getMessage(id);
  }

  async createMessage(message: Message): Promise<Message> {
    await this.ensureInitialized();
    const result = await this.memory.createMessage(message);
    await this.persist();
    return result;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message> {
    await this.ensureInitialized();
    const result = await this.memory.updateMessage(id, updates);
    await this.persist();
    return result;
  }

  async deleteMessage(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.memory.deleteMessage(id);
    await this.persist();
  }

  async getThreads(): Promise<Thread[]> {
    await this.ensureInitialized();
    return this.memory.getThreads();
  }

  async getThread(id: string): Promise<Thread | null> {
    await this.ensureInitialized();
    return this.memory.getThread(id);
  }

  async createThread(thread: Thread): Promise<Thread> {
    await this.ensureInitialized();
    const result = await this.memory.createThread(thread);
    await this.persist();
    return result;
  }

  async updateThread(id: string, updates: Partial<Thread>): Promise<Thread> {
    await this.ensureInitialized();
    const result = await this.memory.updateThread(id, updates);
    await this.persist();
    return result;
  }

  async getContacts(): Promise<Contact[]> {
    await this.ensureInitialized();
    return this.memory.getContacts();
  }

  async getContact(address: string): Promise<Contact | null> {
    await this.ensureInitialized();
    return this.memory.getContact(address);
  }

  async createContact(contact: Contact): Promise<Contact> {
    await this.ensureInitialized();
    const result = await this.memory.createContact(contact);
    await this.persist();
    return result;
  }

  async updateContact(address: string, updates: Partial<Contact>): Promise<Contact> {
    await this.ensureInitialized();
    const result = await this.memory.updateContact(address, updates);
    await this.persist();
    return result;
  }

  async getProofs(): Promise<Proof[]> {
    await this.ensureInitialized();
    return this.memory.getProofs();
  }

  async getProof(id: string): Promise<Proof | null> {
    await this.ensureInitialized();
    return this.memory.getProof(id);
  }

  async createProof(proof: Proof): Promise<Proof> {
    await this.ensureInitialized();
    const result = await this.memory.createProof(proof);
    await this.persist();
    return result;
  }

  async updateProof(id: string, updates: Partial<Proof>): Promise<Proof> {
    await this.ensureInitialized();
    const result = await this.memory.updateProof(id, updates);
    await this.persist();
    return result;
  }

  async getPolicy(): Promise<Policy> {
    await this.ensureInitialized();
    return this.memory.getPolicy();
  }

  async setPolicy(policy: Policy): Promise<Policy> {
    await this.ensureInitialized();
    const result = await this.memory.setPolicy(policy);
    await this.persist();
    return result;
  }

  async getSyncCursor(): Promise<SyncCursor> {
    await this.ensureInitialized();
    return this.memory.getSyncCursor();
  }

  async setSyncCursor(cursor: SyncCursor): Promise<SyncCursor> {
    await this.ensureInitialized();
    const result = await this.memory.setSyncCursor(cursor);
    await this.persist();
    return result;
  }

  async getState(): Promise<MailboxState> {
    await this.ensureInitialized();
    return this.memory.getState();
  }

  async setState(state: MailboxState): Promise<MailboxState> {
    const result = await this.memory.setState(state);
    await this.persist();
    return result;
  }
}
