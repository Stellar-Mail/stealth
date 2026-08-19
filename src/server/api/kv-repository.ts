import type {
  ApiRepository,
  ContactQueryOptions,
  InsertEnvelopeResult,
  PostageTransitionResult,
  UpdateContactResult,
  UpdateProvisioningResult,
  UpdateUserResult,
  UsernameReservationResult,
  WalletCreationResult,
} from "./repository";
import type {
  Contact,
  Credential,
  DeadLetter,
  DeadLetterStatus,
  DurableJob,
  DurableJobType,
  ExternalWallet,
  ExternalWalletChallenge,
  IdempotencyRecord,
  JobStatus,
  KeyDirectoryRecord,
  MailboxPolicy,
  MessageDeliveryStatusRecord,
  PolicyWriteIntent,
  Postage,
  PostageStatus,
  Profile,
  ProvisioningRecord,
  PublishedKey,
  Receipt,
  ReceiptCheckpoint,
  RetiredSession,
  SenderRule,
  Session,
  StoredEnvelope,
  User,
  UsernameReservation,
  VerificationPurpose,
  VerificationToken,
  ManagedWalletRecord,
  FundingOperation,
  Wallet,
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

  async getMessageDeliveryStatus(messageId: string): Promise<MessageDeliveryStatusRecord | null> {
    const record = await this.kv.get(this.key("delivery-status", messageId), "json");
    return (record as MessageDeliveryStatusRecord) ?? null;
  }

  async setMessageDeliveryStatus(
    record: MessageDeliveryStatusRecord,
  ): Promise<MessageDeliveryStatusRecord> {
    await this.kv.put(this.key("delivery-status", record.messageId), JSON.stringify(record));
    return record;
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

  // BETA-014: Provisioning state is coordinated by the DO (single authority);
  // KV holds no provisioning mirror because every write is a CAS transition.
  async getProvisioningRecord(userId: string): Promise<ProvisioningRecord | null> {
    return this.getStub().getProvisioningRecord(userId);
  }

  async createProvisioningRecord(
    record: ProvisioningRecord,
  ): Promise<{ created: boolean; record: ProvisioningRecord }> {
    return this.getStub().createProvisioningRecord(record);
  }

  async setProvisioningRecord(
    record: ProvisioningRecord,
    expectedVersion: number,
  ): Promise<UpdateProvisioningResult> {
    return this.getStub().setProvisioningRecord(record, expectedVersion);
  }

  async reserveUsername(
    username: string,
    userId: string,
    leaseMs: number,
  ): Promise<UsernameReservationResult> {
    return this.getStub().reserveUsername(username, userId, leaseMs);
  }

  async getUsernameReservation(username: string): Promise<UsernameReservation | null> {
    return this.getStub().getUsernameReservation(username);
  }

  async releaseUsernameReservation(username: string, userId: string): Promise<boolean> {
    return this.getStub().releaseUsernameReservation(username, userId);
  }

  async getWallet(userId: string): Promise<Wallet | null> {
    return this.getStub().getWallet(userId);
  }

  async createWallet(wallet: Wallet): Promise<WalletCreationResult> {
    return this.getStub().createWallet(wallet);
  }

  async initializePolicyIfAbsent(
    owner: string,
    policy: MailboxPolicy,
  ): Promise<{ created: boolean; policy: MailboxPolicy }> {
    const result = await this.getStub().initializePolicyIfAbsent(owner, policy);
    if (result.created) {
      await this.kv.put(this.key("policy", owner), JSON.stringify(result.policy));
    }
    return result;
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
  getSenderRequest(requestId: string) {
    return this.getStub().getSenderRequest(requestId);
  }
  listSenderRequests(recipient: string, status?: "pending") {
    return this.getStub().listSenderRequests(recipient, status);
  }
  createSenderRequestIfAbsent(request: import("./domain").UnknownSenderRequest) {
    return this.getStub().createSenderRequestIfAbsent(request);
  }
  transitionSenderRequest(
    requestId: string,
    recipient: string,
    decision: import("./domain").UnknownSenderDecision,
    now?: Date,
  ) {
    return this.getStub().transitionSenderRequest(requestId, recipient, decision, now);
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

  async getManagedWallet(userId: string): Promise<ManagedWalletRecord | null> {
    return this.getStub().getManagedWallet(userId);
  }

  async setManagedWallet(wallet: ManagedWalletRecord): Promise<ManagedWalletRecord> {
    return this.getStub().setManagedWallet(wallet);
  }

  async createManagedWalletIfAbsent(
    wallet: ManagedWalletRecord,
  ): Promise<import("./repository").CreateManagedWalletResult> {
    return this.getStub().createManagedWalletIfAbsent(wallet);
  }

  async getFundingOperation(operationId: string): Promise<FundingOperation | null> {
    return this.getStub().getFundingOperation(operationId);
  }

  async setFundingOperation(operation: FundingOperation): Promise<FundingOperation> {
    return this.getStub().setFundingOperation(operation);
  }

  async createFundingOperationIfAbsent(
    operation: FundingOperation,
  ): Promise<{ created: boolean; operation: FundingOperation }> {
    return this.getStub().createFundingOperationIfAbsent(operation);
  }

  async listFundingOperations(filter?: {
    status?: FundingOperation["status"];
    limit?: number;
  }): Promise<FundingOperation[]> {
    return this.getStub().listFundingOperations(filter);
  }

  // ---------------------------------------------------------------------------
  // Issue #1973 (BETA-066) — Live contacts CRUD
  //
  // Each owner stores a JSON array of contacts under a single key (the same
  // shape as the external-wallet collection) so list/get/update/delete and
  // search all resolve in one KV read without coordinator round-trips.
  // ---------------------------------------------------------------------------

  private contactKey(owner: string): string {
    return this.key("contacts", owner.toUpperCase().trim());
  }

  private async readContacts(owner: string): Promise<Contact[]> {
    const stored = await this.kv.get(this.contactKey(owner), "json");
    return (stored as Contact[]) ?? [];
  }

  async listContacts(
    owner: string,
    options: ContactQueryOptions = {},
  ): Promise<import("./repository").Page<Contact>> {
    const { paginate, PAGINATED_QUERY_ORDERINGS } = await import("./repository");
    const normOwner = owner.toUpperCase().trim();
    const limit = options.limit ?? 25;
    const query = options.query?.trim().toLowerCase();

    const stored = await this.readContacts(normOwner);
    const filtered: Contact[] = [];
    for (const contact of stored) {
      if (contact.owner.toUpperCase().trim() !== normOwner) {
        continue;
      }
      if (query) {
        const haystack =
          `${contact.name} ${contact.address} ${contact.canonicalAddress ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) {
          continue;
        }
      }
      filtered.push(contact);
    }

    const spec = PAGINATED_QUERY_ORDERINGS.listContacts;
    return paginate(filtered, spec, { limit, after: options.after });
  }

  async getContact(owner: string, contactId: string): Promise<Contact | null> {
    const contacts = await this.readContacts(owner);
    return contacts.find((c) => c.contactId === contactId) ?? null;
  }

  async createContact(contact: Contact): Promise<Contact> {
    const normOwner = contact.owner.toUpperCase().trim();
    const contacts = await this.readContacts(normOwner);
    if (contacts.some((c) => c.contactId === contact.contactId)) {
      throw new ApiError(409, "conflict", `A contact already exists for ${contact.contactId}`);
    }
    contacts.push(contact);
    await this.kv.put(this.contactKey(normOwner), JSON.stringify(contacts));
    return contact;
  }

  async updateContact(contact: Contact, expectedVersion: number): Promise<UpdateContactResult> {
    const normOwner = contact.owner.toUpperCase().trim();
    const contacts = await this.readContacts(normOwner);
    const index = contacts.findIndex((c) => c.contactId === contact.contactId);
    if (index < 0) {
      return { updated: false, current: null };
    }
    const existing = contacts[index];
    if (existing.version !== expectedVersion) {
      return { updated: false, current: existing };
    }
    const updated = { ...contact, version: expectedVersion + 1 };
    contacts[index] = updated;
    await this.kv.put(this.contactKey(normOwner), JSON.stringify(contacts));
    return { updated: true, contact: updated };
  }

  async deleteContact(owner: string, contactId: string): Promise<void> {
    const normOwner = owner.toUpperCase().trim();
    const contacts = await this.readContacts(normOwner);
    const index = contacts.findIndex((c) => c.contactId === contactId);
    if (index < 0) {
      throw new ApiError(404, "not_found", `No contact found for ${contactId}`);
    }
    contacts.splice(index, 1);
    await this.kv.put(this.contactKey(normOwner), JSON.stringify(contacts));
  }

  // ---------------------------------------------------------------------------
  // Issue #1952 (BETA-045) — Durable jobs, retries, DLQ, and receipt indexing
  // ---------------------------------------------------------------------------

  async enqueueJob(job: DurableJob): Promise<{ enqueued: boolean; job: DurableJob }> {
    return this.getStub().enqueueJob(job);
  }

  async getJob(jobId: string): Promise<DurableJob | null> {
    return this.getStub().getJob(jobId);
  }

  async getJobByIdempotencyKey(key: string): Promise<DurableJob | null> {
    return this.getStub().getJobByIdempotencyKey(key);
  }

  async updateJob(job: DurableJob): Promise<DurableJob> {
    return this.getStub().updateJob(job);
  }

  async claimNextPendingJob(types?: DurableJobType[], now?: Date): Promise<DurableJob | null> {
    return this.getStub().claimNextPendingJob(types, now);
  }

  async listJobs(filter?: {
    type?: DurableJobType;
    status?: JobStatus;
    limit?: number;
  }): Promise<DurableJob[]> {
    return this.getStub().listJobs(filter);
  }

  async createDeadLetter(deadLetter: DeadLetter): Promise<DeadLetter> {
    return this.getStub().createDeadLetter(deadLetter);
  }

  async getDeadLetter(deadLetterId: string): Promise<DeadLetter | null> {
    return this.getStub().getDeadLetter(deadLetterId);
  }

  async listDeadLetters(filter?: {
    jobType?: DurableJobType;
    status?: DeadLetterStatus;
    limit?: number;
  }): Promise<DeadLetter[]> {
    return this.getStub().listDeadLetters(filter);
  }

  async updateDeadLetter(deadLetter: DeadLetter): Promise<DeadLetter> {
    return this.getStub().updateDeadLetter(deadLetter);
  }

  async getReceiptCheckpoint(streamId: string): Promise<ReceiptCheckpoint | null> {
    return this.getStub().getReceiptCheckpoint(streamId);
  }

  async setReceiptCheckpoint(checkpoint: ReceiptCheckpoint): Promise<ReceiptCheckpoint> {
    return this.getStub().setReceiptCheckpoint(checkpoint);
  }

  async getSendOperation(messageId: string): Promise<import("./domain").SendOperationState | null> {
    return this.getStub().getSendOperation(messageId);
  }

  async setSendOperation(
    state: import("./domain").SendOperationState,
  ): Promise<import("./domain").SendOperationState> {
    return this.getStub().setSendOperation(state);
  }

  async createSendOperationIfAbsent(
    state: import("./domain").SendOperationState,
  ): Promise<{ created: boolean; state: import("./domain").SendOperationState }> {
    return this.getStub().createSendOperationIfAbsent(state);
  }
}
