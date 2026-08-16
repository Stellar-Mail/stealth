import type {
  ApiRepository,
  InsertEnvelopeResult,
  PostageTransitionResult,
  ReserveUsernameResult,
  UpdateUserResult,
} from "./repository";
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

  // Reservation uniqueness is authoritative in the coordinator (see
  // StealthCoordinator.reserveUsernameIfAbsent); KV is mirrored on success
  // purely as a fast-read cache, mirroring the receipt read/write pattern.
  async getUsernameRecord(username: string): Promise<UsernameRecord | null> {
    const coordinated = await this.getStub().getUsernameRecord(username);
    if (coordinated) return coordinated;

    const record = await this.kv.get(this.key("username", username), "json");
    if (!record) return null;

    return record as UsernameRecord;
  }

  async reserveUsernameIfAbsent(record: UsernameRecord): Promise<ReserveUsernameResult> {
    const result = await this.getStub().reserveUsernameIfAbsent(record);
    if (result.outcome === "reserved") {
      await this.kv.put(this.key("username", record.username), JSON.stringify(result.record));
    }
    return result;
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
}
