import type {
  Credential,
  IdempotencyRecord,
  MailboxPolicy,
  Postage,
  PostageStatus,
  Profile,
  Receipt,
  SenderRule,
  StoredEnvelope,
  User,
  UsernameRecord,
} from "./domain";
import type {
  ApiRepository,
  InsertEnvelopeResult,
  PostageTransitionResult,
  ReserveUsernameResult,
  UpdateUserResult,
} from "./repository";
import { ApiError } from "./errors";

function key(owner: string, sender: string) {
  return `${owner}:${sender}`;
}

export class MemoryApiRepository implements ApiRepository {
  private readonly policies = new Map<string, MailboxPolicy>();
  private readonly postage = new Map<string, Postage>();
  private readonly receipts = new Map<string, Receipt>();
  private readonly senderRules = new Map<string, SenderRule>();
  private readonly counters = new Map<string, number[]>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly receiptLocks = new Map<string, Promise<void>>();
  // Issue #1936: envelope store and per-key insert locks.
  private readonly envelopes = new Map<string, StoredEnvelope>();
  private readonly envelopeLocks = new Map<string, Promise<void>>();

  // BETA-002: User Account, Profile, Credential storage & unique index maps
  private readonly usersById = new Map<string, User>();
  private readonly usersByEmail = new Map<string, string>();
  private readonly usersByUsername = new Map<string, string>();
  private readonly usersByAddress = new Map<string, string>();
  private readonly profiles = new Map<string, Profile>();
  private readonly credentials = new Map<string, Credential>();

  // Issue #1910: canonical username *reservation* store and per-key locks.
  // Distinct from usersByUsername (BETA-002) — see the note above
  // reserveUsernameIfAbsent for how the two relate.
  private readonly usernames = new Map<string, UsernameRecord>();
  private readonly usernameLocks = new Map<string, Promise<void>>();

  private async withReceiptLock<T>(messageId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.receiptLocks.get(messageId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.receiptLocks.set(messageId, queued);

    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.receiptLocks.get(messageId) === queued) {
        this.receiptLocks.delete(messageId);
      }
    }
  }

  private async withEnvelopeLock<T>(messageId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.envelopeLocks.get(messageId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.envelopeLocks.set(messageId, queued);

    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.envelopeLocks.get(messageId) === queued) {
        this.envelopeLocks.delete(messageId);
      }
    }
  }

  private async withUsernameLock<T>(username: string, action: () => Promise<T>): Promise<T> {
    const previous = this.usernameLocks.get(username) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.usernameLocks.set(username, queued);

    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.usernameLocks.get(username) === queued) {
        this.usernameLocks.delete(username);
      }
    }
  }

  async getPolicy(owner: string) {
    return structuredClone(this.policies.get(owner) ?? null);
  }

  async setPolicy(owner: string, policy: MailboxPolicy) {
    this.policies.set(owner, structuredClone(policy));
    return structuredClone(policy);
  }

  async getSenderRule(owner: string, sender: string) {
    return this.senderRules.get(key(owner, sender)) ?? "default";
  }

  async setSenderRule(owner: string, sender: string, rule: SenderRule) {
    const ruleKey = key(owner, sender);
    if (rule === "default") this.senderRules.delete(ruleKey);
    else this.senderRules.set(ruleKey, rule);
    return rule;
  }

  async getPostage(messageId: string) {
    return structuredClone(this.postage.get(messageId) ?? null);
  }

  async setPostage(postage: Postage) {
    this.postage.set(postage.messageId, structuredClone(postage));
    return structuredClone(postage);
  }

  async transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult> {
    const current = this.postage.get(messageId);
    if (!current) {
      return { outcome: "not-found" };
    }
    if (current.status !== expectedStatus) {
      return { outcome: "conflict", postage: structuredClone(current) };
    }
    const updated: Postage = { ...current, status: nextStatus };
    this.postage.set(messageId, updated);
    return { outcome: "applied", postage: structuredClone(updated) };
  }

  async insertPostage(postage: Postage) {
    if (this.postage.has(postage.messageId)) {
      throw new ApiError(
        409,
        "conflict",
        `A postage record already exists for message ${postage.messageId}`,
      );
    }
    this.postage.set(postage.messageId, structuredClone(postage));
    return structuredClone(postage);
  }

  // Issue #1910: canonical username *reservation* (username@stealth.me /
  // username*stealth.me federation mapping). Deliberately independent of
  // BETA-002's usersByUsername index above: this store is keyed by the
  // caller-supplied ownerAddress rather than a full User account, so an
  // address can reserve its identity before (or without) creating a full
  // account. Reconciling the two into a single uniqueness domain is a
  // follow-up, not part of this change.
  async getUsernameRecord(username: string) {
    return structuredClone(this.usernames.get(username) ?? null);
  }

  async reserveUsernameIfAbsent(record: UsernameRecord): Promise<ReserveUsernameResult> {
    return this.withUsernameLock(record.username, async () => {
      const existing = this.usernames.get(record.username);
      if (existing) {
        return { outcome: "taken", record: structuredClone(existing) };
      }
      this.usernames.set(record.username, structuredClone(record));
      return { outcome: "reserved", record: structuredClone(record) };
    });
  }

  async getReceipt(messageId: string) {
    return structuredClone(this.receipts.get(messageId) ?? null);
  }

  async setReceipt(receipt: Receipt) {
    this.receipts.set(receipt.messageId, structuredClone(receipt));
    return structuredClone(receipt);
  }

  async createReceiptIfAbsent(receipt: Receipt) {
    return this.withReceiptLock(receipt.messageId, async () => {
      const existing = this.receipts.get(receipt.messageId);
      if (existing) return { created: false, receipt: structuredClone(existing) };

      this.receipts.set(receipt.messageId, structuredClone(receipt));
      return { created: true, receipt: structuredClone(receipt) };
    });
  }

  async markReceiptRead(
    messageId: string,
    actor: string,
    now = new Date(),
  ): Promise<import("./repository").MarkReceiptReadResult> {
    const receipt = this.receipts.get(messageId);
    if (!receipt) {
      return { outcome: "not-found" };
    }
    if (actor !== receipt.sender && actor !== receipt.recipient) {
      return { outcome: "forbidden" };
    }
    if (receipt.readAt !== null) {
      return { outcome: "already-read", readAt: receipt.readAt };
    }
    const updated: Receipt = { ...receipt, readAt: now.toISOString() };
    this.receipts.set(messageId, updated);
    return { outcome: "marked", receipt: structuredClone(updated) };
  }

  // BETA-002 User Account, Profile, and Credential Domain Implementation
  async getUserById(userId: string): Promise<User | null> {
    return structuredClone(this.usersById.get(userId) ?? null);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const userId = this.usersByEmail.get(email.toLowerCase().trim());
    if (!userId) return null;
    return structuredClone(this.usersById.get(userId) ?? null);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const userId = this.usersByUsername.get(username.toLowerCase().trim());
    if (!userId) return null;
    return structuredClone(this.usersById.get(userId) ?? null);
  }

  async getUserByAddress(address: string): Promise<User | null> {
    const userId = this.usersByAddress.get(address.toUpperCase().trim());
    if (!userId) return null;
    return structuredClone(this.usersById.get(userId) ?? null);
  }

  async createUser(user: User, credential?: Credential, profile?: Profile): Promise<User> {
    if (this.usersById.has(user.userId)) {
      throw new ApiError(409, "conflict", `User ID ${user.userId} already exists`);
    }

    const normEmail = user.email.toLowerCase().trim();
    if (this.usersByEmail.has(normEmail)) {
      throw new ApiError(409, "conflict", `User with email ${user.email} already exists`);
    }

    const normUsername = user.username.toLowerCase().trim();
    if (this.usersByUsername.has(normUsername)) {
      throw new ApiError(409, "conflict", `Username ${user.username} already in use`);
    }

    const normAddress = user.address.toUpperCase().trim();
    if (this.usersByAddress.has(normAddress)) {
      throw new ApiError(409, "conflict", `Stellar address ${user.address} is already bound`);
    }

    const clonedUser = structuredClone(user);
    this.usersById.set(user.userId, clonedUser);
    this.usersByEmail.set(normEmail, user.userId);
    this.usersByUsername.set(normUsername, user.userId);
    this.usersByAddress.set(normAddress, user.userId);

    if (credential) {
      this.credentials.set(user.userId, structuredClone(credential));
    }
    if (profile) {
      this.profiles.set(user.userId, structuredClone(profile));
    }

    return structuredClone(clonedUser);
  }

  async updateUser(user: User, expectedVersion: number): Promise<UpdateUserResult> {
    const current = this.usersById.get(user.userId);
    if (!current) {
      return { updated: false, current: null };
    }

    if (current.version !== expectedVersion) {
      return { updated: false, current: structuredClone(current) };
    }

    const normEmail = user.email.toLowerCase().trim();
    const existingEmailOwner = this.usersByEmail.get(normEmail);
    if (existingEmailOwner && existingEmailOwner !== user.userId) {
      throw new ApiError(409, "conflict", `User with email ${user.email} already exists`);
    }

    const normUsername = user.username.toLowerCase().trim();
    const existingUsernameOwner = this.usersByUsername.get(normUsername);
    if (existingUsernameOwner && existingUsernameOwner !== user.userId) {
      throw new ApiError(409, "conflict", `Username ${user.username} already in use`);
    }

    const normAddress = user.address.toUpperCase().trim();
    const existingAddressOwner = this.usersByAddress.get(normAddress);
    if (existingAddressOwner && existingAddressOwner !== user.userId) {
      throw new ApiError(409, "conflict", `Stellar address ${user.address} is already bound`);
    }

    // Clean up old index entries if changed
    if (current.email.toLowerCase().trim() !== normEmail) {
      this.usersByEmail.delete(current.email.toLowerCase().trim());
    }
    if (current.username.toLowerCase().trim() !== normUsername) {
      this.usersByUsername.delete(current.username.toLowerCase().trim());
    }
    if (current.address.toUpperCase().trim() !== normAddress) {
      this.usersByAddress.delete(current.address.toUpperCase().trim());
    }

    const nextUser: User = {
      ...user,
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    };

    this.usersById.set(user.userId, structuredClone(nextUser));
    this.usersByEmail.set(normEmail, user.userId);
    this.usersByUsername.set(normUsername, user.userId);
    this.usersByAddress.set(normAddress, user.userId);

    return { updated: true, user: structuredClone(nextUser) };
  }

  async getProfile(userId: string): Promise<Profile | null> {
    return structuredClone(this.profiles.get(userId) ?? null);
  }

  async setProfile(profile: Profile): Promise<Profile> {
    this.profiles.set(profile.userId, structuredClone(profile));
    return structuredClone(profile);
  }

  async getCredential(userId: string): Promise<Credential | null> {
    return structuredClone(this.credentials.get(userId) ?? null);
  }

  async setCredential(credential: Credential): Promise<Credential> {
    this.credentials.set(credential.userId, structuredClone(credential));
    return structuredClone(credential);
  }

  async getRelayQueueDepth(_relayId: string) {
    return 0;
  }

  async getRelayRetryCount(_relayId: string) {
    return 0;
  }

  async getRelayLastSuccessfulDelivery(_relayId: string) {
    return null;
  }

  async getRelayLastFailedDelivery(_relayId: string) {
    return null;
  }

  async getRelayDeadLetterCount(_relayId: string) {
    return 0;
  }
  async getCounter(key: string) {
    return this.counters.get(key)?.length ?? 0;
  }

  async incrementCounter(key: string, windowSeconds: number, amount = 1) {
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw new RangeError("Counter increment amount must be a positive safe integer");
    }
    const now = Date.now();
    const windowMilliseconds = windowSeconds * 1000;
    const timestamps = this.counters.get(key) ?? [];
    const filtered = [...timestamps, ...Array<number>(amount).fill(now)].filter(
      (timestamp) => now - timestamp <= windowMilliseconds,
    );
    this.counters.set(key, filtered);
    return filtered.length;
  }

  async acquireIdempotencyRecord(
    key: string,
    requestDigest: string,
    leaseMs: number,
  ): Promise<import("./repository").AcquireIdempotencyResult> {
    const existing = this.idempotency.get(key);
    const now = Date.now();

    if (existing) {
      if (existing.requestDigest !== requestDigest) {
        return { status: "conflict" };
      }

      if (existing.state === "completed") {
        return { status: "completed", record: structuredClone(existing) };
      }

      if (now < new Date(existing.recoveryExpiryAt).getTime()) {
        return { status: "in_progress" };
      }
    }

    this.idempotency.set(key, {
      state: "in_progress",
      requestDigest,
      createdAt: new Date(now).toISOString(),
      recoveryExpiryAt: new Date(now + leaseMs).toISOString(),
    });

    return { status: "acquired" };
  }

  async getIdempotencyRecord(key: string) {
    return structuredClone(this.idempotency.get(key) ?? null);
  }

  async setIdempotencyRecord(key: string, record: IdempotencyRecord) {
    this.idempotency.set(key, structuredClone(record));
  }

  // ---------------------------------------------------------------------------
  // Issue #1936 (BETA-029) — Encrypted envelope persistence
  // ---------------------------------------------------------------------------

  async getEnvelope(messageId: string): Promise<StoredEnvelope | null> {
    return structuredClone(this.envelopes.get(messageId) ?? null);
  }

  /**
   * Insert-only envelope persistence.
   *
   * Concurrency: the per-key promise chain (withEnvelopeLock) guarantees that
   * two concurrent inserts for the same messageId are serialized. No `await`
   * crosses the read-check-write boundary inside the lock body, so the
   * check-then-act is atomic within the single JS microtask.
   */
  async insertEnvelope(envelope: StoredEnvelope): Promise<InsertEnvelopeResult> {
    return this.withEnvelopeLock(envelope.messageId, async () => {
      const existing = this.envelopes.get(envelope.messageId);
      if (existing) {
        // Byte-equality check: serialize both to canonical JSON for comparison.
        const existingBytes = JSON.stringify(existing);
        const incomingBytes = JSON.stringify(envelope);
        if (existingBytes === incomingBytes) {
          return { outcome: "duplicate", envelope: structuredClone(existing) };
        }
        // Different payload — reject. The prior record is authoritative.
        return { outcome: "conflict" };
      }
      const stored = structuredClone(envelope);
      this.envelopes.set(envelope.messageId, stored);
      return { outcome: "inserted", envelope: structuredClone(stored) };
    });
  }

  reset() {
    this.policies.clear();
    this.postage.clear();
    this.receipts.clear();
    this.senderRules.clear();
    this.counters.clear();
    this.idempotency.clear();
    this.receiptLocks.clear();
    this.envelopes.clear();
    this.envelopeLocks.clear();
    this.usersById.clear();
    this.usersByEmail.clear();
    this.usersByUsername.clear();
    this.usersByAddress.clear();
    this.profiles.clear();
    this.credentials.clear();
    this.usernames.clear();
    this.usernameLocks.clear();
  }
}
