import type {
  Credential,
  ExternalWallet,
  ExternalWalletChallenge,
  IdempotencyRecord,
  MailboxPolicy,
  PolicyWriteIntent,
  Postage,
  PostageStatus,
  Profile,
  Receipt,
  RetiredSession,
  SenderRule,
  SenderRuleRecord,
  SenderRuleWriteIntent,
  Session,
  StoredEnvelope,
  User,
} from "./domain";
import type {
  ApiRepository,
  CompareSetSenderRuleResult,
  InsertEnvelopeResult,
  PostageTransitionResult,
  SenderRuleEntry,
  UpdateUserResult,
} from "./repository";
import { ApiError } from "./errors";

function key(owner: string, sender: string) {
  return `${owner}:${sender}`;
}

export class MemoryApiRepository implements ApiRepository {
  private readonly policies = new Map<string, MailboxPolicy>();
  private readonly policyWriteIntents = new Map<string, PolicyWriteIntent>();
  private readonly postage = new Map<string, Postage>();
  private readonly receipts = new Map<string, Receipt>();
  private readonly senderRuleRecords = new Map<string, SenderRuleRecord>();
  private readonly senderRuleWriteIntents = new Map<string, SenderRuleWriteIntent>();
  private readonly counters = new Map<string, number[]>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly externalWallets = new Map<string, ExternalWallet[]>();
  private readonly walletChallenges = new Map<string, ExternalWalletChallenge>();
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

  // BETA-006: Session storage
  private readonly sessions = new Map<string, Session>();
  private readonly retiredSessions = new Map<string, RetiredSession>();

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

  async getPolicy(owner: string) {
    return structuredClone(this.policies.get(owner) ?? null);
  }

  async setPolicy(owner: string, policy: MailboxPolicy) {
    this.policies.set(owner, structuredClone(policy));
    return structuredClone(policy);
  }

  async getPolicyWriteIntent(owner: string) {
    return structuredClone(this.policyWriteIntents.get(owner) ?? null);
  }

  async setPolicyWriteIntent(intent: PolicyWriteIntent) {
    this.policyWriteIntents.set(intent.owner, structuredClone(intent));
    return structuredClone(intent);
  }

  async getSenderRule(owner: string, sender: string) {
    const record = await this.getSenderRuleRecord(owner, sender);
    return record?.rule ?? "default";
  }

  async setSenderRule(owner: string, sender: string, rule: SenderRule) {
    const result = await this.compareAndSetSenderRule(owner, sender, rule);
    if (result.outcome === "conflict") {
      throw new ApiError(409, "conflict", "Sender rule version conflict");
    }
    return rule;
  }

  async getSenderRuleRecord(owner: string, sender: string): Promise<SenderRuleRecord | null> {
    return structuredClone(this.senderRuleRecords.get(key(owner, sender)) ?? null);
  }

  async compareAndSetSenderRule(
    owner: string,
    sender: string,
    rule: SenderRule,
    expectedVersion?: number,
    now = new Date(),
  ): Promise<CompareSetSenderRuleResult> {
    const ruleKey = key(owner, sender);
    const current = this.senderRuleRecords.get(ruleKey) ?? null;

    if (expectedVersion !== undefined) {
      const actualVersion = current?.version ?? 0;
      if (actualVersion !== expectedVersion) {
        return { outcome: "conflict", current: structuredClone(current) };
      }
    }

    if (rule === "default") {
      this.senderRuleRecords.delete(ruleKey);
      return {
        outcome: "applied",
        record: {
          rule: "default",
          version: (current?.version ?? 0) + 1,
          updatedAt: now.toISOString(),
        },
      };
    }

    const record: SenderRuleRecord = {
      rule,
      version: (current?.version ?? 0) + 1,
      updatedAt: now.toISOString(),
    };
    this.senderRuleRecords.set(ruleKey, structuredClone(record));
    return { outcome: "applied", record: structuredClone(record) };
  }

  async listSenderRuleRecords(owner: string): Promise<SenderRuleEntry[]> {
    const prefix = `${owner}:`;
    const entries: SenderRuleEntry[] = [];
    for (const [compound, record] of this.senderRuleRecords.entries()) {
      if (!compound.startsWith(prefix)) continue;
      if (record.rule === "default") continue;
      entries.push({
        sender: compound.slice(prefix.length),
        record: structuredClone(record),
      });
    }
    return entries.sort((left, right) => left.sender.localeCompare(right.sender));
  }

  async getSenderRuleWriteIntent(
    owner: string,
    sender: string,
  ): Promise<SenderRuleWriteIntent | null> {
    return structuredClone(this.senderRuleWriteIntents.get(key(owner, sender)) ?? null);
  }

  async setSenderRuleWriteIntent(intent: SenderRuleWriteIntent): Promise<SenderRuleWriteIntent> {
    this.senderRuleWriteIntents.set(key(intent.owner, intent.sender), structuredClone(intent));
    return structuredClone(intent);
  }

  async listSenderRuleWriteIntents(owner: string): Promise<SenderRuleWriteIntent[]> {
    const prefix = `${owner}:`;
    const intents: SenderRuleWriteIntent[] = [];
    for (const [compound, intent] of this.senderRuleWriteIntents.entries()) {
      if (compound.startsWith(prefix)) {
        intents.push(structuredClone(intent));
      }
    }
    return intents.sort((left, right) => left.sender.localeCompare(right.sender));
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

  // BETA-006: Session CRUD Methods
  async getSession(sessionId: string): Promise<Session | null> {
    return structuredClone(this.sessions.get(sessionId) ?? null);
  }

  async createSession(session: Session): Promise<Session> {
    this.sessions.set(session.sessionId, structuredClone(session));
    return structuredClone(session);
  }

  async updateSession(session: Session): Promise<Session> {
    this.sessions.set(session.sessionId, structuredClone(session));
    return structuredClone(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    for (const [id, sess] of Array.from(this.sessions.entries())) {
      if (sess.userId === userId) {
        this.sessions.delete(id);
      }
    }
  }

  async getRetiredSession(sessionId: string): Promise<RetiredSession | null> {
    return structuredClone(this.retiredSessions.get(sessionId) ?? null);
  }

  async createRetiredSession(retiredSession: RetiredSession): Promise<RetiredSession> {
    this.retiredSessions.set(retiredSession.sessionId, structuredClone(retiredSession));
    return structuredClone(retiredSession);
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

  async getExternalWallets(owner: string): Promise<ExternalWallet[]> {
    return structuredClone(this.externalWallets.get(owner) ?? []);
  }

  async setExternalWallet(owner: string, wallet: ExternalWallet): Promise<ExternalWallet> {
    const wallets = this.externalWallets.get(owner) ?? [];
    const existing = wallets.findIndex((w) => w.address === wallet.address);
    if (existing >= 0) {
      wallets[existing] = structuredClone(wallet);
    } else {
      wallets.push(structuredClone(wallet));
    }
    this.externalWallets.set(owner, wallets);
    return structuredClone(wallet);
  }

  async removeExternalWallet(owner: string, address: string): Promise<void> {
    const wallets = this.externalWallets.get(owner) ?? [];
    this.externalWallets.set(
      owner,
      wallets.filter((w) => w.address !== address),
    );
  }

  async findExternalWalletOwner(address: string): Promise<string | null> {
    for (const [owner, wallets] of this.externalWallets.entries()) {
      if (wallets.some((w) => w.address === address)) {
        return owner;
      }
    }
    return null;
  }

  walletChallengeKey(owner: string, address: string) {
    return `${owner}:${address}`;
  }

  async getWalletChallenge(
    owner: string,
    address: string,
  ): Promise<ExternalWalletChallenge | null> {
    return structuredClone(
      this.walletChallenges.get(this.walletChallengeKey(owner, address)) ?? null,
    );
  }

  async setWalletChallenge(
    owner: string,
    address: string,
    challenge: ExternalWalletChallenge,
  ): Promise<void> {
    this.walletChallenges.set(this.walletChallengeKey(owner, address), structuredClone(challenge));
  }

  async deleteWalletChallenge(owner: string, address: string): Promise<void> {
    this.walletChallenges.delete(this.walletChallengeKey(owner, address));
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
    this.policyWriteIntents.clear();
    this.postage.clear();
    this.receipts.clear();
    this.senderRuleRecords.clear();
    this.senderRuleWriteIntents.clear();
    this.counters.clear();
    this.idempotency.clear();
    this.externalWallets.clear();
    this.walletChallenges.clear();
    this.receiptLocks.clear();
    this.envelopes.clear();
    this.envelopeLocks.clear();
    this.usersById.clear();
    this.usersByEmail.clear();
    this.usersByUsername.clear();
    this.usersByAddress.clear();
    this.profiles.clear();
    this.credentials.clear();
    this.sessions.clear();
  }
}
