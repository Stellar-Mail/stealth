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
  LifecycleAnchor,
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
  RecoveryCodeSet,
  RetiredSession,
  SenderRule,
  SenderRuleAction,
  SenderRuleRecord,
  SenderRuleWriteIntent,
  Session,
  StoredEnvelope,
  MailboxFlagsPatch,
  UnknownSenderDecision,
  UnknownSenderRequest,
  User,
  UsernameReservation,
  VerificationPurpose,
  VerificationToken,
  ManagedWalletRecord,
  FundingOperation,
  Wallet,
  DraftRecord,
  OnboardingDraftRecord,
  AccountDeletionRequest,
  AccountExport,
  Invite,
  FeedbackCategory,
  FeedbackReport,
  FeedbackStatus,
  FeedbackSubmitInput,
} from "./domain";
import type { ZodSchema } from "zod";
import { ApiError, DataIntegrityError, RetryExhaustedError } from "./errors";

/**
 * Outcome of a compare-and-swap draft write (Issue #1965 BETA-058).
 *
 * - `updated: true`  : the draft was persisted at `expectedVersion + 1`.
 * - `updated: false` : the draft was updated concurrently (or not found);
 *   `current` reflects the authoritative state for reconciliation.
 */
export type UpdateDraftResult =
  | { updated: true; draft: DraftRecord }
  | { updated: false; current: DraftRecord | null };

export interface DraftQueryOptions {
  limit?: number;
  after?: string;
}

/**
 * Outcome of an insert-only encrypted envelope persistence operation.
 *
 * - "inserted" : the record was stored for the first time; it is now durable.
 * - "duplicate": a byte-identical envelope is already durably stored under this
 *                messageId. Safe to treat as a successful write (idempotent).
 * - "conflict" : a record with the same messageId already exists with *different*
 *                payload bytes. The prior record wins; this insert is rejected.
 */
export type InsertEnvelopeResult =
  | { outcome: "inserted"; envelope: StoredEnvelope }
  | { outcome: "duplicate"; envelope: StoredEnvelope }
  | { outcome: "conflict" };

/**
 * Outcome of an atomic compare-and-swap postage state transition.
 *
 * - "not-found": no postage record exists for the given messageId.
 * - "conflict": the postage exists but its current status did not match the
 *   expected status, so no transition was applied. `postage` reflects the
 *   actual current record so callers can build a deterministic error.
 * - "applied": the transition was applied atomically. `postage` reflects the
 *   updated record.
 */
export type PostageTransitionResult =
  | { outcome: "not-found" }
  | { outcome: "conflict"; postage: Postage }
  | { outcome: "applied"; postage: Postage };

export type AcquireIdempotencyResult =
  | { status: "acquired" }
  | { status: "in_progress" }
  | { status: "completed"; record: IdempotencyRecord & { state: "completed" } }
  /**
   * A record already exists for this actor/method/route/key, but it was
   * created for a request with a different canonical body digest. Issue
   * #1498: reusing an idempotency key for a different payload must never
   * block behind, or replay the response of, an unrelated request.
   */
  | { status: "conflict" };

/**
 * Outcome of a compare-and-swap write to the account's recovery code set.
 *
 * Issue #1917 (BETA-010): recovery codes are single-use secrets; redemption
 * and regeneration must never lose an update to a racing writer. `expectedVersion`
 * is the version observed on the read that preceded this write:
 *
 * - `expectedVersion === 0` is a create-only reservation: it succeeds only when
 *   no set exists yet, and reports `current` (never the caller's new set) when
 *   another generation won.
 * - `expectedVersion >= 1` is a strict compare-and-swap against the stored
 *   version. A mismatch reports `current` so the caller can re-read and retry
 *   (or fail) deterministically; a match bumps the stored version by 1.
 */
export type UpdateRecoveryCodeSetResult =
  | { updated: true; set: RecoveryCodeSet }
  | { updated: false; current: RecoveryCodeSet | null };

/**
 * Outcome of an atomic read-receipt publication.
 *
 * - "not-found": no receipt record exists for the given messageId.
 * - "forbidden": the requesting actor is not a participant in the receipt
 *   (neither sender nor recipient). The read state is never modified.
 * - "already-read": the receipt was already marked as read on a prior call.
 *   `readAt` reflects the original timestamp recorded on the first valid
 *   transition, enabling callers to surface deterministic 409 responses
 *   without a separate read round-trip.
 * - "marked": the read timestamp was set atomically for the first time.
 *   `receipt` reflects the updated record.
 *
 * ## Duplicate-call policy
 *
 * The first caller that observes `readAt === null` wins; every subsequent
 * call receives `{ outcome: "already-read", readAt }`. This is a
 * first-write-wins, idempotent-read policy: the stored timestamp is
 * authoritative and is never overwritten.
 */
export type MarkReceiptReadResult =
  | { outcome: "not-found" }
  | { outcome: "forbidden" }
  | { outcome: "already-read"; readAt: string }
  | { outcome: "marked"; receipt: Receipt };

export type UpdateUserResult =
  | { updated: true; user: User }
  | { updated: false; current: User | null };
export type CreateSenderRequestResult = { created: boolean; request: UnknownSenderRequest };
export type SenderRequestTransitionResult =
  | { outcome: "not_found" }
  | { outcome: "conflict"; request: UnknownSenderRequest }
  | { outcome: "applied"; request: UnknownSenderRequest };

/**
 * Outcome of a compare-and-swap contact write (Issue #1973 BETA-066).
 *
 * - `updated: true`  : the contact was persisted at `expectedVersion + 1`.
 * - `updated: false` : the contact moved underneath this writer (or does not
 *   exist); `current` reflects the authoritative state so the caller can
 *   re-read and reconcile instead of blindly overwriting.
 */
export type UpdateContactResult =
  | { updated: true; contact: Contact }
  | { updated: false; current: Contact | null };

// ---------------------------------------------------------------------------
// BETA-014: Account-provisioning repository contracts
// ---------------------------------------------------------------------------

/**
 * Outcome of a compare-and-swap provisioning-record write.
 *
 * - `updated: true`  : the record was persisted at `expectedVersion + 1`.
 * - `updated: false` : the record moved underneath this writer (or does not
 *   exist); `current` reflects the authoritative state so the caller can
 *   re-read and reconcile instead of blindly overwriting progress.
 */
export type UpdateProvisioningResult =
  | { updated: true; record: ProvisioningRecord }
  | { updated: false; current: ProvisioningRecord | null };

/**
 * Outcome of an atomic username claim.
 *
 * - "reserved": the username was claimed by this user for `leaseMs`.
 * - "already-reserved": this user holds a live claim already (idempotent
 *   retry); the existing reservation is returned unchanged.
 * - "unavailable": a live claim is held by another user, or a user record
 *   is already bound to this username. The claim is never stolen.
 */
export type UsernameReservationResult =
  | { outcome: "reserved"; reservation: UsernameReservation }
  | { outcome: "already-reserved"; reservation: UsernameReservation }
  | { outcome: "unavailable" };

/**
 * Outcome of an insert-once wallet write for a user.
 *
 * - "created": the wallet record was stored for the first time.
 * - "already-exists": this user already has a wallet; the stored record is
 *   returned unchanged (idempotent retry).
 */
export type WalletCreationResult =
  | { outcome: "created"; wallet: Wallet }
  | { outcome: "already-exists"; wallet: Wallet };

export type IssueVerificationTokenResult =
  | {
      outcome: "issued";
      token: VerificationToken;
      replacedToken: VerificationToken | null;
    }
  | { outcome: "conflict"; token: VerificationToken };

export type ConsumeVerificationTokenResult =
  | { outcome: "not-found" }
  | { outcome: "already-consumed"; token: VerificationToken }
  | { outcome: "replaced"; token: VerificationToken }
  | { outcome: "brute-force-blocked"; token: VerificationToken }
  | { outcome: "expired"; token: VerificationToken }
  | { outcome: "consumed"; token: VerificationToken };

export type RecordVerificationAttemptResult =
  | { recorded: false; token: VerificationToken | null }
  | { recorded: true; token: VerificationToken };

export interface MailboxQueryOptions {
  status?: "pending" | "delivered" | "all";
  includeTombstones?: boolean;
  limit?: number;
  after?: string;
}

/**
 * Options for searching a user's mailbox across safe metadata.
 * Issue #1972 (BETA-065).
 */
export interface SearchMailboxQueryOptions {
  query?: string;
  folder?: string;
  unread?: boolean;
  starred?: boolean;
  hasAttachments?: boolean;
  sender?: string;
  recipient?: string;
  afterDate?: string;
  beforeDate?: string;
  includeDeleted?: boolean;
  limit?: number;
  after?: string;
}

/**
 * Outcome of an atomic managed-wallet create.
 *
 * - "created": a new managed wallet record was stored for the user.
 * - "existing": a wallet already existed; the stored record is returned unchanged.
 */
export type CreateManagedWalletResult =
  | { outcome: "created"; wallet: ManagedWalletRecord }
  | { outcome: "existing"; wallet: ManagedWalletRecord };

// ---------------------------------------------------------------------------
// Issue #1973 (BETA-066) — Live contacts repository
// ---------------------------------------------------------------------------

/**
 * Options for listing a user's contacts. `query` filters case-insensitively
 * against the contact name and raw address; `limit`/`after` walk the declared
 * total order ({@link PAGINATED_QUERY_ORDERINGS}.listContacts).
 */
export interface ContactQueryOptions {
  query?: string;
  limit?: number;
  after?: string;
}

export type CompareSetSenderRuleResult =
  | { outcome: "applied"; record: SenderRuleRecord }
  | { outcome: "conflict"; current: SenderRuleRecord | null };

/** Atomic create/update input for versioned sender rule records (BETA-037). */
export interface CompareSetSenderRuleRecordInput {
  owner: string;
  sender: string;
  rule: SenderRuleAction;
  pricePayload?: { minimumPostage: string };
  idempotencyKey?: string;
}

export interface ApiRepository {
  getPolicy(owner: string): Promise<MailboxPolicy | null>;
  setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy>;
  // BETA-023 (Issue #1930): durable scheduled-write intent for the Policies
  // contract. The off-chain policy and the intent are written together during
  // provisioning so a retry never re-submits (and never re-bumps the on-chain
  // version) for an already-scheduled policy.
  getPolicyWriteIntent(owner: string): Promise<PolicyWriteIntent | null>;
  setPolicyWriteIntent(intent: PolicyWriteIntent): Promise<PolicyWriteIntent>;
  // BETA-043 (Issue #1950): durable anchor record for the on-chain Lifecycle
  // contract. Read back during sync/reconciliation so a retry never re-anchors
  // an already-confirmed commitment; writes are idempotent per messageId.
  getLifecycleAnchor(messageId: string): Promise<LifecycleAnchor | null>;
  setLifecycleAnchor(anchor: LifecycleAnchor): Promise<LifecycleAnchor>;
  getSenderRule(owner: string, sender: string): Promise<SenderRule>;
  setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule>;
  // BETA-037 (Issue #1944): versioned sender rule records with chain reconciliation
  getSenderRuleRecord(owner: string, sender: string): Promise<SenderRuleRecord | null>;
  setSenderRuleRecord(record: SenderRuleRecord): Promise<SenderRuleRecord>;
  deleteSenderRuleRecord(owner: string, sender: string): Promise<boolean>;
  listSenderRuleRecords(
    owner: string,
    options?: { limit?: number; after?: string },
  ): Promise<{ records: SenderRuleRecord[]; nextCursor?: string }>;
  compareAndSetSenderRule(
    owner: string,
    sender: string,
    rule: SenderRule,
    expectedVersion?: number,
    now?: Date,
  ): Promise<CompareSetSenderRuleResult>;
  compareAndSetSenderRuleRecord(
    input: CompareSetSenderRuleRecordInput,
    expectedVersion?: number,
    now?: Date,
  ): Promise<CompareSetSenderRuleResult>;
  getSenderRuleWriteIntent(owner: string, sender: string): Promise<SenderRuleWriteIntent | null>;
  setSenderRuleWriteIntent(intent: SenderRuleWriteIntent): Promise<SenderRuleWriteIntent>;
  listSenderRuleWriteIntents(owner: string): Promise<SenderRuleWriteIntent[]>;
  getPostage(messageId: string): Promise<Postage | null>;
  setPostage(postage: Postage): Promise<Postage>;
  /**
   * Atomically transitions a postage record from `expectedStatus` to
   * `nextStatus`. Implementations MUST guarantee that concurrent callers
   * racing on the same messageId observe a single winner: exactly one call
   * receives `{ outcome: "applied" }` and every other concurrent/subsequent
   * call receives `{ outcome: "conflict" }` reflecting the terminal state.
   * This must not be implemented as a plain get-then-set, since that is
   * vulnerable to double-settlement under concurrent requests.
   */
  transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult>;
  /**
   * Insert a postage record, enforcing message-identifier uniqueness at the
   * persistence layer. Unlike {@link ApiRepository.setPostage} (an upsert), a
   * duplicate messageId must reject with a deterministic conflict
   * (ApiError 409 "conflict") so duplicate records can never create ambiguous
   * postage/receipt state. Concurrent inserts must yield exactly one winner.
   */
  insertPostage(postage: Postage): Promise<Postage>;
  getReceipt(messageId: string): Promise<Receipt | null>;
  setReceipt(receipt: Receipt): Promise<Receipt>;
  getMessageDeliveryStatus(messageId: string): Promise<MessageDeliveryStatusRecord | null>;
  setMessageDeliveryStatus(
    record: MessageDeliveryStatusRecord,
  ): Promise<MessageDeliveryStatusRecord>;
  createReceiptIfAbsent(receipt: Receipt): Promise<{ created: boolean; receipt: Receipt }>;
  markReceiptRead(messageId: string, actor: string, now?: Date): Promise<MarkReceiptReadResult>;
  acquireIdempotencyRecord(
    key: string,
    requestDigest: string,
    leaseMs: number,
  ): Promise<AcquireIdempotencyResult>;

  getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null>;
  setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void>;

  // Issue #1954 (BETA-048): Send Operation State persistence
  getSendOperation(messageId: string): Promise<import("./domain").SendOperationState | null>;
  setSendOperation(
    state: import("./domain").SendOperationState,
  ): Promise<import("./domain").SendOperationState>;
  createSendOperationIfAbsent(
    state: import("./domain").SendOperationState,
  ): Promise<{ created: boolean; state: import("./domain").SendOperationState }>;

  getExternalWallets(owner: string): Promise<ExternalWallet[]>;
  setExternalWallet(owner: string, wallet: ExternalWallet): Promise<ExternalWallet>;
  removeExternalWallet(owner: string, address: string): Promise<void>;
  findExternalWalletOwner(address: string): Promise<string | null>;
  getWalletChallenge(owner: string, address: string): Promise<ExternalWalletChallenge | null>;
  setWalletChallenge(
    owner: string,
    address: string,
    challenge: ExternalWalletChallenge,
  ): Promise<void>;
  deleteWalletChallenge(owner: string, address: string): Promise<void>;
  // BETA-002: User Account, Profile, and Credential Domain Methods
  getUserById(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByAddress(address: string): Promise<User | null>;
  createUser(user: User, credential?: Credential, profile?: Profile): Promise<User>;
  updateUser(user: User, expectedVersion: number): Promise<UpdateUserResult>;
  getProfile(userId: string): Promise<Profile | null>;
  setProfile(profile: Profile): Promise<Profile>;
  getCredential(userId: string): Promise<Credential | null>;
  getAccountDeletionRequest(userId: string): Promise<AccountDeletionRequest | null>;
  setAccountDeletionRequest(request: AccountDeletionRequest): Promise<AccountDeletionRequest>;
  exportAccount(userId: string, address: string, now?: Date): Promise<AccountExport>;
  deleteAccountData(
    userId: string,
    address: string,
    now?: Date,
  ): Promise<{
    deleted: string[];
    retained: string[];
  }>;
  setCredential(credential: Credential): Promise<Credential>;

  // BETA-014: Transactional account-provisioning methods
  getProvisioningRecord(userId: string): Promise<ProvisioningRecord | null>;
  /**
   * Insert-once initialization of a provisioning record. Concurrent
   * initializations must yield exactly one `created: true`; every other call
   * receives the authoritative existing record so no account can ever have
   * two competing provisioning ledgers.
   */
  createProvisioningRecord(
    record: ProvisioningRecord,
  ): Promise<{ created: boolean; record: ProvisioningRecord }>;
  /**
   * Compare-and-swap write of the provisioning state machine. `expectedVersion`
   * must match the persisted record's version; a stale writer receives
   * `{ updated: false, current }` instead of silently clobbering progress.
   * Concurrent provisioners for the same account must serialize so exactly
   * one writer advances the record per step.
   */
  setProvisioningRecord(
    record: ProvisioningRecord,
    expectedVersion: number,
  ): Promise<UpdateProvisioningResult>;
  /**
   * Atomically claims a username for `leaseMs`. Single-winner: concurrent
   * claims for the same username must never both succeed, and a claim held
   * by another user must never be stolen or overwritten.
   */
  reserveUsername(
    username: string,
    userId: string,
    leaseMs: number,
  ): Promise<UsernameReservationResult>;
  getUsernameReservation(username: string): Promise<UsernameReservation | null>;
  /**
   * Releases a reservation owned by `userId` (compensation path). Returns
   * true when a live claim was released, false when nothing was owned or
   * the claim already expired. Idempotent: releasing twice is safe.
   */
  releaseUsernameReservation(username: string, userId: string): Promise<boolean>;
  getWallet(userId: string): Promise<Wallet | null>;
  /**
   * Insert-once wallet creation keyed by user. Concurrent creations must
   * yield exactly one "created" outcome; every other call receives the
   * authoritative existing record as "already-exists".
   */
  createWallet(wallet: Wallet): Promise<WalletCreationResult>;
  /**
   * Initializes a mailbox policy only when none is stored for the owner.
   * `created: true` when the default was written, `created: false` when a
   * policy already exists (the existing policy is returned and never
   * overwritten — idempotent retry).
   */
  initializePolicyIfAbsent(
    owner: string,
    policy: MailboxPolicy,
  ): Promise<{ created: boolean; policy: MailboxPolicy }>;
  // BETA-013 (Issue #1920): Durable server-backed onboarding drafts
  getOnboardingDraft(userId: string): Promise<OnboardingDraftRecord | null>;
  /**
   * Upserts the onboarding draft for `userId`. Exactly one record exists per
   * user, so duplicate saves can never create duplicates; a refresh or a
   * second device resumes from the same authoritative state.
   */
  saveOnboardingDraft(record: OnboardingDraftRecord): Promise<OnboardingDraftRecord>;
  // BETA-006 & BETA-007: Server-Side Session Domain Methods
  // BETA-006: Server-side session lifecycle methods.
  getSession(sessionId: string): Promise<Session | null>;
  createSession(session: Session): Promise<Session>;
  updateSession(session: Session): Promise<Session>;
  deleteSession(sessionId: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  listUserSessions(userId: string): Promise<Session[]>;
  deleteOtherUserSessions(userId: string, currentSessionId: string): Promise<void>;
  getRetiredSession(sessionId: string): Promise<RetiredSession | null>;
  createRetiredSession(retiredSession: RetiredSession): Promise<RetiredSession>;

  // BETA-005: Verification token lifecycle methods.
  // Each token is identified by its SHA-256 hash; plaintext tokens are never
  // accepted, stored, or returned by the persistence layer.
  getVerificationToken(tokenHash: string): Promise<VerificationToken | null>;
  getActiveVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationToken | null>;
  issueVerificationToken(
    token: VerificationToken,
    now: Date,
  ): Promise<IssueVerificationTokenResult>;
  consumeVerificationToken(tokenHash: string, now: Date): Promise<ConsumeVerificationTokenResult>;
  recordVerificationAttempt(tokenHash: string, now: Date): Promise<RecordVerificationAttemptResult>;
  invalidateActiveVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
    now: Date,
  ): Promise<void>;
  // Issue #1917 (BETA-010): Recovery code set CAS storage
  getRecoveryCodeSet(userId: string): Promise<RecoveryCodeSet | null>;
  setRecoveryCodeSet(
    set: RecoveryCodeSet,
    expectedVersion: number,
  ): Promise<UpdateRecoveryCodeSetResult>;

  getRelayQueueDepth(relayId: string): Promise<number>;
  getRelayRetryCount(relayId: string): Promise<number>;
  getRelayLastSuccessfulDelivery(relayId: string): Promise<string | null>;
  getRelayLastFailedDelivery(relayId: string): Promise<string | null>;
  getRelayDeadLetterCount(relayId: string): Promise<number>;
  getCounter(key: string): Promise<number>;
  incrementCounter(key: string, windowSeconds: number, amount?: number): Promise<number>;

  // ---------------------------------------------------------------------------
  // Issue #1936 (BETA-029) — Durable encrypted envelope repository
  // ---------------------------------------------------------------------------

  /**
   * Retrieves a stored envelope by its immutable message ID.
   * Returns null when no envelope exists for the given ID.
   * Plaintext is never stored or returned by this method.
   */
  getEnvelope(messageId: string): Promise<StoredEnvelope | null>;

  /**
   * Insert-only: persists a new encrypted envelope under an immutable message ID.
   *
   * Idempotency contract
   * --------------------
   * - "inserted" : first successful write for this messageId.
   * - "duplicate": byte-identical payload already exists (safe retry).
   * - "conflict" : a *different* payload is already stored (unrecoverable).
   *
   * Implementations MUST guarantee that concurrent inserts yield exactly one
   * "inserted" outcome; all racing duplicates receive either "duplicate" or
   * "conflict" depending on their byte content. A plain get-then-put is
   * vulnerable to lost-update races and MUST NOT be used here.
   *
   * Plaintext MUST NOT be passed to this method; ciphertext only.
   */
  insertEnvelope(envelope: StoredEnvelope): Promise<InsertEnvelopeResult>;
  getSenderRequest(requestId: string): Promise<UnknownSenderRequest | null>;
  listSenderRequests(recipient: string, status?: "pending"): Promise<UnknownSenderRequest[]>;
  createSenderRequestIfAbsent(request: UnknownSenderRequest): Promise<CreateSenderRequestResult>;
  transitionSenderRequest(
    requestId: string,
    recipient: string,
    decision: UnknownSenderDecision,
    now?: Date,
  ): Promise<SenderRequestTransitionResult>;

  // ---------------------------------------------------------------------------
  // Issue #1940 (BETA-033) — Authenticated Recipient Mailbox Queue Repository
  // ---------------------------------------------------------------------------
  listRecipientEnvelopes(
    recipient: string,
    options?: MailboxQueryOptions,
  ): Promise<Page<StoredEnvelope>>;
  tombstoneEnvelope(messageId: string, recipient: string): Promise<StoredEnvelope>;
  updateEnvelopeStatus(
    messageId: string,
    status: import("./domain").MailboxItemStatus,
  ): Promise<StoredEnvelope>;
  patchMailboxFlags(
    messageId: string,
    recipient: string,
    patch: MailboxFlagsPatch,
  ): Promise<StoredEnvelope>;
  searchMailbox(actor: string, options?: SearchMailboxQueryOptions): Promise<Page<StoredEnvelope>>;

  // ---------------------------------------------------------------------------
  // Issue #1934 (BETA-027) — Versioned Public Encryption-Key Directory & Rotation
  // ---------------------------------------------------------------------------
  getKeyDirectory(owner: string): Promise<KeyDirectoryRecord | null>;
  getPublishedKey(owner: string, keyId: string): Promise<PublishedKey | null>;
  savePublishedKey(owner: string, key: PublishedKey): Promise<PublishedKey>;
  saveKeyDirectory(record: KeyDirectoryRecord): Promise<KeyDirectoryRecord>;

  // BETA-015 (Issue #1922): managed Stellar testnet wallet persistence.
  getManagedWallet(userId: string): Promise<ManagedWalletRecord | null>;
  setManagedWallet(wallet: ManagedWalletRecord): Promise<ManagedWalletRecord>;
  createManagedWalletIfAbsent(wallet: ManagedWalletRecord): Promise<CreateManagedWalletResult>;

  // BETA-018 (Issue #1925): durable testnet funding operations.
  getFundingOperation(operationId: string): Promise<FundingOperation | null>;
  setFundingOperation(operation: FundingOperation): Promise<FundingOperation>;
  createFundingOperationIfAbsent(
    operation: FundingOperation,
  ): Promise<{ created: boolean; operation: FundingOperation }>;
  listFundingOperations(filter?: {
    status?: FundingOperation["status"];
    limit?: number;
  }): Promise<FundingOperation[]>;

  // ---------------------------------------------------------------------------
  // Issue #1973 (BETA-066) — Live contacts CRUD
  // ---------------------------------------------------------------------------
  listContacts(owner: string, options?: ContactQueryOptions): Promise<Page<Contact>>;
  getContact(owner: string, contactId: string): Promise<Contact | null>;
  /**
   * Insert-once contact creation keyed by contactId (scoped to `owner`).
   * A duplicate contactId for the same owner must reject with a deterministic
   * conflict (ApiError 409 "conflict") so imports can never create ambiguous
   * address-book state.
   */
  createContact(contact: Contact): Promise<Contact>;
  updateContact(contact: Contact, expectedVersion: number): Promise<UpdateContactResult>;
  deleteContact(owner: string, contactId: string): Promise<void>;

  // ---------------------------------------------------------------------------
  // Issue #1965 (BETA-058) — Live drafts CRUD
  // ---------------------------------------------------------------------------
  listDrafts(owner: string, options?: DraftQueryOptions): Promise<Page<DraftRecord>>;
  getDraft(owner: string, draftId: string): Promise<DraftRecord | null>;
  createDraft(draft: DraftRecord): Promise<DraftRecord>;
  updateDraft(draft: DraftRecord, expectedVersion: number): Promise<UpdateDraftResult>;
  deleteDraft(owner: string, draftId: string): Promise<void>;

  // ---------------------------------------------------------------------------
  // Issue #1952 (BETA-045) — Durable jobs, retries, DLQ, and receipt indexing
  // ---------------------------------------------------------------------------
  enqueueJob(job: DurableJob): Promise<{ enqueued: boolean; job: DurableJob }>;
  getJob(jobId: string): Promise<DurableJob | null>;
  getJobByIdempotencyKey(key: string): Promise<DurableJob | null>;
  updateJob(job: DurableJob): Promise<DurableJob>;
  claimNextPendingJob(types?: DurableJobType[], now?: Date): Promise<DurableJob | null>;
  listJobs(filter?: {
    type?: DurableJobType;
    status?: JobStatus;
    limit?: number;
  }): Promise<DurableJob[]>;

  createDeadLetter(deadLetter: DeadLetter): Promise<DeadLetter>;
  getDeadLetter(deadLetterId: string): Promise<DeadLetter | null>;
  listDeadLetters(filter?: {
    jobType?: DurableJobType;
    status?: DeadLetterStatus;
    limit?: number;
  }): Promise<DeadLetter[]>;
  updateDeadLetter(deadLetter: DeadLetter): Promise<DeadLetter>;

  getReceiptCheckpoint(streamId: string): Promise<ReceiptCheckpoint | null>;
  setReceiptCheckpoint(checkpoint: ReceiptCheckpoint): Promise<ReceiptCheckpoint>;

  getInvite(code: string): Promise<Invite | null>;
  setInvite(invite: Invite): Promise<Invite>;
  listInvites(): Promise<Invite[]>;

  // ---------------------------------------------------------------------------
  // Issue #2001 (BETA-094) — Beta tester feedback reports
  // ---------------------------------------------------------------------------
  getFeedbackReport(reportId: string): Promise<import("./domain").FeedbackReport | null>;
  createFeedbackReport(
    report: import("./domain").FeedbackReport,
  ): Promise<import("./domain").FeedbackReport>;
  updateFeedbackReport(
    report: import("./domain").FeedbackReport,
  ): Promise<import("./domain").FeedbackReport>;
  listFeedbackReports(filter?: {
    status?: import("./domain").FeedbackStatus;
    category?: import("./domain").FeedbackCategory;
    limit?: number;
    after?: string;
  }): Promise<import("./domain").FeedbackReport[]>;

  reset?(): void;
}

export const defaultMailboxPolicy: MailboxPolicy = {
  allowUnknown: false,
  minimumPostage: "0",
  requireVerified: true,
};

// ---------------------------------------------------------------------------
// Issue #1508: Record validation at adapter boundaries
// ---------------------------------------------------------------------------

let correlationCounter = 0;

export function generateCorrelationId(): string {
  correlationCounter += 1;
  return `di-${Date.now()}-${correlationCounter}`;
}

export type Migration = (data: any) => any;

interface RecordSchemaDef {
  currentVersion: number;
  schema: ZodSchema;
  migrations: Record<number, Migration>;
}

const recordSchemas = new Map<string, RecordSchemaDef>();

export function registerRecordSchema(
  type: string,
  currentVersion: number,
  schema: ZodSchema,
  migrations: Record<number, Migration> = {},
): void {
  recordSchemas.set(type, { currentVersion, schema, migrations });
}

export function validateRecord<T>(recordType: string, data: unknown): T {
  const def = recordSchemas.get(recordType);
  if (!def) return data as T;

  const version =
    typeof data === "object" && data !== null && "$v" in data ? ((data as any).$v as number) : 1;

  if (version > def.currentVersion) {
    throw new DataIntegrityError(
      recordType,
      generateCorrelationId(),
      `Unsupported newer schema version ${version} for ${recordType}`,
    );
  }

  let migratedData = data;
  for (let v = version; v < def.currentVersion; v++) {
    const migration = def.migrations[v];
    if (migration) {
      migratedData = migration(migratedData);
      if (typeof migratedData === "object" && migratedData !== null) {
        (migratedData as any).$v = v + 1;
      }
    } else {
      throw new DataIntegrityError(
        recordType,
        generateCorrelationId(),
        `Missing migration from version ${v} to ${v + 1} for ${recordType}`,
      );
    }
  }

  const result = def.schema.safeParse(migratedData);
  if (!result.success) {
    throw new DataIntegrityError(
      recordType,
      generateCorrelationId(),
      `Stored ${recordType} record failed validation`,
    );
  }
  return result.data as T;
}

export function versionRecord<T>(recordType: string, data: T): T {
  const def = recordSchemas.get(recordType);
  if (!def || typeof data !== "object" || data === null) return data;
  return { ...data, $v: def.currentVersion } as unknown as T;
}

/**
 * Wraps any ApiRepository to validate records at adapter boundaries.
 * Corrupt records throw a DataIntegrityError that never leaks the
 * corrupt payload to clients — only the record type and correlation ID
 * are exposed.
 */
export class ValidatedApiRepository implements ApiRepository {
  constructor(private readonly inner: ApiRepository) {}

  async getPolicy(owner: string): Promise<MailboxPolicy | null> {
    const raw = await this.inner.getPolicy(owner);
    return raw ? validateRecord<MailboxPolicy>("mailboxPolicy", raw) : null;
  }

  setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy> {
    return this.inner.setPolicy(owner, versionRecord("mailboxPolicy", policy));
  }

  async getPolicyWriteIntent(owner: string): Promise<PolicyWriteIntent | null> {
    const raw = await this.inner.getPolicyWriteIntent(owner);
    return raw ? validateRecord<PolicyWriteIntent>("policyWriteIntent", raw) : null;
  }

  setPolicyWriteIntent(intent: PolicyWriteIntent): Promise<PolicyWriteIntent> {
    return this.inner.setPolicyWriteIntent(versionRecord("policyWriteIntent", intent));
  }

  async getLifecycleAnchor(messageId: string): Promise<LifecycleAnchor | null> {
    const raw = await this.inner.getLifecycleAnchor(messageId);
    return raw ? validateRecord<LifecycleAnchor>("lifecycleAnchor", raw) : null;
  }

  async setLifecycleAnchor(anchor: LifecycleAnchor): Promise<LifecycleAnchor> {
    const result = await this.inner.setLifecycleAnchor(versionRecord("lifecycleAnchor", anchor));
    return validateRecord<LifecycleAnchor>("lifecycleAnchor", result);
  }

  async getSenderRule(owner: string, sender: string): Promise<SenderRule> {
    const raw = await this.inner.getSenderRule(owner, sender);
    return validateRecord<SenderRule>("senderRule", raw);
  }

  setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule> {
    return this.inner.setSenderRule(owner, sender, versionRecord("senderRule", rule));
  }

  // BETA-037 (Issue #1944): versioned sender rule records with chain reconciliation
  async getSenderRuleRecord(owner: string, sender: string): Promise<SenderRuleRecord | null> {
    const raw = await this.inner.getSenderRuleRecord(owner, sender);
    return raw ? validateRecord<SenderRuleRecord>("senderRuleRecord", raw) : null;
  }

  async setSenderRuleRecord(record: SenderRuleRecord): Promise<SenderRuleRecord> {
    const result = await this.inner.setSenderRuleRecord(versionRecord("senderRuleRecord", record));
    return validateRecord<SenderRuleRecord>("senderRuleRecord", result);
  }

  async deleteSenderRuleRecord(owner: string, sender: string): Promise<boolean> {
    return this.inner.deleteSenderRuleRecord(owner, sender);
  }

  async listSenderRuleRecords(
    owner: string,
    options?: { limit?: number; after?: string },
  ): Promise<{ records: SenderRuleRecord[]; nextCursor?: string }> {
    const result = await this.inner.listSenderRuleRecords(owner, options);
    return {
      ...result,
      records: result.records.map((r) => validateRecord<SenderRuleRecord>("senderRuleRecord", r)),
    };
  }

  async compareAndSetSenderRule(
    owner: string,
    sender: string,
    rule: SenderRule,
    expectedVersion?: number,
    now?: Date,
  ): Promise<CompareSetSenderRuleResult> {
    const result = await this.inner.compareAndSetSenderRule(
      owner,
      sender,
      rule,
      expectedVersion,
      now,
    );
    if (result.outcome === "applied") {
      result.record = validateRecord<SenderRuleRecord>("senderRuleRecord", result.record);
    } else if (result.current) {
      result.current = validateRecord<SenderRuleRecord>("senderRuleRecord", result.current);
    }
    return result;
  }

  async compareAndSetSenderRuleRecord(
    input: CompareSetSenderRuleRecordInput,
    expectedVersion?: number,
    now?: Date,
  ): Promise<CompareSetSenderRuleResult> {
    const result = await this.inner.compareAndSetSenderRuleRecord(input, expectedVersion, now);
    if (result.outcome === "applied") {
      result.record = validateRecord<SenderRuleRecord>("senderRuleRecord", result.record);
    } else if (result.current) {
      result.current = validateRecord<SenderRuleRecord>("senderRuleRecord", result.current);
    }
    return result;
  }

  async getSenderRuleWriteIntent(
    owner: string,
    sender: string,
  ): Promise<SenderRuleWriteIntent | null> {
    const raw = await this.inner.getSenderRuleWriteIntent(owner, sender);
    return raw ? validateRecord<SenderRuleWriteIntent>("senderRuleWriteIntent", raw) : null;
  }

  setSenderRuleWriteIntent(intent: SenderRuleWriteIntent): Promise<SenderRuleWriteIntent> {
    return this.inner.setSenderRuleWriteIntent(versionRecord("senderRuleWriteIntent", intent));
  }

  async listSenderRuleWriteIntents(owner: string): Promise<SenderRuleWriteIntent[]> {
    const intents = await this.inner.listSenderRuleWriteIntents(owner);
    return intents.map((intent) =>
      validateRecord<SenderRuleWriteIntent>("senderRuleWriteIntent", intent),
    );
  }

  async getPostage(messageId: string): Promise<Postage | null> {
    const raw = await this.inner.getPostage(messageId);
    return raw ? validateRecord<Postage>("postage", raw) : null;
  }

  async setPostage(postage: Postage): Promise<Postage> {
    const result = await this.inner.setPostage(versionRecord("postage", postage));
    return validateRecord<Postage>("postage", result);
  }

  async transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult> {
    const result = await this.inner.transitionPostage(messageId, expectedStatus, nextStatus);
    if (result.outcome === "conflict" || result.outcome === "applied") {
      result.postage = validateRecord<Postage>("postage", result.postage);
    }
    return result;
  }

  async insertPostage(postage: Postage): Promise<Postage> {
    const result = await this.inner.insertPostage(versionRecord("postage", postage));
    return validateRecord<Postage>("postage", result);
  }

  async getReceipt(messageId: string): Promise<Receipt | null> {
    const raw = await this.inner.getReceipt(messageId);
    return raw ? validateRecord<Receipt>("receipt", raw) : null;
  }

  async setReceipt(receipt: Receipt): Promise<Receipt> {
    const result = await this.inner.setReceipt(versionRecord("receipt", receipt));
    return validateRecord<Receipt>("receipt", result);
  }

  async getMessageDeliveryStatus(messageId: string): Promise<MessageDeliveryStatusRecord | null> {
    const raw = await this.inner.getMessageDeliveryStatus(messageId);
    return raw
      ? validateRecord<MessageDeliveryStatusRecord>("messageDeliveryStatusRecord", raw)
      : null;
  }

  async setMessageDeliveryStatus(
    record: MessageDeliveryStatusRecord,
  ): Promise<MessageDeliveryStatusRecord> {
    const result = await this.inner.setMessageDeliveryStatus(
      versionRecord("messageDeliveryStatusRecord", record),
    );
    return validateRecord<MessageDeliveryStatusRecord>("messageDeliveryStatusRecord", result);
  }

  async createReceiptIfAbsent(receipt: Receipt): Promise<{ created: boolean; receipt: Receipt }> {
    const result = await this.inner.createReceiptIfAbsent(versionRecord("receipt", receipt));
    if (result.created) {
      result.receipt = validateRecord<Receipt>("receipt", result.receipt);
    }
    return result;
  }

  async markReceiptRead(
    messageId: string,
    actor: string,
    now?: Date,
  ): Promise<MarkReceiptReadResult> {
    const result = await this.inner.markReceiptRead(messageId, actor, now);
    if (result.outcome === "marked") {
      result.receipt = validateRecord<Receipt>("receipt", result.receipt);
    }
    return result;
  }

  acquireIdempotencyRecord(
    key: string,
    requestDigest: string,
    leaseMs: number,
  ): Promise<AcquireIdempotencyResult> {
    // Acquire does not take an object payload to insert, it creates one internally.
    // The internal DO logic is responsible for its own fields.
    // For reads via this repo wrapper, we could validate the returned record.
    return this.inner.acquireIdempotencyRecord(key, requestDigest, leaseMs).then((result) => {
      if (result.status === "completed") {
        result.record = validateRecord<IdempotencyRecord & { state: "completed" }>(
          "idempotencyRecord",
          result.record,
        );
      }
      return result;
    });
  }

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    const raw = await this.inner.getIdempotencyRecord(key);
    return raw ? validateRecord<IdempotencyRecord>("idempotencyRecord", raw) : null;
  }

  setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    return this.inner.setIdempotencyRecord(key, versionRecord("idempotencyRecord", record));
  }

  async getSendOperation(messageId: string): Promise<import("./domain").SendOperationState | null> {
    const raw = await this.inner.getSendOperation(messageId);
    return raw
      ? validateRecord<import("./domain").SendOperationState>("sendOperationState", raw)
      : null;
  }

  async setSendOperation(
    state: import("./domain").SendOperationState,
  ): Promise<import("./domain").SendOperationState> {
    const result = await this.inner.setSendOperation(versionRecord("sendOperationState", state));
    return validateRecord<import("./domain").SendOperationState>("sendOperationState", result);
  }

  async createSendOperationIfAbsent(
    state: import("./domain").SendOperationState,
  ): Promise<{ created: boolean; state: import("./domain").SendOperationState }> {
    const result = await this.inner.createSendOperationIfAbsent(
      versionRecord("sendOperationState", state),
    );
    if (result.created) {
      result.state = validateRecord<import("./domain").SendOperationState>(
        "sendOperationState",
        result.state,
      );
    }
    return result;
  }

  async getUserById(userId: string): Promise<User | null> {
    const raw = await this.inner.getUserById(userId);
    return raw ? validateRecord<User>("user", raw) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const raw = await this.inner.getUserByEmail(email);
    return raw ? validateRecord<User>("user", raw) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const raw = await this.inner.getUserByUsername(username);
    return raw ? validateRecord<User>("user", raw) : null;
  }

  async getUserByAddress(address: string): Promise<User | null> {
    const raw = await this.inner.getUserByAddress(address);
    return raw ? validateRecord<User>("user", raw) : null;
  }

  async createUser(user: User, credential?: Credential, profile?: Profile): Promise<User> {
    const versionedUser = versionRecord("user", user);
    const versionedCred = credential ? versionRecord("credential", credential) : undefined;
    const versionedProf = profile ? versionRecord("profile", profile) : undefined;
    const result = await this.inner.createUser(versionedUser, versionedCred, versionedProf);
    return validateRecord<User>("user", result);
  }

  async updateUser(user: User, expectedVersion: number): Promise<UpdateUserResult> {
    const versionedUser = versionRecord("user", user);
    const result = await this.inner.updateUser(versionedUser, expectedVersion);
    if (result.updated) {
      result.user = validateRecord<User>("user", result.user);
    } else if (result.current) {
      result.current = validateRecord<User>("user", result.current);
    }
    return result;
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const raw = await this.inner.getProfile(userId);
    return raw ? validateRecord<Profile>("profile", raw) : null;
  }

  async setProfile(profile: Profile): Promise<Profile> {
    const result = await this.inner.setProfile(versionRecord("profile", profile));
    return validateRecord<Profile>("profile", result);
  }

  async getCredential(userId: string): Promise<Credential | null> {
    const raw = await this.inner.getCredential(userId);
    return raw ? validateRecord<Credential>("credential", raw) : null;
  }

  async setCredential(credential: Credential): Promise<Credential> {
    const result = await this.inner.setCredential(versionRecord("credential", credential));
    return validateRecord<Credential>("credential", result);
  }

  async getAccountDeletionRequest(userId: string): Promise<AccountDeletionRequest | null> {
    const raw = await this.inner.getAccountDeletionRequest(userId);
    return raw ? validateRecord<AccountDeletionRequest>("accountDeletionRequest", raw) : null;
  }

  async setAccountDeletionRequest(
    request: AccountDeletionRequest,
  ): Promise<AccountDeletionRequest> {
    return validateRecord<AccountDeletionRequest>(
      "accountDeletionRequest",
      await this.inner.setAccountDeletionRequest(request),
    );
  }

  exportAccount(userId: string, address: string, now?: Date): Promise<AccountExport> {
    return this.inner.exportAccount(userId, address, now);
  }

  deleteAccountData(userId: string, address: string, now?: Date) {
    return this.inner.deleteAccountData(userId, address, now);
  }

  async getProvisioningRecord(userId: string): Promise<ProvisioningRecord | null> {
    const raw = await this.inner.getProvisioningRecord(userId);
    return raw ? validateRecord<ProvisioningRecord>("provisioning", raw) : null;
  }

  async createProvisioningRecord(
    record: ProvisioningRecord,
  ): Promise<{ created: boolean; record: ProvisioningRecord }> {
    const result = await this.inner.createProvisioningRecord(versionRecord("provisioning", record));
    result.record = validateRecord<ProvisioningRecord>("provisioning", result.record);
    return result;
  }

  async setProvisioningRecord(
    record: ProvisioningRecord,
    expectedVersion: number,
  ): Promise<UpdateProvisioningResult> {
    const result = await this.inner.setProvisioningRecord(
      versionRecord("provisioning", record),
      expectedVersion,
    );
    if (result.updated) {
      result.record = validateRecord<ProvisioningRecord>("provisioning", result.record);
    } else if (result.current) {
      result.current = validateRecord<ProvisioningRecord>("provisioning", result.current);
    }
    return result;
  }

  async reserveUsername(
    username: string,
    userId: string,
    leaseMs: number,
  ): Promise<UsernameReservationResult> {
    const result = await this.inner.reserveUsername(username, userId, leaseMs);
    if (result.outcome === "reserved" || result.outcome === "already-reserved") {
      result.reservation = validateRecord<UsernameReservation>(
        "usernameReservation",
        result.reservation,
      );
    }
    return result;
  }

  async getUsernameReservation(username: string): Promise<UsernameReservation | null> {
    const raw = await this.inner.getUsernameReservation(username);
    return raw ? validateRecord<UsernameReservation>("usernameReservation", raw) : null;
  }

  async releaseUsernameReservation(username: string, userId: string): Promise<boolean> {
    return this.inner.releaseUsernameReservation(username, userId);
  }

  async getWallet(userId: string): Promise<Wallet | null> {
    const raw = await this.inner.getWallet(userId);
    return raw ? validateRecord<Wallet>("wallet", raw) : null;
  }

  async createWallet(wallet: Wallet): Promise<WalletCreationResult> {
    const result = await this.inner.createWallet(versionRecord("wallet", wallet));
    if (result.outcome === "created" || result.outcome === "already-exists") {
      result.wallet = validateRecord<Wallet>("wallet", result.wallet);
    }
    return result;
  }

  async initializePolicyIfAbsent(
    owner: string,
    policy: MailboxPolicy,
  ): Promise<{ created: boolean; policy: MailboxPolicy }> {
    const result = await this.inner.initializePolicyIfAbsent(owner, policy);
    if (result.created) {
      result.policy = validateRecord<MailboxPolicy>("mailboxPolicy", result.policy);
    }
    return result;
  }

  async getOnboardingDraft(userId: string): Promise<OnboardingDraftRecord | null> {
    const raw = await this.inner.getOnboardingDraft(userId);
    return raw ? validateRecord<OnboardingDraftRecord>("onboardingDraft", raw) : null;
  }

  async saveOnboardingDraft(record: OnboardingDraftRecord): Promise<OnboardingDraftRecord> {
    const result = await this.inner.saveOnboardingDraft(versionRecord("onboardingDraft", record));
    return validateRecord<OnboardingDraftRecord>("onboardingDraft", result);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const raw = await this.inner.getSession(sessionId);
    return raw ? validateRecord<Session>("session", raw) : null;
  }

  async createSession(session: Session): Promise<Session> {
    const result = await this.inner.createSession(versionRecord("session", session));
    return validateRecord<Session>("session", result);
  }

  async updateSession(session: Session): Promise<Session> {
    const result = await this.inner.updateSession(versionRecord("session", session));
    return validateRecord<Session>("session", result);
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.inner.deleteSession(sessionId);
  }

  deleteUserSessions(userId: string): Promise<void> {
    return this.inner.deleteUserSessions(userId);
  }

  async listUserSessions(userId: string): Promise<Session[]> {
    const raw = await this.inner.listUserSessions(userId);
    return raw.map((s) => validateRecord<Session>("session", s));
  }

  deleteOtherUserSessions(userId: string, currentSessionId: string): Promise<void> {
    return this.inner.deleteOtherUserSessions(userId, currentSessionId);
  }

  async getRetiredSession(sessionId: string): Promise<RetiredSession | null> {
    const raw = await this.inner.getRetiredSession(sessionId);
    return raw ? validateRecord<RetiredSession>("retiredSession", raw) : null;
  }

  async createRetiredSession(retiredSession: RetiredSession): Promise<RetiredSession> {
    const result = await this.inner.createRetiredSession(
      versionRecord("retiredSession", retiredSession),
    );
    return validateRecord<RetiredSession>("retiredSession", result);
  }

  async getVerificationToken(tokenHash: string): Promise<VerificationToken | null> {
    const raw = await this.inner.getVerificationToken(tokenHash);
    return raw ? validateRecord<VerificationToken>("verificationToken", raw) : null;
  }

  async getActiveVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationToken | null> {
    const raw = await this.inner.getActiveVerificationToken(userId, purpose);
    return raw ? validateRecord<VerificationToken>("verificationToken", raw) : null;
  }

  async issueVerificationToken(
    token: VerificationToken,
    now: Date,
  ): Promise<IssueVerificationTokenResult> {
    const result = await this.inner.issueVerificationToken(
      versionRecord("verificationToken", token),
      now,
    );
    if (result.outcome === "issued" && result.replacedToken) {
      result.replacedToken = validateRecord<VerificationToken>(
        "verificationToken",
        result.replacedToken,
      );
    }
    if (result.outcome === "issued" || result.outcome === "conflict") {
      result.token = validateRecord<VerificationToken>("verificationToken", result.token);
    }
    return result;
  }

  async consumeVerificationToken(
    tokenHash: string,
    now: Date,
  ): Promise<ConsumeVerificationTokenResult> {
    const result = await this.inner.consumeVerificationToken(tokenHash, now);
    if (result.outcome !== "not-found") {
      result.token = validateRecord<VerificationToken>("verificationToken", result.token);
    }
    return result;
  }

  async recordVerificationAttempt(
    tokenHash: string,
    now: Date,
  ): Promise<RecordVerificationAttemptResult> {
    const result = await this.inner.recordVerificationAttempt(tokenHash, now);
    if (result.token) {
      result.token = validateRecord<VerificationToken>("verificationToken", result.token);
    }
    return result;
  }

  async getRecoveryCodeSet(userId: string): Promise<RecoveryCodeSet | null> {
    const raw = await this.inner.getRecoveryCodeSet(userId);
    return raw ? validateRecord<RecoveryCodeSet>("recoveryCodeSet", raw) : null;
  }

  async setRecoveryCodeSet(
    set: RecoveryCodeSet,
    expectedVersion: number,
  ): Promise<UpdateRecoveryCodeSetResult> {
    const result = await this.inner.setRecoveryCodeSet(
      versionRecord("recoveryCodeSet", set),
      expectedVersion,
    );
    if (result.updated) {
      result.set = validateRecord<RecoveryCodeSet>("recoveryCodeSet", result.set);
    } else if (result.current) {
      result.current = validateRecord<RecoveryCodeSet>("recoveryCodeSet", result.current);
    }
    return result;
  }

  async invalidateActiveVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
    now: Date,
  ): Promise<void> {
    return this.inner.invalidateActiveVerificationToken(userId, purpose, now);
  }

  getRelayQueueDepth(relayId: string): Promise<number> {
    return this.inner.getRelayQueueDepth(relayId);
  }

  getRelayRetryCount(relayId: string): Promise<number> {
    return this.inner.getRelayRetryCount(relayId);
  }

  getRelayLastSuccessfulDelivery(relayId: string): Promise<string | null> {
    return this.inner.getRelayLastSuccessfulDelivery(relayId);
  }

  getRelayLastFailedDelivery(relayId: string): Promise<string | null> {
    return this.inner.getRelayLastFailedDelivery(relayId);
  }

  getRelayDeadLetterCount(relayId: string): Promise<number> {
    return this.inner.getRelayDeadLetterCount(relayId);
  }

  getCounter(key: string): Promise<number> {
    return this.inner.getCounter(key);
  }

  incrementCounter(key: string, windowSeconds: number, amount?: number): Promise<number> {
    return this.inner.incrementCounter(key, windowSeconds, amount);
  }

  async getEnvelope(messageId: string): Promise<StoredEnvelope | null> {
    const raw = await this.inner.getEnvelope(messageId);
    return raw ? validateRecord<StoredEnvelope>("storedEnvelope", raw) : null;
  }

  async insertEnvelope(envelope: StoredEnvelope): Promise<InsertEnvelopeResult> {
    // Version the record before handing it to the inner adapter so that the
    // byte-equality check in each implementation uses versioned payloads.
    const result = await this.inner.insertEnvelope(versionRecord("storedEnvelope", envelope));
    if (result.outcome === "inserted" || result.outcome === "duplicate") {
      result.envelope = validateRecord<StoredEnvelope>("storedEnvelope", result.envelope);
    }
    return result;
  }
  getSenderRequest(requestId: string) {
    return this.inner.getSenderRequest(requestId);
  }
  listSenderRequests(recipient: string, status?: "pending") {
    return this.inner.listSenderRequests(recipient, status);
  }
  createSenderRequestIfAbsent(request: UnknownSenderRequest) {
    return this.inner.createSenderRequestIfAbsent(request);
  }
  transitionSenderRequest(
    requestId: string,
    recipient: string,
    decision: UnknownSenderDecision,
    now?: Date,
  ) {
    return this.inner.transitionSenderRequest(requestId, recipient, decision, now);
  }

  async listRecipientEnvelopes(
    recipient: string,
    options?: MailboxQueryOptions,
  ): Promise<Page<StoredEnvelope>> {
    const page = await this.inner.listRecipientEnvelopes(recipient, options);
    return {
      ...page,
      items: page.items.map((item) => validateRecord<StoredEnvelope>("storedEnvelope", item)),
    };
  }

  async tombstoneEnvelope(messageId: string, recipient: string): Promise<StoredEnvelope> {
    const result = await this.inner.tombstoneEnvelope(messageId, recipient);
    return validateRecord<StoredEnvelope>("storedEnvelope", result);
  }

  async updateEnvelopeStatus(
    messageId: string,
    status: import("./domain").MailboxItemStatus,
  ): Promise<StoredEnvelope> {
    const result = await this.inner.updateEnvelopeStatus(messageId, status);
    return validateRecord<StoredEnvelope>("storedEnvelope", result);
  }

  async patchMailboxFlags(
    messageId: string,
    recipient: string,
    patch: MailboxFlagsPatch,
  ): Promise<StoredEnvelope> {
    const result = await this.inner.patchMailboxFlags(messageId, recipient, patch);
    return validateRecord<StoredEnvelope>("storedEnvelope", result);
  }

  async searchMailbox(
    actor: string,
    options?: SearchMailboxQueryOptions,
  ): Promise<Page<StoredEnvelope>> {
    const page = await this.inner.searchMailbox(actor, options);
    return {
      ...page,
      items: page.items.map((item) => validateRecord<StoredEnvelope>("storedEnvelope", item)),
    };
  }

  getExternalWallets(owner: string): Promise<ExternalWallet[]> {
    return this.inner.getExternalWallets(owner);
  }

  setExternalWallet(owner: string, wallet: ExternalWallet): Promise<ExternalWallet> {
    return this.inner.setExternalWallet(owner, wallet);
  }

  removeExternalWallet(owner: string, address: string): Promise<void> {
    return this.inner.removeExternalWallet(owner, address);
  }

  findExternalWalletOwner(address: string): Promise<string | null> {
    return this.inner.findExternalWalletOwner(address);
  }

  getWalletChallenge(owner: string, address: string): Promise<ExternalWalletChallenge | null> {
    return this.inner.getWalletChallenge(owner, address);
  }

  setWalletChallenge(
    owner: string,
    address: string,
    challenge: ExternalWalletChallenge,
  ): Promise<void> {
    return this.inner.setWalletChallenge(owner, address, challenge);
  }

  deleteWalletChallenge(owner: string, address: string): Promise<void> {
    return this.inner.deleteWalletChallenge(owner, address);
  }

  async getKeyDirectory(owner: string): Promise<KeyDirectoryRecord | null> {
    const raw = await this.inner.getKeyDirectory(owner);
    return raw ? validateRecord<KeyDirectoryRecord>("keyDirectoryRecord", raw) : null;
  }

  async getPublishedKey(owner: string, keyId: string): Promise<PublishedKey | null> {
    const raw = await this.inner.getPublishedKey(owner, keyId);
    return raw ? validateRecord<PublishedKey>("publishedKey", raw) : null;
  }

  async savePublishedKey(owner: string, key: PublishedKey): Promise<PublishedKey> {
    const result = await this.inner.savePublishedKey(owner, versionRecord("publishedKey", key));
    return validateRecord<PublishedKey>("publishedKey", result);
  }

  async saveKeyDirectory(record: KeyDirectoryRecord): Promise<KeyDirectoryRecord> {
    const result = await this.inner.saveKeyDirectory(versionRecord("keyDirectoryRecord", record));
    return validateRecord<KeyDirectoryRecord>("keyDirectoryRecord", result);
  }

  async getManagedWallet(userId: string): Promise<ManagedWalletRecord | null> {
    const raw = await this.inner.getManagedWallet(userId);
    return raw ? validateRecord<ManagedWalletRecord>("managedWalletRecord", raw) : null;
  }

  async setManagedWallet(wallet: ManagedWalletRecord): Promise<ManagedWalletRecord> {
    const result = await this.inner.setManagedWallet(versionRecord("managedWalletRecord", wallet));
    return validateRecord<ManagedWalletRecord>("managedWalletRecord", result);
  }

  async createManagedWalletIfAbsent(
    wallet: ManagedWalletRecord,
  ): Promise<CreateManagedWalletResult> {
    const result = await this.inner.createManagedWalletIfAbsent(
      versionRecord("managedWalletRecord", wallet),
    );
    result.wallet = validateRecord<ManagedWalletRecord>("managedWalletRecord", result.wallet);
    return result;
  }

  async getFundingOperation(operationId: string): Promise<FundingOperation | null> {
    const raw = await this.inner.getFundingOperation(operationId);
    return raw ? validateRecord<FundingOperation>("fundingOperation", raw) : null;
  }

  async setFundingOperation(operation: FundingOperation): Promise<FundingOperation> {
    const result = await this.inner.setFundingOperation(
      versionRecord("fundingOperation", operation),
    );
    return validateRecord<FundingOperation>("fundingOperation", result);
  }

  async createFundingOperationIfAbsent(
    operation: FundingOperation,
  ): Promise<{ created: boolean; operation: FundingOperation }> {
    const result = await this.inner.createFundingOperationIfAbsent(
      versionRecord("fundingOperation", operation),
    );
    result.operation = validateRecord<FundingOperation>("fundingOperation", result.operation);
    return result;
  }

  async listFundingOperations(filter?: {
    status?: FundingOperation["status"];
    limit?: number;
  }): Promise<FundingOperation[]> {
    const operations = await this.inner.listFundingOperations(filter);
    return operations.map((item) => validateRecord<FundingOperation>("fundingOperation", item));
  }

  async listContacts(owner: string, options?: ContactQueryOptions): Promise<Page<Contact>> {
    const page = await this.inner.listContacts(owner, options);
    return {
      ...page,
      items: page.items.map((item) => validateRecord<Contact>("contact", item)),
    };
  }

  async getContact(owner: string, contactId: string): Promise<Contact | null> {
    const raw = await this.inner.getContact(owner, contactId);
    return raw ? validateRecord<Contact>("contact", raw) : null;
  }

  async createContact(contact: Contact): Promise<Contact> {
    const result = await this.inner.createContact(versionRecord("contact", contact));
    return validateRecord<Contact>("contact", result);
  }

  async updateContact(contact: Contact, expectedVersion: number): Promise<UpdateContactResult> {
    const result = await this.inner.updateContact(
      versionRecord("contact", contact),
      expectedVersion,
    );
    if (result.updated) {
      return { updated: true, contact: validateRecord<Contact>("contact", result.contact) };
    }
    return {
      updated: false,
      current: result.current ? validateRecord<Contact>("contact", result.current) : null,
    };
  }

  async deleteContact(owner: string, contactId: string): Promise<void> {
    return this.inner.deleteContact(owner, contactId);
  }

  // ---------------------------------------------------------------------------
  // Issue #1965 (BETA-058) — Live drafts CRUD
  // ---------------------------------------------------------------------------
  async listDrafts(owner: string, options?: DraftQueryOptions): Promise<Page<DraftRecord>> {
    const page = await this.inner.listDrafts(owner, options);
    return {
      ...page,
      items: page.items.map((item) => validateRecord<DraftRecord>("draftRecord", item)),
    };
  }

  async getDraft(owner: string, draftId: string): Promise<DraftRecord | null> {
    const raw = await this.inner.getDraft(owner, draftId);
    return raw ? validateRecord<DraftRecord>("draftRecord", raw) : null;
  }

  async createDraft(draft: DraftRecord): Promise<DraftRecord> {
    const result = await this.inner.createDraft(versionRecord("draftRecord", draft));
    return validateRecord<DraftRecord>("draftRecord", result);
  }

  async updateDraft(draft: DraftRecord, expectedVersion: number): Promise<UpdateDraftResult> {
    const result = await this.inner.updateDraft(
      versionRecord("draftRecord", draft),
      expectedVersion,
    );
    if (result.updated) {
      return { updated: true, draft: validateRecord<DraftRecord>("draftRecord", result.draft) };
    }
    return {
      updated: false,
      current: result.current ? validateRecord<DraftRecord>("draftRecord", result.current) : null,
    };
  }

  async deleteDraft(owner: string, draftId: string): Promise<void> {
    return this.inner.deleteDraft(owner, draftId);
  }

  // ---------------------------------------------------------------------------
  // Issue #1952 (BETA-045) — Durable jobs, retries, DLQ, and receipt indexing
  // ---------------------------------------------------------------------------
  enqueueJob(job: DurableJob): Promise<{ enqueued: boolean; job: DurableJob }> {
    return this.inner.enqueueJob(job);
  }

  getJob(jobId: string): Promise<DurableJob | null> {
    return this.inner.getJob(jobId);
  }

  getJobByIdempotencyKey(key: string): Promise<DurableJob | null> {
    return this.inner.getJobByIdempotencyKey(key);
  }

  updateJob(job: DurableJob): Promise<DurableJob> {
    return this.inner.updateJob(job);
  }

  claimNextPendingJob(types?: DurableJobType[], now?: Date): Promise<DurableJob | null> {
    return this.inner.claimNextPendingJob(types, now);
  }

  listJobs(filter?: {
    type?: DurableJobType;
    status?: JobStatus;
    limit?: number;
  }): Promise<DurableJob[]> {
    return this.inner.listJobs(filter);
  }

  createDeadLetter(deadLetter: DeadLetter): Promise<DeadLetter> {
    return this.inner.createDeadLetter(deadLetter);
  }

  getDeadLetter(deadLetterId: string): Promise<DeadLetter | null> {
    return this.inner.getDeadLetter(deadLetterId);
  }

  listDeadLetters(filter?: {
    jobType?: DurableJobType;
    status?: DeadLetterStatus;
    limit?: number;
  }): Promise<DeadLetter[]> {
    return this.inner.listDeadLetters(filter);
  }

  updateDeadLetter(deadLetter: DeadLetter): Promise<DeadLetter> {
    return this.inner.updateDeadLetter(deadLetter);
  }

  getReceiptCheckpoint(streamId: string): Promise<ReceiptCheckpoint | null> {
    return this.inner.getReceiptCheckpoint(streamId);
  }

  setReceiptCheckpoint(checkpoint: ReceiptCheckpoint): Promise<ReceiptCheckpoint> {
    return this.inner.setReceiptCheckpoint(checkpoint);
  }

  async getInvite(code: string): Promise<Invite | null> {
    const raw = await this.inner.getInvite(code);
    return raw ? validateRecord<Invite>("invite", raw) : null;
  }

  setInvite(invite: Invite): Promise<Invite> {
    return this.inner.setInvite(versionRecord("invite", invite));
  }

  async listInvites(): Promise<Invite[]> {
    const raw = await this.inner.listInvites();
    return raw.map((r) => validateRecord<Invite>("invite", r));
  }

  async getFeedbackReport(reportId: string): Promise<FeedbackReport | null> {
    const raw = await this.inner.getFeedbackReport(reportId);
    return raw ? validateRecord<FeedbackReport>("feedbackReport", raw) : null;
  }

  createFeedbackReport(report: FeedbackReport): Promise<FeedbackReport> {
    return this.inner.createFeedbackReport(versionRecord("feedbackReport", report));
  }

  updateFeedbackReport(report: FeedbackReport): Promise<FeedbackReport> {
    return this.inner.updateFeedbackReport(versionRecord("feedbackReport", report));
  }

  async listFeedbackReports(filter?: {
    status?: FeedbackStatus;
    category?: FeedbackCategory;
    limit?: number;
    after?: string;
  }): Promise<FeedbackReport[]> {
    const raw = await this.inner.listFeedbackReports(filter);
    return raw.map((r) => validateRecord<FeedbackReport>("feedbackReport", r));
  }

  reset(): void {
    this.inner.reset?.();
  }
}

// ---------------------------------------------------------------------------
// Bounded retry policy for repository operations
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 200,
};

const RETRY_SAFE_OPERATIONS = new Set<string>([
  "getPolicy",
  "getPolicyWriteIntent",
  "getLifecycleAnchor",
  "getSenderRule",
  "getSenderRuleRecord",
  "listSenderRuleRecords",
  "getSenderRuleWriteIntent",
  "listSenderRuleWriteIntents",
  "getPostage",
  "getReceipt",
  "getIdempotencyRecord",
  "getRelayQueueDepth",
  "getRelayRetryCount",
  "getRelayLastSuccessfulDelivery",
  "getRelayLastFailedDelivery",
  "getRelayDeadLetterCount",
  "getCounter",
  "setPolicy",
  "setPolicyWriteIntent",
  "setLifecycleAnchor",
  "setSenderRule",
  "setSenderRuleRecord",
  "deleteSenderRuleRecord",
  "compareAndSetSenderRule",
  "compareAndSetSenderRuleRecord",
  "setSenderRuleWriteIntent",
  "setPostage",
  "setReceipt",
  "createReceiptIfAbsent",
  "markReceiptRead",
  "setIdempotencyRecord",
  "transitionPostage",
  "getUserById",
  "getUserByEmail",
  "getUserByUsername",
  "getUserByAddress",
  "getProfile",
  "setProfile",
  "getCredential",
  "setCredential",
  "getSession",
  "updateSession",
  "getRetiredSession",
  "getEnvelope",
  "getProvisioningRecord",
  "getUsernameReservation",
  "getWallet",
  "releaseUsernameReservation",
  "initializePolicyIfAbsent",
  "getOnboardingDraft",
  "getActiveVerificationToken",
  "invalidateActiveVerificationToken",
  "listRecipientEnvelopes",
  "searchMailbox",
  "getExternalWallets",
  "findExternalWalletOwner",
  "getVerificationToken",
  "getWalletChallenge",
  "getManagedWallet",
  "setManagedWallet",
  "getFundingOperation",
  "setFundingOperation",
  "listFundingOperations",
  "listContacts",
  "getContact",
  "listDrafts",
  "getDraft",
  "updateDraft",
  "deleteDraft",
  "getJob",
  "getJobByIdempotencyKey",
  "listJobs",
  "getDeadLetter",
  "listDeadLetters",
  "updateDeadLetter",
  "getReceiptCheckpoint",
  "setReceiptCheckpoint",
  "getSendOperation",
  "setSendOperation",
  "createSendOperationIfAbsent",
  "getRecoveryCodeSet",
  "getInvite",
  "setInvite",
  "listInvites",
]);

function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) return error.retryable;
  return true;
}

function calculateBackoff(attempt: number, policy: RetryPolicy): number {
  const exponentialDelay = policy.baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * policy.baseDelayMs * 0.5;
  return exponentialDelay + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps any ApiRepository with a bounded retry policy.
 *
 * Only operations classified as retry-safe are retried automatically.
 * Unsafe writes (insertPostage, acquireIdempotencyRecord, incrementCounter,
 * reset) are never retried. Retries use exponential backoff with jitter.
 * On exhaustion, a stable {@link RetryExhaustedError} is thrown.
 */
export class RetryableApiRepository implements ApiRepository {
  private readonly inner: ApiRepository;
  private readonly policy: RetryPolicy;

  constructor(inner: ApiRepository, policy: RetryPolicy = DEFAULT_RETRY_POLICY) {
    this.inner = inner;
    this.policy = policy;
  }

  private async withRetry<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!RETRY_SAFE_OPERATIONS.has(operation)) {
      return fn();
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error)) {
          throw error;
        }
        if (attempt < this.policy.maxAttempts) {
          await sleep(calculateBackoff(attempt, this.policy));
        }
      }
    }
    throw new RetryExhaustedError(lastError);
  }

  getPolicy(owner: string): Promise<MailboxPolicy | null> {
    return this.withRetry("getPolicy", () => this.inner.getPolicy(owner));
  }

  setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy> {
    return this.withRetry("setPolicy", () => this.inner.setPolicy(owner, policy));
  }

  getPolicyWriteIntent(owner: string): Promise<PolicyWriteIntent | null> {
    return this.withRetry("getPolicyWriteIntent", () => this.inner.getPolicyWriteIntent(owner));
  }

  setPolicyWriteIntent(intent: PolicyWriteIntent): Promise<PolicyWriteIntent> {
    return this.withRetry("setPolicyWriteIntent", () => this.inner.setPolicyWriteIntent(intent));
  }

  getLifecycleAnchor(messageId: string): Promise<LifecycleAnchor | null> {
    return this.withRetry("getLifecycleAnchor", () => this.inner.getLifecycleAnchor(messageId));
  }

  setLifecycleAnchor(anchor: LifecycleAnchor): Promise<LifecycleAnchor> {
    return this.withRetry("setLifecycleAnchor", () => this.inner.setLifecycleAnchor(anchor));
  }

  getSenderRule(owner: string, sender: string): Promise<SenderRule> {
    return this.withRetry("getSenderRule", () => this.inner.getSenderRule(owner, sender));
  }

  setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule> {
    return this.withRetry("setSenderRule", () => this.inner.setSenderRule(owner, sender, rule));
  }

  // BETA-037 (Issue #1944): versioned sender rule records
  getSenderRuleRecord(owner: string, sender: string): Promise<SenderRuleRecord | null> {
    return this.withRetry("getSenderRuleRecord", () =>
      this.inner.getSenderRuleRecord(owner, sender),
    );
  }

  setSenderRuleRecord(record: SenderRuleRecord): Promise<SenderRuleRecord> {
    return this.withRetry("setSenderRuleRecord", () => this.inner.setSenderRuleRecord(record));
  }

  deleteSenderRuleRecord(owner: string, sender: string): Promise<boolean> {
    return this.withRetry("deleteSenderRuleRecord", () =>
      this.inner.deleteSenderRuleRecord(owner, sender),
    );
  }

  listSenderRuleRecords(
    owner: string,
    options?: { limit?: number; after?: string },
  ): Promise<{ records: SenderRuleRecord[]; nextCursor?: string }> {
    return this.withRetry("listSenderRuleRecords", () =>
      this.inner.listSenderRuleRecords(owner, options),
    );
  }

  compareAndSetSenderRule(
    owner: string,
    sender: string,
    rule: SenderRule,
    expectedVersion?: number,
    now?: Date,
  ): Promise<CompareSetSenderRuleResult> {
    return this.withRetry("compareAndSetSenderRule", () =>
      this.inner.compareAndSetSenderRule(owner, sender, rule, expectedVersion, now),
    );
  }

  compareAndSetSenderRuleRecord(
    input: CompareSetSenderRuleRecordInput,
    expectedVersion?: number,
    now?: Date,
  ): Promise<CompareSetSenderRuleResult> {
    return this.withRetry("compareAndSetSenderRuleRecord", () =>
      this.inner.compareAndSetSenderRuleRecord(input, expectedVersion, now),
    );
  }

  getSenderRuleWriteIntent(owner: string, sender: string): Promise<SenderRuleWriteIntent | null> {
    return this.withRetry("getSenderRuleWriteIntent", () =>
      this.inner.getSenderRuleWriteIntent(owner, sender),
    );
  }

  setSenderRuleWriteIntent(intent: SenderRuleWriteIntent): Promise<SenderRuleWriteIntent> {
    return this.withRetry("setSenderRuleWriteIntent", () =>
      this.inner.setSenderRuleWriteIntent(intent),
    );
  }

  listSenderRuleWriteIntents(owner: string): Promise<SenderRuleWriteIntent[]> {
    return this.withRetry("listSenderRuleWriteIntents", () =>
      this.inner.listSenderRuleWriteIntents(owner),
    );
  }

  getPostage(messageId: string): Promise<Postage | null> {
    return this.withRetry("getPostage", () => this.inner.getPostage(messageId));
  }

  setPostage(postage: Postage): Promise<Postage> {
    return this.withRetry("setPostage", () => this.inner.setPostage(postage));
  }

  transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult> {
    return this.withRetry("transitionPostage", () =>
      this.inner.transitionPostage(messageId, expectedStatus, nextStatus),
    );
  }

  insertPostage(postage: Postage): Promise<Postage> {
    return this.inner.insertPostage(postage);
  }

  getReceipt(messageId: string): Promise<Receipt | null> {
    return this.withRetry("getReceipt", () => this.inner.getReceipt(messageId));
  }

  setReceipt(receipt: Receipt): Promise<Receipt> {
    return this.withRetry("setReceipt", () => this.inner.setReceipt(receipt));
  }

  getMessageDeliveryStatus(messageId: string): Promise<MessageDeliveryStatusRecord | null> {
    return this.withRetry("getMessageDeliveryStatus", () =>
      this.inner.getMessageDeliveryStatus(messageId),
    );
  }

  setMessageDeliveryStatus(
    record: MessageDeliveryStatusRecord,
  ): Promise<MessageDeliveryStatusRecord> {
    return this.withRetry("setMessageDeliveryStatus", () =>
      this.inner.setMessageDeliveryStatus(record),
    );
  }

  createReceiptIfAbsent(receipt: Receipt): Promise<{ created: boolean; receipt: Receipt }> {
    return this.withRetry("createReceiptIfAbsent", () => this.inner.createReceiptIfAbsent(receipt));
  }

  markReceiptRead(messageId: string, actor: string, now?: Date): Promise<MarkReceiptReadResult> {
    return this.withRetry("markReceiptRead", () =>
      this.inner.markReceiptRead(messageId, actor, now),
    );
  }

  acquireIdempotencyRecord(
    key: string,
    requestDigest: string,
    leaseMs: number,
  ): Promise<AcquireIdempotencyResult> {
    return this.inner.acquireIdempotencyRecord(key, requestDigest, leaseMs);
  }

  getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    return this.withRetry("getIdempotencyRecord", () => this.inner.getIdempotencyRecord(key));
  }

  setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    return this.withRetry("setIdempotencyRecord", () =>
      this.inner.setIdempotencyRecord(key, record),
    );
  }

  getUserById(userId: string): Promise<User | null> {
    return this.withRetry("getUserById", () => this.inner.getUserById(userId));
  }

  getUserByEmail(email: string): Promise<User | null> {
    return this.withRetry("getUserByEmail", () => this.inner.getUserByEmail(email));
  }

  getUserByUsername(username: string): Promise<User | null> {
    return this.withRetry("getUserByUsername", () => this.inner.getUserByUsername(username));
  }

  getUserByAddress(address: string): Promise<User | null> {
    return this.withRetry("getUserByAddress", () => this.inner.getUserByAddress(address));
  }

  createUser(user: User, credential?: Credential, profile?: Profile): Promise<User> {
    return this.inner.createUser(user, credential, profile);
  }

  updateUser(user: User, expectedVersion: number): Promise<UpdateUserResult> {
    return this.inner.updateUser(user, expectedVersion);
  }

  getProfile(userId: string): Promise<Profile | null> {
    return this.withRetry("getProfile", () => this.inner.getProfile(userId));
  }

  setProfile(profile: Profile): Promise<Profile> {
    return this.withRetry("setProfile", () => this.inner.setProfile(profile));
  }

  getCredential(userId: string): Promise<Credential | null> {
    return this.withRetry("getCredential", () => this.inner.getCredential(userId));
  }

  setCredential(credential: Credential): Promise<Credential> {
    return this.withRetry("setCredential", () => this.inner.setCredential(credential));
  }

  getAccountDeletionRequest(userId: string): Promise<AccountDeletionRequest | null> {
    return this.withRetry("getAccountDeletionRequest", () =>
      this.inner.getAccountDeletionRequest(userId),
    );
  }

  setAccountDeletionRequest(request: AccountDeletionRequest): Promise<AccountDeletionRequest> {
    return this.inner.setAccountDeletionRequest(request);
  }

  exportAccount(userId: string, address: string, now?: Date): Promise<AccountExport> {
    return this.withRetry("exportAccount", () => this.inner.exportAccount(userId, address, now));
  }

  deleteAccountData(userId: string, address: string, now?: Date) {
    return this.inner.deleteAccountData(userId, address, now);
  }

  // BETA-014: retry-safe reads + idempotent compensation are retried; the
  // single-winner writes (reserve, createWallet, setProvisioningRecord) never
  // are, so a half-applied claim can never be double-applied by this wrapper.
  getProvisioningRecord(userId: string): Promise<ProvisioningRecord | null> {
    return this.withRetry("getProvisioningRecord", () => this.inner.getProvisioningRecord(userId));
  }

  createProvisioningRecord(
    record: ProvisioningRecord,
  ): Promise<{ created: boolean; record: ProvisioningRecord }> {
    // Never retry: an insert-once initialization must not be re-applied after
    // a client-side timeout (the stored record would be authoritative).
    return this.inner.createProvisioningRecord(record);
  }

  setProvisioningRecord(
    record: ProvisioningRecord,
    expectedVersion: number,
  ): Promise<UpdateProvisioningResult> {
    return this.inner.setProvisioningRecord(record, expectedVersion);
  }

  reserveUsername(
    username: string,
    userId: string,
    leaseMs: number,
  ): Promise<UsernameReservationResult> {
    return this.inner.reserveUsername(username, userId, leaseMs);
  }

  getUsernameReservation(username: string): Promise<UsernameReservation | null> {
    return this.withRetry("getUsernameReservation", () =>
      this.inner.getUsernameReservation(username),
    );
  }

  releaseUsernameReservation(username: string, userId: string): Promise<boolean> {
    return this.withRetry("releaseUsernameReservation", () =>
      this.inner.releaseUsernameReservation(username, userId),
    );
  }

  getWallet(userId: string): Promise<Wallet | null> {
    return this.withRetry("getWallet", () => this.inner.getWallet(userId));
  }

  createWallet(wallet: Wallet): Promise<WalletCreationResult> {
    return this.inner.createWallet(wallet);
  }

  initializePolicyIfAbsent(
    owner: string,
    policy: MailboxPolicy,
  ): Promise<{ created: boolean; policy: MailboxPolicy }> {
    return this.withRetry("initializePolicyIfAbsent", () =>
      this.inner.initializePolicyIfAbsent(owner, policy),
    );
  }

  getOnboardingDraft(userId: string): Promise<OnboardingDraftRecord | null> {
    return this.withRetry("getOnboardingDraft", () => this.inner.getOnboardingDraft(userId));
  }

  saveOnboardingDraft(record: OnboardingDraftRecord): Promise<OnboardingDraftRecord> {
    // Never retried: the upsert is idempotent (one record per user) but a
    // client-side timeout must not re-apply a newer draft over a stale one.
    return this.inner.saveOnboardingDraft(record);
  }

  getSession(sessionId: string): Promise<Session | null> {
    return this.withRetry("getSession", () => this.inner.getSession(sessionId));
  }

  createSession(session: Session): Promise<Session> {
    return this.inner.createSession(session);
  }

  updateSession(session: Session): Promise<Session> {
    return this.withRetry("updateSession", () => this.inner.updateSession(session));
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.inner.deleteSession(sessionId);
  }

  deleteUserSessions(userId: string): Promise<void> {
    return this.inner.deleteUserSessions(userId);
  }

  listUserSessions(userId: string): Promise<Session[]> {
    return this.withRetry("listUserSessions", () => this.inner.listUserSessions(userId));
  }

  deleteOtherUserSessions(userId: string, currentSessionId: string): Promise<void> {
    return this.inner.deleteOtherUserSessions(userId, currentSessionId);
  }

  getRetiredSession(sessionId: string): Promise<RetiredSession | null> {
    return this.withRetry("getRetiredSession", () => this.inner.getRetiredSession(sessionId));
  }

  createRetiredSession(retiredSession: RetiredSession): Promise<RetiredSession> {
    return this.inner.createRetiredSession(retiredSession);
  }

  getVerificationToken(tokenHash: string): Promise<VerificationToken | null> {
    return this.withRetry("getVerificationToken", () => this.inner.getVerificationToken(tokenHash));
  }

  getActiveVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationToken | null> {
    return this.withRetry("getActiveVerificationToken", () =>
      this.inner.getActiveVerificationToken(userId, purpose),
    );
  }

  issueVerificationToken(
    token: VerificationToken,
    now: Date,
  ): Promise<IssueVerificationTokenResult> {
    return this.inner.issueVerificationToken(token, now);
  }

  consumeVerificationToken(tokenHash: string, now: Date): Promise<ConsumeVerificationTokenResult> {
    return this.inner.consumeVerificationToken(tokenHash, now);
  }

  recordVerificationAttempt(
    tokenHash: string,
    now: Date,
  ): Promise<RecordVerificationAttemptResult> {
    return this.inner.recordVerificationAttempt(tokenHash, now);
  }

  invalidateActiveVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
    now: Date,
  ): Promise<void> {
    return this.withRetry("invalidateActiveVerificationToken", () =>
      this.inner.invalidateActiveVerificationToken(userId, purpose, now),
    );
  }

  getRelayQueueDepth(relayId: string): Promise<number> {
    return this.withRetry("getRelayQueueDepth", () => this.inner.getRelayQueueDepth(relayId));
  }

  getRelayRetryCount(relayId: string): Promise<number> {
    return this.withRetry("getRelayRetryCount", () => this.inner.getRelayRetryCount(relayId));
  }

  getRelayLastSuccessfulDelivery(relayId: string): Promise<string | null> {
    return this.withRetry("getRelayLastSuccessfulDelivery", () =>
      this.inner.getRelayLastSuccessfulDelivery(relayId),
    );
  }

  getRelayLastFailedDelivery(relayId: string): Promise<string | null> {
    return this.withRetry("getRelayLastFailedDelivery", () =>
      this.inner.getRelayLastFailedDelivery(relayId),
    );
  }

  getRelayDeadLetterCount(relayId: string): Promise<number> {
    return this.withRetry("getRelayDeadLetterCount", () =>
      this.inner.getRelayDeadLetterCount(relayId),
    );
  }

  getCounter(key: string): Promise<number> {
    return this.withRetry("getCounter", () => this.inner.getCounter(key));
  }

  incrementCounter(key: string, windowSeconds: number, amount?: number): Promise<number> {
    return this.inner.incrementCounter(key, windowSeconds, amount);
  }

  // Issue #1936: reads are retry-safe; inserts are not (insert-once semantics).
  getEnvelope(messageId: string): Promise<StoredEnvelope | null> {
    return this.withRetry("getEnvelope", () => this.inner.getEnvelope(messageId));
  }

  getRecoveryCodeSet(userId: string): Promise<RecoveryCodeSet | null> {
    // Read-only: a stale read is harmless (and eventually consistent), so
    // transient failures are retried.
    return this.withRetry("getRecoveryCodeSet", () => this.inner.getRecoveryCodeSet(userId));
  }

  setRecoveryCodeSet(
    set: RecoveryCodeSet,
    expectedVersion: number,
  ): Promise<UpdateRecoveryCodeSetResult> {
    // Never retried automatically: the CAS version is authoritative, and a
    // transparent retry could double-bump the version or mask a legitimate
    // conflict. The caller owns the read-check-write cycle (issue #1917).
    return this.inner.setRecoveryCodeSet(set, expectedVersion);
  }

  insertEnvelope(envelope: StoredEnvelope): Promise<InsertEnvelopeResult> {
    // Never retry: a partial insert could succeed server-side but time out
    // client-side. On retry, the stored record would be the authoritative one
    // and the outcome would be "duplicate" (byte-equal) or "conflict" (different
    // bytes). Callers should handle those outcomes explicitly.
    return this.inner.insertEnvelope(envelope);
  }
  getSenderRequest(requestId: string) {
    return this.withRetry("getSenderRequest", () => this.inner.getSenderRequest(requestId));
  }
  listSenderRequests(recipient: string, status?: "pending") {
    return this.withRetry("listSenderRequests", () =>
      this.inner.listSenderRequests(recipient, status),
    );
  }
  createSenderRequestIfAbsent(request: UnknownSenderRequest) {
    return this.inner.createSenderRequestIfAbsent(request);
  }
  transitionSenderRequest(
    requestId: string,
    recipient: string,
    decision: UnknownSenderDecision,
    now?: Date,
  ) {
    return this.inner.transitionSenderRequest(requestId, recipient, decision, now);
  }

  listRecipientEnvelopes(
    recipient: string,
    options?: MailboxQueryOptions,
  ): Promise<Page<StoredEnvelope>> {
    return this.withRetry("listRecipientEnvelopes", () =>
      this.inner.listRecipientEnvelopes(recipient, options),
    );
  }

  tombstoneEnvelope(messageId: string, recipient: string): Promise<StoredEnvelope> {
    return this.inner.tombstoneEnvelope(messageId, recipient);
  }

  updateEnvelopeStatus(
    messageId: string,
    status: import("./domain").MailboxItemStatus,
  ): Promise<StoredEnvelope> {
    return this.inner.updateEnvelopeStatus(messageId, status);
  }

  patchMailboxFlags(
    messageId: string,
    recipient: string,
    patch: MailboxFlagsPatch,
  ): Promise<StoredEnvelope> {
    return this.inner.patchMailboxFlags(messageId, recipient, patch);
  }

  searchMailbox(actor: string, options?: SearchMailboxQueryOptions): Promise<Page<StoredEnvelope>> {
    return this.withRetry("searchMailbox", () => this.inner.searchMailbox(actor, options));
  }

  getExternalWallets(owner: string): Promise<ExternalWallet[]> {
    return this.withRetry("getExternalWallets", () => this.inner.getExternalWallets(owner));
  }

  setExternalWallet(owner: string, wallet: ExternalWallet): Promise<ExternalWallet> {
    return this.inner.setExternalWallet(owner, wallet);
  }

  removeExternalWallet(owner: string, address: string): Promise<void> {
    return this.inner.removeExternalWallet(owner, address);
  }

  findExternalWalletOwner(address: string): Promise<string | null> {
    return this.withRetry("findExternalWalletOwner", () =>
      this.inner.findExternalWalletOwner(address),
    );
  }

  getWalletChallenge(owner: string, address: string): Promise<ExternalWalletChallenge | null> {
    return this.withRetry("getWalletChallenge", () =>
      this.inner.getWalletChallenge(owner, address),
    );
  }

  setWalletChallenge(
    owner: string,
    address: string,
    challenge: ExternalWalletChallenge,
  ): Promise<void> {
    return this.inner.setWalletChallenge(owner, address, challenge);
  }

  deleteWalletChallenge(owner: string, address: string): Promise<void> {
    return this.inner.deleteWalletChallenge(owner, address);
  }

  getKeyDirectory(owner: string): Promise<KeyDirectoryRecord | null> {
    return this.withRetry("getKeyDirectory", () => this.inner.getKeyDirectory(owner));
  }

  getPublishedKey(owner: string, keyId: string): Promise<PublishedKey | null> {
    return this.withRetry("getPublishedKey", () => this.inner.getPublishedKey(owner, keyId));
  }

  savePublishedKey(owner: string, key: PublishedKey): Promise<PublishedKey> {
    return this.withRetry("savePublishedKey", () => this.inner.savePublishedKey(owner, key));
  }

  saveKeyDirectory(record: KeyDirectoryRecord): Promise<KeyDirectoryRecord> {
    return this.withRetry("saveKeyDirectory", () => this.inner.saveKeyDirectory(record));
  }

  getManagedWallet(userId: string): Promise<ManagedWalletRecord | null> {
    return this.withRetry("getManagedWallet", () => this.inner.getManagedWallet(userId));
  }

  setManagedWallet(wallet: ManagedWalletRecord): Promise<ManagedWalletRecord> {
    return this.withRetry("setManagedWallet", () => this.inner.setManagedWallet(wallet));
  }

  createManagedWalletIfAbsent(wallet: ManagedWalletRecord): Promise<CreateManagedWalletResult> {
    return this.inner.createManagedWalletIfAbsent(wallet);
  }

  getFundingOperation(operationId: string): Promise<FundingOperation | null> {
    return this.withRetry("getFundingOperation", () => this.inner.getFundingOperation(operationId));
  }

  setFundingOperation(operation: FundingOperation): Promise<FundingOperation> {
    return this.withRetry("setFundingOperation", () => this.inner.setFundingOperation(operation));
  }

  createFundingOperationIfAbsent(
    operation: FundingOperation,
  ): Promise<{ created: boolean; operation: FundingOperation }> {
    return this.inner.createFundingOperationIfAbsent(operation);
  }

  listFundingOperations(filter?: {
    status?: FundingOperation["status"];
    limit?: number;
  }): Promise<FundingOperation[]> {
    return this.withRetry("listFundingOperations", () => this.inner.listFundingOperations(filter));
  }

  listContacts(owner: string, options?: ContactQueryOptions): Promise<Page<Contact>> {
    return this.withRetry("listContacts", () => this.inner.listContacts(owner, options));
  }

  getContact(owner: string, contactId: string): Promise<Contact | null> {
    return this.withRetry("getContact", () => this.inner.getContact(owner, contactId));
  }

  createContact(contact: Contact): Promise<Contact> {
    return this.inner.createContact(contact);
  }

  updateContact(contact: Contact, expectedVersion: number): Promise<UpdateContactResult> {
    return this.withRetry("updateContact", () =>
      this.inner.updateContact(contact, expectedVersion),
    );
  }

  deleteContact(owner: string, contactId: string): Promise<void> {
    return this.withRetry("deleteContact", () => this.inner.deleteContact(owner, contactId));
  }

  // ---------------------------------------------------------------------------
  // Issue #1965 (BETA-058) — Live drafts CRUD
  // ---------------------------------------------------------------------------
  listDrafts(owner: string, options?: DraftQueryOptions): Promise<Page<DraftRecord>> {
    return this.withRetry("listDrafts", () => this.inner.listDrafts(owner, options));
  }

  getDraft(owner: string, draftId: string): Promise<DraftRecord | null> {
    return this.withRetry("getDraft", () => this.inner.getDraft(owner, draftId));
  }

  createDraft(draft: DraftRecord): Promise<DraftRecord> {
    return this.inner.createDraft(draft);
  }

  updateDraft(draft: DraftRecord, expectedVersion: number): Promise<UpdateDraftResult> {
    return this.withRetry("updateDraft", () => this.inner.updateDraft(draft, expectedVersion));
  }

  deleteDraft(owner: string, draftId: string): Promise<void> {
    return this.withRetry("deleteDraft", () => this.inner.deleteDraft(owner, draftId));
  }

  // ---------------------------------------------------------------------------
  // Issue #1952 (BETA-045) — Durable jobs, retries, DLQ, and receipt indexing
  // ---------------------------------------------------------------------------
  enqueueJob(job: DurableJob): Promise<{ enqueued: boolean; job: DurableJob }> {
    return this.inner.enqueueJob(job);
  }

  getJob(jobId: string): Promise<DurableJob | null> {
    return this.withRetry("getJob", () => this.inner.getJob(jobId));
  }

  getJobByIdempotencyKey(key: string): Promise<DurableJob | null> {
    return this.withRetry("getJobByIdempotencyKey", () => this.inner.getJobByIdempotencyKey(key));
  }

  updateJob(job: DurableJob): Promise<DurableJob> {
    return this.inner.updateJob(job);
  }

  claimNextPendingJob(types?: DurableJobType[], now?: Date): Promise<DurableJob | null> {
    return this.inner.claimNextPendingJob(types, now);
  }

  listJobs(filter?: {
    type?: DurableJobType;
    status?: JobStatus;
    limit?: number;
  }): Promise<DurableJob[]> {
    return this.withRetry("listJobs", () => this.inner.listJobs(filter));
  }

  createDeadLetter(deadLetter: DeadLetter): Promise<DeadLetter> {
    return this.inner.createDeadLetter(deadLetter);
  }

  getDeadLetter(deadLetterId: string): Promise<DeadLetter | null> {
    return this.withRetry("getDeadLetter", () => this.inner.getDeadLetter(deadLetterId));
  }

  listDeadLetters(filter?: {
    jobType?: DurableJobType;
    status?: DeadLetterStatus;
    limit?: number;
  }): Promise<DeadLetter[]> {
    return this.withRetry("listDeadLetters", () => this.inner.listDeadLetters(filter));
  }

  updateDeadLetter(deadLetter: DeadLetter): Promise<DeadLetter> {
    return this.withRetry("updateDeadLetter", () => this.inner.updateDeadLetter(deadLetter));
  }

  getReceiptCheckpoint(streamId: string): Promise<ReceiptCheckpoint | null> {
    return this.withRetry("getReceiptCheckpoint", () => this.inner.getReceiptCheckpoint(streamId));
  }

  setReceiptCheckpoint(checkpoint: ReceiptCheckpoint): Promise<ReceiptCheckpoint> {
    return this.withRetry("setReceiptCheckpoint", () =>
      this.inner.setReceiptCheckpoint(checkpoint),
    );
  }

  getSendOperation(messageId: string): Promise<import("./domain").SendOperationState | null> {
    return this.withRetry("getSendOperation", () => this.inner.getSendOperation(messageId));
  }

  setSendOperation(
    state: import("./domain").SendOperationState,
  ): Promise<import("./domain").SendOperationState> {
    return this.withRetry("setSendOperation", () => this.inner.setSendOperation(state));
  }

  createSendOperationIfAbsent(
    state: import("./domain").SendOperationState,
  ): Promise<{ created: boolean; state: import("./domain").SendOperationState }> {
    return this.withRetry("createSendOperationIfAbsent", () =>
      this.inner.createSendOperationIfAbsent(state),
    );
  }

  getInvite(code: string): Promise<Invite | null> {
    return this.withRetry("getInvite", () => this.inner.getInvite(code));
  }

  setInvite(invite: Invite): Promise<Invite> {
    return this.withRetry("setInvite", () => this.inner.setInvite(invite));
  }

  listInvites(): Promise<Invite[]> {
    return this.withRetry("listInvites", () => this.inner.listInvites());
  }

  getFeedbackReport(reportId: string): Promise<FeedbackReport | null> {
    return this.withRetry("getFeedbackReport", () => this.inner.getFeedbackReport(reportId));
  }

  createFeedbackReport(report: FeedbackReport): Promise<FeedbackReport> {
    return this.inner.createFeedbackReport(report);
  }

  updateFeedbackReport(report: FeedbackReport): Promise<FeedbackReport> {
    return this.withRetry("updateFeedbackReport", () => this.inner.updateFeedbackReport(report));
  }

  listFeedbackReports(filter?: {
    status?: FeedbackStatus;
    category?: FeedbackCategory;
    limit?: number;
    after?: string;
  }): Promise<FeedbackReport[]> {
    return this.withRetry("listFeedbackReports", () => this.inner.listFeedbackReports(filter));
  }

  reset(): void {
    this.inner.reset?.();
  }
}

// ---------------------------------------------------------------------------
// Issue #1491: deterministic total ordering for paginated queries
// ---------------------------------------------------------------------------

/**
 * Cursor pagination is only safe over a *total* order. When two records can
 * compare equal, their relative position is left to storage-engine chance, so
 * a client walking pages can see the same record twice or never see it at all.
 * Every paginated repository method therefore declares its sort fields plus a
 * unique tie-breaker, and continuation positions carry the complete sort key
 * rather than just the primary value.
 *
 * The guarantees are documented in `docs/api/PAGINATION.md`.
 */

export type SortDirection = "asc" | "desc";

export interface SortKey<T> {
  readonly field: keyof T & string;
  readonly direction: SortDirection;
}

export interface OrderingSpec<T> {
  /**
   * Sort keys, most significant first. The final key is always the
   * tie-breaker, so the order is total.
   */
  readonly keys: readonly SortKey<T>[];
  /** Field that is unique across the collection. */
  readonly tieBreaker: keyof T & string;
}

/**
 * Declares the total order for a paginated query.
 *
 * `primaryKeys` are the meaningful sort fields, most significant first;
 * `tieBreaker` is a field that is unique across the collection and is appended
 * as the least significant key. The tie-breaker inherits the direction of the
 * last primary key, so a page walk never reverses direction mid-key.
 *
 * Throws when the declaration cannot produce a total order. Registered
 * orderings are declared at module scope, so a malformed one fails at startup
 * rather than silently returning non-deterministic pages.
 */
export function declareOrdering<T>(
  primaryKeys: readonly SortKey<T>[],
  tieBreaker: keyof T & string,
): OrderingSpec<T> {
  if (typeof tieBreaker !== "string" || tieBreaker.length === 0) {
    throw new RangeError("A paginated ordering requires a non-empty tie-breaker field");
  }

  const seen = new Set<string>();
  for (const key of primaryKeys) {
    if (typeof key.field !== "string" || key.field.length === 0) {
      throw new RangeError("A paginated ordering requires non-empty sort field names");
    }
    if (key.field === tieBreaker) {
      throw new RangeError(
        `Sort field "${key.field}" is already the tie-breaker and must not be declared twice`,
      );
    }
    if (seen.has(key.field)) {
      throw new RangeError(`Sort field "${key.field}" is declared more than once`);
    }
    seen.add(key.field);
  }

  const direction = primaryKeys.at(-1)?.direction ?? "asc";
  return {
    keys: [...primaryKeys, { field: tieBreaker, direction }],
    tieBreaker,
  };
}

/**
 * Total order over the value types these records store. Nullish values sort
 * after defined ones so an optional field cannot make two records compare
 * equal on a technicality; anything else is a programming error and throws
 * rather than silently degrading the order.
 */
function compareValues(left: unknown, right: unknown): number {
  const leftMissing = left === null || left === undefined;
  const rightMissing = right === null || right === undefined;
  if (leftMissing || rightMissing) {
    if (leftMissing && rightMissing) return 0;
    return leftMissing ? 1 : -1;
  }

  if (typeof left === "string" && typeof right === "string") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === "bigint" && typeof right === "bigint") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return left === right ? 0 : left ? 1 : -1;
  }

  throw new TypeError(
    `Sort values must be comparable scalars of the same type, received ${typeof left} and ${typeof right}`,
  );
}

function compareTuples<T>(
  left: readonly unknown[],
  right: readonly unknown[],
  spec: OrderingSpec<T>,
): number {
  for (let index = 0; index < spec.keys.length; index += 1) {
    const comparison = compareValues(left[index], right[index]);
    if (comparison !== 0) {
      return spec.keys[index].direction === "desc" ? -comparison : comparison;
    }
  }
  return 0;
}

function sortValuesOf<T>(spec: OrderingSpec<T>, record: T): unknown[] {
  return spec.keys.map((key) => (record as Record<string, unknown>)[key.field]);
}

/** Comparator implementing the declared total order. */
export function compareByOrdering<T>(spec: OrderingSpec<T>): (left: T, right: T) => number {
  return (left, right) => compareTuples(sortValuesOf(spec, left), sortValuesOf(spec, right), spec);
}

/** Returns a new array ordered by the declared total order. */
export function sortByOrdering<T>(records: readonly T[], spec: OrderingSpec<T>): T[] {
  return [...records].sort(compareByOrdering(spec));
}

/**
 * Serializes the **complete** continuation key: every declared sort value in
 * declaration order, including the tie-breaker. A cursor built from this names
 * an absolute position in the total order, so a tie on the primary field
 * cannot make the server resume at the wrong record.
 */
export function continuationKeyOf<T>(spec: OrderingSpec<T>, record: T): string {
  return JSON.stringify(sortValuesOf(spec, record));
}

/** Decodes a continuation key, rejecting one that does not match the ordering. */
export function parseContinuationKey<T>(spec: OrderingSpec<T>, key: string): unknown[] {
  let values: unknown;
  try {
    values = JSON.parse(key);
  } catch {
    throw new ApiError(400, "bad_request", "Invalid pagination continuation key");
  }
  if (!Array.isArray(values) || values.length !== spec.keys.length) {
    throw new ApiError(400, "bad_request", "Pagination continuation key does not match this query");
  }
  return values;
}

export interface PaginateOptions {
  /** Maximum number of records to return. */
  readonly limit: number;
  /** Continuation key of the last record on the previous page. */
  readonly after?: string;
}

export interface Page<T> {
  readonly items: T[];
  /** Continuation key for the next page, or null when the walk is complete. */
  readonly nextContinuationKey: string | null;
}

/**
 * Applies the declared ordering and returns one page, resuming strictly after
 * the supplied continuation position.
 *
 * Because that position is absolute rather than an offset, a record inserted
 * or deleted elsewhere in the collection between page fetches never shifts the
 * remaining pages: a record that exists unchanged for the whole walk is
 * returned exactly once.
 */
export function paginate<T>(
  records: readonly T[],
  spec: OrderingSpec<T>,
  options: PaginateOptions,
): Page<T> {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
    throw new RangeError("Pagination limit must be a positive integer");
  }

  const ordered = sortByOrdering(records, spec);
  let remaining = ordered;
  if (options.after !== undefined) {
    const after = parseContinuationKey(spec, options.after);
    remaining = ordered.filter(
      (record) => compareTuples(sortValuesOf(spec, record), after, spec) > 0,
    );
  }

  const items = remaining.slice(0, options.limit);
  const hasMore = remaining.length > items.length;
  const last = items.at(-1);

  return {
    items,
    nextContinuationKey: hasMore && last !== undefined ? continuationKeyOf(spec, last) : null,
  };
}

/**
 * Declared ordering for every paginated repository method, keyed by method
 * name. A paginated method resolves its ordering through
 * {@link orderingForPaginatedMethod}, so it cannot ship without one.
 */
export const PAGINATED_QUERY_ORDERINGS = {
  listPostage: declareOrdering<Postage>([{ field: "createdAt", direction: "desc" }], "messageId"),
  listReceipts: declareOrdering<Receipt>(
    [{ field: "deliveredAt", direction: "desc" }],
    "messageId",
  ),
  /**
   * Issue #1936: Recipient-indexed envelope listing.
   * Ordered by insertion time descending so a mailbox sync walk returns the
   * newest messages first. The tie-breaker is messageId so the walk is stable
   * even when two envelopes share the exact same createdAt millisecond.
   * recipientId is NOT a sort key here — callers filter by recipientId before
   * passing the collection to `paginate`, keeping plaintext out of the ordering.
   */
  listEnvelopes: declareOrdering<StoredEnvelope>(
    [{ field: "createdAt", direction: "desc" }],
    "messageId",
  ),
  /**
   * Issue #1973 (BETA-066): Owner-scoped contact listing.
   * Ordered by creation time descending (newest first); contactId is the
   * unique tie-breaker so the walk is stable. Callers filter by owner and the
   * optional search query before passing the collection to `paginate`.
   */
  listContacts: declareOrdering<Contact>([{ field: "createdAt", direction: "desc" }], "contactId"),
  /**
   * Issue #1965 (BETA-058): Owner-scoped draft listing.
   * Ordered by updated time descending (most recently edited first); draftId is the
   * unique tie-breaker so the walk is stable.
   */
  listDrafts: declareOrdering<DraftRecord>([{ field: "updatedAt", direction: "desc" }], "draftId"),
  /**
   * Issue #1972 (BETA-065): Actor-scoped mailbox search listing.
   * Ordered by creation time descending (newest first); messageId is the
   * unique tie-breaker so pagination is stable.
   */
  searchMailbox: declareOrdering<StoredEnvelope>(
    [{ field: "createdAt", direction: "desc" }],
    "messageId",
  ),
} as const;

export type PaginatedQueryName = keyof typeof PAGINATED_QUERY_ORDERINGS;

/** Resolves a declared ordering, failing loudly when a method has none. */
export function orderingForPaginatedMethod<T>(method: string): OrderingSpec<T> {
  const spec = (PAGINATED_QUERY_ORDERINGS as Record<string, OrderingSpec<unknown>>)[method];
  if (!spec) {
    throw new Error(
      `Paginated repository method "${method}" has no declared ordering. ` +
        "Add one to PAGINATED_QUERY_ORDERINGS with declareOrdering().",
    );
  }
  return spec as OrderingSpec<T>;
}
