import type {
  ApiRepository,
  InsertEnvelopeResult,
  PostageTransitionResult,
  UpdateUserResult,
} from "./repository";
import type {
  Credential,
  ExternalWallet,
  ExternalWalletChallenge,
  IdempotencyRecord,
  KeyDirectoryRecord,
  MailboxPolicy,
  PolicyWriteIntent,
  Postage,
  PostageStatus,
  Profile,
  PublishedKey,
  Receipt,
  RetiredSession,
  SenderRule,
  Session,
  StoredEnvelope,
  User,
  VerificationPurpose,
  VerificationToken,
} from "./domain";
import { ApiError } from "./errors";

export class HybridApiRepository implements ApiRepository {
  constructor(
    private readonly kv: KVNamespace,
    private readonly coordinator: DurableObjectNamespace,
  ) {}

  private key(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(":")}`;
  }

  async getPolicy(owner: string): Promise<MailboxPolicy | null> {
    const policy = await this.kv.get(this.key("policy", owner), "json");
    return (policy as MailboxPolicy) ?? null;
  }

  async setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy> {
    await this.kv.put(this.key("policy", owner), JSON.stringify(policy));
    return policy;
  }

  async getPolicyWriteIntent(owner: string): Promise<PolicyWriteIntent | null> {
    const intent = await this.kv.get(this.key("policy-write", owner), "json");
    return (intent as PolicyWriteIntent) ?? null;
  }

  async setPolicyWriteIntent(intent: PolicyWriteIntent): Promise<PolicyWriteIntent> {
    await this.kv.put(this.key("policy-write", intent.owner), JSON.stringify(intent));
    return intent;
  }

  async getSenderRule(owner: string, sender: string): Promise<SenderRule> {
    const rule = await this.kv.get(this.key("sender-rule", owner, sender), "text");
    return (rule as SenderRule) ?? "default";
  }

  async setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule> {
    const ruleKey = this.key("sender-rule", owner, sender);
    if (rule === "default") {
      await this.kv.delete(ruleKey);
    } else {
      await this.kv.put(ruleKey, rule);
    }
    return rule;
  }

  async getPostage(messageId: string): Promise<Postage | null> {
    const postage = await this.kv.get(this.key("postage", messageId), "json");
    return (postage as Postage) ?? null;
  }

  async setPostage(postage: Postage): Promise<Postage> {
    await this.kv.put(this.key("postage", postage.messageId), JSON.stringify(postage));
    await this.getStub().setPostage(postage);
    return postage;
  }

  async transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult> {
    const result = await this.getStub().transitionPostage(messageId, expectedStatus, nextStatus);
    if (result.outcome === "applied") {
      await this.kv.put(this.key("postage", messageId), JSON.stringify(result.postage));
    }
    return result;
  }

  async insertPostage(postage: Postage): Promise<Postage> {
    const existing = await this.kv.get(this.key("postage", postage.messageId), "json");
    if (existing) {
      throw new ApiError(
        409,
        "conflict",
        `A postage record already exists for message ${postage.messageId}`,
      );
    }
    await this.kv.put(this.key("postage", postage.messageId), JSON.stringify(postage));
    return postage;
  }

  async getReceipt(messageId: string): Promise<Receipt | null> {
    const coordinatedReceipt = await this.getStub().getReceipt(messageId);
    if (coordinatedReceipt) return coordinatedReceipt;

    const receipt = await this.kv.get(this.key("receipt", messageId), "json");
    if (!receipt) return null;

    await this.getStub().setReceipt(receipt as Receipt);
    return receipt as Receipt;
  }

  async setReceipt(receipt: Receipt): Promise<Receipt> {
    await this.getStub().setReceipt(receipt);
    await this.kv.put(this.key("receipt", receipt.messageId), JSON.stringify(receipt));
    return receipt;
  }

  async createReceiptIfAbsent(receipt: Receipt): Promise<{ created: boolean; receipt: Receipt }> {
    const existing = await this.getReceipt(receipt.messageId);
    if (existing) return { created: false, receipt: existing };

    const result = await this.getStub().createReceiptIfAbsent(receipt);
    if (result.created) {
      await this.kv.put(
        this.key("receipt", result.receipt.messageId),
        JSON.stringify(result.receipt),
      );
    }
    return result;
  }

  async markReceiptRead(
    messageId: string,
    actor: string,
    now?: Date,
  ): Promise<import("./repository").MarkReceiptReadResult> {
    await this.getReceipt(messageId);
    const result = await this.getStub().markReceiptRead(messageId, actor, now);
    if (result.outcome === "marked") {
      await this.kv.put(
        this.key("receipt", result.receipt.messageId),
        JSON.stringify(result.receipt),
      );
    }
    return result;
  }

  // BETA-002: Durable User Account, Profile & Credential DO stubs
  async getUserById(userId: string): Promise<User | null> {
    return this.getStub().getUserById(userId);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.getStub().getUserByEmail(email);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.getStub().getUserByUsername(username);
  }

  async getUserByAddress(address: string): Promise<User | null> {
    return this.getStub().getUserByAddress(address);
  }

  async createUser(user: User, credential?: Credential, profile?: Profile): Promise<User> {
    return this.getStub().createUser(user, credential, profile);
  }

  async updateUser(user: User, expectedVersion: number): Promise<UpdateUserResult> {
    return this.getStub().updateUser(user, expectedVersion);
  }

  async getProfile(userId: string): Promise<Profile | null> {
    return this.getStub().getProfile(userId);
  }

  async setProfile(profile: Profile): Promise<Profile> {
    return this.getStub().setProfile(profile);
  }

  async getCredential(userId: string): Promise<Credential | null> {
    return this.getStub().getCredential(userId);
  }

  async setCredential(credential: Credential): Promise<Credential> {
    return this.getStub().setCredential(credential);
  }

  // BETA-005: Verification token lifecycle delegated to the Durable Object
  // so the single-winner transitions (issue/consume/attempt) execute under
  // the coordinator's per-key exclusive locks.
  async getVerificationToken(tokenHash: string): Promise<VerificationToken | null> {
    return this.getStub().getVerificationToken(tokenHash);
  }

  async getActiveVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationToken | null> {
    return this.getStub().getActiveVerificationToken(userId, purpose);
  }

  async issueVerificationToken(
    token: VerificationToken,
    now: Date,
  ): Promise<import("./repository").IssueVerificationTokenResult> {
    return this.getStub().issueVerificationToken(token, now);
  }

  async consumeVerificationToken(
    tokenHash: string,
    now: Date,
  ): Promise<import("./repository").ConsumeVerificationTokenResult> {
    return this.getStub().consumeVerificationToken(tokenHash, now);
  }

  async recordVerificationAttempt(
    tokenHash: string,
    now: Date,
  ): Promise<import("./repository").RecordVerificationAttemptResult> {
    return this.getStub().recordVerificationAttempt(tokenHash, now);
  }

  // BETA-006: Session DO stubs
  async getSession(sessionId: string): Promise<Session | null> {
    return this.getStub().getSession(sessionId);
  }

  async createSession(session: Session): Promise<Session> {
    return this.getStub().createSession(session);
  }

  async updateSession(session: Session): Promise<Session> {
    return this.getStub().updateSession(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    return this.getStub().deleteSession(sessionId);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    return this.getStub().deleteUserSessions(userId);
  }

  async getRetiredSession(sessionId: string): Promise<RetiredSession | null> {
    return this.getStub().getRetiredSession(sessionId);
  }

  async createRetiredSession(retiredSession: RetiredSession): Promise<RetiredSession> {
    return this.getStub().createRetiredSession(retiredSession);
  }

  // Consistent layer delegated to Durable Object via RPC
  private getStub() {
    const id = this.coordinator.idFromName("global-stealth-coordinator");
    return this.coordinator.get(id);
  }

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    return this.getStub().getIdempotencyRecord(key);
  }

  async acquireIdempotencyRecord(
    key: string,
    requestDigest: string,
    leaseMs: number,
  ): Promise<import("./repository").AcquireIdempotencyResult> {
    return this.getStub().acquireIdempotencyRecord(key, requestDigest, leaseMs);
  }

  async setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    await this.getStub().setIdempotencyRecord(key, record);
  }

  async getCounter(key: string): Promise<number> {
    return this.getStub().getCounter(key);
  }

  async incrementCounter(key: string, windowSeconds: number, amount = 1): Promise<number> {
    return this.getStub().incrementCounter(key, windowSeconds, amount);
  }

  async getRelayQueueDepth(_relayId: string): Promise<number> {
    return 0;
  }

  async getRelayRetryCount(_relayId: string): Promise<number> {
    return 0;
  }

  async getRelayLastSuccessfulDelivery(_relayId: string): Promise<string | null> {
    return null;
  }

  async getRelayLastFailedDelivery(_relayId: string): Promise<string | null> {
    return null;
  }

  async getRelayDeadLetterCount(_relayId: string): Promise<number> {
    return 0;
  }

  async getExternalWallets(owner: string): Promise<ExternalWallet[]> {
    const wallets = await this.kv.get(this.key("external-wallet", owner), "json");
    return (wallets as ExternalWallet[]) ?? [];
  }

  async setExternalWallet(owner: string, wallet: ExternalWallet): Promise<ExternalWallet> {
    const wallets = (await this.kv.get(this.key("external-wallet", owner), "json")) as
      | ExternalWallet[]
      | null;
    const existing = wallets ?? [];
    const idx = existing.findIndex((w) => w.address === wallet.address);
    if (idx >= 0) {
      existing[idx] = wallet;
    } else {
      existing.push(wallet);
    }
    await this.kv.put(this.key("external-wallet", owner), JSON.stringify(existing));
    await this.kv.put(this.key("external-wallet-address", wallet.address), owner);
    return wallet;
  }

  async removeExternalWallet(owner: string, address: string): Promise<void> {
    const wallets =
      ((await this.kv.get(this.key("external-wallet", owner), "json")) as
        | ExternalWallet[]
        | null) ?? [];
    await this.kv.put(
      this.key("external-wallet", owner),
      JSON.stringify(wallets.filter((w) => w.address !== address)),
    );
    await this.kv.delete(this.key("external-wallet-address", address));
  }

  async findExternalWalletOwner(address: string): Promise<string | null> {
    const owner = await this.kv.get(this.key("external-wallet-address", address), "text");
    return owner;
  }

  async getWalletChallenge(
    owner: string,
    address: string,
  ): Promise<ExternalWalletChallenge | null> {
    const challenge = await this.kv.get(this.key("wallet-challenge", owner, address), "json");
    return (challenge as ExternalWalletChallenge) ?? null;
  }

  async setWalletChallenge(
    owner: string,
    address: string,
    challenge: ExternalWalletChallenge,
  ): Promise<void> {
    await this.kv.put(this.key("wallet-challenge", owner, address), JSON.stringify(challenge));
  }

  async deleteWalletChallenge(owner: string, address: string): Promise<void> {
    await this.kv.delete(this.key("wallet-challenge", owner, address));
  }

  // ---------------------------------------------------------------------------
  // Issue #1936 (BETA-029) — Durable encrypted envelope persistence
  // ---------------------------------------------------------------------------

  /**
   * Reads from KV as the fast path, then falls back to the coordinator.
   * Plaintext is never stored; ciphertext + headers are retrieved as-is.
   */
  async getEnvelope(messageId: string): Promise<StoredEnvelope | null> {
    const kvResult = await this.kv.get(this.key("envelope", messageId), "json");
    if (kvResult) return kvResult as StoredEnvelope;

    // KV miss — the coordinator is the authoritative source.
    const coordResult = await this.getStub().getEnvelope(messageId);
    if (coordResult) {
      // Write-back to KV so subsequent reads hit the fast path.
      await this.kv.put(this.key("envelope", messageId), JSON.stringify(coordResult));
    }
    return coordResult;
  }

  /**
   * Delegates the atomic insert to the coordinator (the source of truth for
   * insert-once semantics), then mirrors a successful insert to KV for fast
   * subsequent reads. The coordinator's 409 conflict error propagates unchanged
   * to the caller — it is never swallowed.
   */
  async insertEnvelope(envelope: StoredEnvelope): Promise<InsertEnvelopeResult> {
    // The coordinator enforces byte-identical idempotency and conflict detection.
    const result = await this.getStub().insertEnvelope(envelope);
    if (result.outcome === "inserted" || result.outcome === "duplicate") {
      // Mirror to KV so getEnvelope hits the fast path on subsequent reads.
      await this.kv.put(this.key("envelope", envelope.messageId), JSON.stringify(result.envelope));
    }
    return result;
  }

  async listRecipientEnvelopes(
    recipient: string,
    options?: import("./repository").MailboxQueryOptions,
  ): Promise<import("./repository").Page<StoredEnvelope>> {
    return this.getStub().listRecipientEnvelopes(recipient, options);
  }

  async tombstoneEnvelope(messageId: string, recipient: string): Promise<StoredEnvelope> {
    const result = await this.getStub().tombstoneEnvelope(messageId, recipient);
    await this.kv.put(this.key("envelope", messageId), JSON.stringify(result));
    return result;
  }

  async updateEnvelopeStatus(
    messageId: string,
    status: import("./domain").MailboxItemStatus,
  ): Promise<StoredEnvelope> {
    const result = await this.getStub().updateEnvelopeStatus(messageId, status);
    await this.kv.put(this.key("envelope", messageId), JSON.stringify(result));
    return result;
  }

  // ---------------------------------------------------------------------------
  // Issue #1934 (BETA-027) — Versioned Public Encryption-Key Directory & Rotation
  // ---------------------------------------------------------------------------

  async getKeyDirectory(owner: string): Promise<KeyDirectoryRecord | null> {
    const dir = await this.kv.get(this.key("key-directory", owner.toUpperCase()), "json");
    return (dir as KeyDirectoryRecord) ?? null;
  }

  async getPublishedKey(owner: string, keyId: string): Promise<PublishedKey | null> {
    const key = await this.kv.get(this.key("keys", owner.toUpperCase(), keyId), "json");
    return (key as PublishedKey) ?? null;
  }

  async savePublishedKey(owner: string, publishedKey: PublishedKey): Promise<PublishedKey> {
    await this.kv.put(
      this.key("keys", owner.toUpperCase(), publishedKey.keyId),
      JSON.stringify(publishedKey),
    );
    return publishedKey;
  }

  async saveKeyDirectory(record: KeyDirectoryRecord): Promise<KeyDirectoryRecord> {
    await this.kv.put(
      this.key("key-directory", record.owner.toUpperCase()),
      JSON.stringify(record),
    );
    return record;
  }
}
