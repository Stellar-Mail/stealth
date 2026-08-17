import { AttachmentStorageService } from "@/services/storage/attachment-storage";
import type { MailboxPolicy, Postage, Receipt, SenderRule } from "./domain";
import type { ApiRepository } from "./repository";

function key(owner: string, sender: string) {
  return `${owner}:${sender}`;
}

function activeTokenKey(userId: string, purpose: string) {
  return `${userId}:${purpose}`;
}

export class MemoryApiRepository implements ApiRepository {
  private readonly policies = new Map<string, MailboxPolicy>();
  private readonly policyWriteIntents = new Map<string, PolicyWriteIntent>();
  private readonly postage = new Map<string, Postage>();
  private readonly receipts = new Map<string, Receipt>();
  private readonly senderRules = new Map<string, SenderRule>();
  private readonly counters = new Map<string, number[]>();
  private readonly attachmentStorage = new AttachmentStorageService();

  getAttachmentStorage(): AttachmentStorageService {
    return this.attachmentStorage;
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
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
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

  // BETA-005 Verification Token Lifecycle Implementation
  async getVerificationToken(tokenHash: string): Promise<VerificationToken | null> {
    return structuredClone(this.verificationTokens.get(tokenHash) ?? null);
  }

  async getActiveVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationToken | null> {
    const tokenHash = this.activeVerificationTokens.get(activeTokenKey(userId, purpose));
    if (!tokenHash) return null;
    return structuredClone(this.verificationTokens.get(tokenHash) ?? null);
  }

  async issueVerificationToken(
    token: VerificationToken,
    now: Date,
  ): Promise<IssueVerificationTokenResult> {
    return this.withVerificationLock(activeTokenKey(token.userId, token.purpose), async () => {
      if (this.verificationTokens.has(token.tokenHash)) {
        return {
          outcome: "conflict",
          token: structuredClone(this.verificationTokens.get(token.tokenHash)!),
        };
      }

      let replacedToken: VerificationToken | null = null;
      const activeHash = this.activeVerificationTokens.get(
        activeTokenKey(token.userId, token.purpose),
      );
      if (activeHash && activeHash !== token.tokenHash) {
        const current = this.verificationTokens.get(activeHash);
        if (current && current.consumedAt === null && current.replacedAt === null) {
          const invalidated: VerificationToken = {
            ...current,
            replacedAt: now.toISOString(),
            replacedByTokenHash: token.tokenHash,
          };
          this.verificationTokens.set(activeHash, invalidated);
          replacedToken = invalidated;
        }
      }

      const stored = structuredClone(token);
      this.verificationTokens.set(token.tokenHash, stored);
      this.activeVerificationTokens.set(
        activeTokenKey(token.userId, token.purpose),
        token.tokenHash,
      );
      return {
        outcome: "issued",
        token: structuredClone(stored),
        replacedToken: replacedToken ? structuredClone(replacedToken) : null,
      };
    });
  }

  async consumeVerificationToken(
    tokenHash: string,
    now: Date,
  ): Promise<ConsumeVerificationTokenResult> {
    return this.withVerificationLock(`token:${tokenHash}`, async () => {
      const current = this.verificationTokens.get(tokenHash);
      if (!current) {
        return { outcome: "not-found" };
      }
      if (current.consumedAt !== null) {
        return { outcome: "already-consumed", token: structuredClone(current) };
      }
      if (current.replacedAt !== null) {
        return { outcome: "replaced", token: structuredClone(current) };
      }
      if (current.attemptCount >= current.maxAttempts) {
        return { outcome: "brute-force-blocked", token: structuredClone(current) };
      }
      if (Date.parse(current.expiresAt) <= now.getTime()) {
        return { outcome: "expired", token: structuredClone(current) };
      }
      const consumed: VerificationToken = {
        ...current,
        consumedAt: now.toISOString(),
      };
      this.verificationTokens.set(tokenHash, consumed);
      return { outcome: "consumed", token: structuredClone(consumed) };
    });
  }

  async recordVerificationAttempt(
    tokenHash: string,
    now: Date,
  ): Promise<RecordVerificationAttemptResult> {
    return this.withVerificationLock(`token:${tokenHash}`, async () => {
      const current = this.verificationTokens.get(tokenHash);
      if (!current) {
        return { recorded: false, token: null };
      }
      if (current.consumedAt !== null || current.replacedAt !== null) {
        return { recorded: false, token: structuredClone(current) };
      }
      const updated: VerificationToken = {
        ...current,
        attemptCount: current.attemptCount + 1,
      };
      this.verificationTokens.set(tokenHash, updated);
      return { recorded: true, token: structuredClone(updated) };
    });
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

  async listRecipientEnvelopes(
    recipient: string,
    options: import("./repository").MailboxQueryOptions = {},
  ): Promise<import("./repository").Page<StoredEnvelope>> {
    const { paginate, PAGINATED_QUERY_ORDERINGS } = await import("./repository");
    const normRecipient = recipient.toUpperCase().trim();
    const statusFilter = options.status ?? "all";
    const includeTombstones = options.includeTombstones ?? false;
    const limit = options.limit ?? 25;

    const filtered: StoredEnvelope[] = [];
    for (const env of this.envelopes.values()) {
      if (env.recipientId.toUpperCase().trim() !== normRecipient) {
        continue;
      }
      const isDeleted = Boolean(env.deletedAt);
      if (isDeleted && !includeTombstones) {
        continue;
      }
      const itemStatus = env.status ?? "pending";
      if (statusFilter !== "all" && itemStatus !== statusFilter) {
        continue;
      }
      filtered.push(structuredClone(env));
    }

    const spec = PAGINATED_QUERY_ORDERINGS.listEnvelopes;
    return paginate(filtered, spec, { limit, after: options.after });
  }

  async tombstoneEnvelope(messageId: string, recipient: string): Promise<StoredEnvelope> {
    return this.withEnvelopeLock(messageId, async () => {
      const existing = this.envelopes.get(messageId);
      if (!existing) {
        throw new ApiError(404, "not_found", `No envelope found for message ${messageId}`);
      }
      if (existing.recipientId.toUpperCase().trim() !== recipient.toUpperCase().trim()) {
        throw new ApiError(
          403,
          "forbidden",
          "Cannot delete an envelope belonging to another recipient",
        );
      }
      const tombstoned: StoredEnvelope = {
        ...existing,
        deletedAt: new Date().toISOString(),
      };
      this.envelopes.set(messageId, tombstoned);
      return structuredClone(tombstoned);
    });
  }

  async updateEnvelopeStatus(
    messageId: string,
    status: import("./domain").MailboxItemStatus,
  ): Promise<StoredEnvelope> {
    return this.withEnvelopeLock(messageId, async () => {
      const existing = this.envelopes.get(messageId);
      if (!existing) {
        throw new ApiError(404, "not_found", `No envelope found for message ${messageId}`);
      }
      const updated: StoredEnvelope = {
        ...existing,
        status,
      };
      this.envelopes.set(messageId, updated);
      return structuredClone(updated);
    });
  }

  async getKeyDirectory(owner: string): Promise<KeyDirectoryRecord | null> {
    const dir = this.keyDirectories.get(owner.toUpperCase());
    return dir ? structuredClone(dir) : null;
  }

  async getPublishedKey(owner: string, keyId: string): Promise<PublishedKey | null> {
    const k = this.publishedKeys.get(`${owner.toUpperCase()}:${keyId}`);
    return k ? structuredClone(k) : null;
  }

  async savePublishedKey(owner: string, publishedKey: PublishedKey): Promise<PublishedKey> {
    const stored = structuredClone(publishedKey);
    this.publishedKeys.set(`${owner.toUpperCase()}:${publishedKey.keyId}`, stored);
    return structuredClone(stored);
  }

  async saveKeyDirectory(record: KeyDirectoryRecord): Promise<KeyDirectoryRecord> {
    const stored = structuredClone(record);
    this.keyDirectories.set(record.owner.toUpperCase(), stored);
    return structuredClone(stored);
  }

  reset() {
    this.policies.clear();
    this.policyWriteIntents.clear();
    this.postage.clear();
    this.receipts.clear();
    this.senderRules.clear();
    this.counters.clear();
    this.attachmentStorage.reset();
  }
}
