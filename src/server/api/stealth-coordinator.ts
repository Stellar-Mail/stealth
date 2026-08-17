import type {
  Credential,
  IdempotencyRecord,
  Postage,
  PostageStatus,
  Profile,
  Receipt,
  RetiredSession,
  Session,
  StoredEnvelope,
  User,
  VerificationPurpose,
  VerificationToken,
} from "./domain";
import type {
  AcquireIdempotencyResult,
  ConsumeVerificationTokenResult,
  InsertEnvelopeResult,
  IssueVerificationTokenResult,
  PostageTransitionResult,
  RecordVerificationAttemptResult,
  UpdateUserResult,
} from "./repository";
import { ApiError } from "./errors";
import { identityRecordFamilies, selectFamilies } from "../migrations/adapters";
import { createDurableObjectMigrationStorage } from "../migrations/durable-object-storage";
import { dryRun, forward, integrityCheck, rollback } from "../migrations/runner";
import type { MigrationCommand, MigrationReport, MigrationRunOptions } from "../migrations/types";

const DurableObjectBase: any = import.meta.env.PROD
  ? (await import("cloudflare:workers")).DurableObject
  : class {
      ctx: any;
      env: any;
      constructor(ctx: any, env: any) {
        this.ctx = ctx;
        this.env = env;
      }
    };

export class StealthCoordinator extends DurableObjectBase {
  // Per-key serialization for critical sections that must not interleave.
  // A Durable Object instance is a single JS object, but `await`ing a
  // storage call still yields to the microtask queue, so two concurrent
  // RPCs for the same key can otherwise both read state before either
  // writes it back (the exact double-settlement bug this coordinates
  // against). Chaining onto a per-key promise guarantees strict
  // sequential execution of the critical section regardless of Workers
  // runtime gating behavior, so correctness doesn't depend on unverified
  // assumptions about how `ctx.storage` schedules concurrent callers.
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  private runExclusive<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(lockKey) ?? Promise.resolve();
    const result = previous.then(fn, fn);
    // Keep the chain alive for the next caller, but never let a rejection
    // here propagate into an unrelated future caller's chain.
    this.locks.set(
      lockKey,
      result.catch(() => undefined),
    );
    return result;
  }

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    const record = (await this.ctx.storage.get(`idempotency:${key}`)) as
      | IdempotencyRecord
      | undefined;
    return record ?? null;
  }

  async setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    await this.ctx.storage.put(`idempotency:${key}`, record);
  }

  async acquireIdempotencyRecord(
    key: string,
    requestDigest: string,
    leaseMs: number,
  ): Promise<AcquireIdempotencyResult> {
    return this.runExclusive(`idempotency:${key}`, async () => {
      const storageKey = `idempotency:${key}`;
      const existing = (await this.ctx.storage.get(storageKey)) as IdempotencyRecord | undefined;
      const now = Date.now();

      if (existing) {
        if (existing.requestDigest !== requestDigest) {
          return { status: "conflict" };
        }

        if (existing.state === "completed") {
          return {
            status: "completed",
            record: existing as IdempotencyRecord & { state: "completed" },
          };
        }

        if (
          existing.state === "in_progress" &&
          now < new Date(existing.recoveryExpiryAt).getTime()
        ) {
          return { status: "in_progress" };
        }
      }

      await this.ctx.storage.put(storageKey, {
        state: "in_progress",
        requestDigest,
        createdAt: new Date(now).toISOString(),
        recoveryExpiryAt: new Date(now + leaseMs).toISOString(),
      });

      return { status: "acquired" };
    });
  }

  async getReceipt(messageId: string): Promise<Receipt | null> {
    const receipt = (await this.ctx.storage.get(`receipt:${messageId}`)) as Receipt | undefined;
    return receipt ?? null;
  }

  async setReceipt(receipt: Receipt): Promise<Receipt> {
    await this.ctx.storage.put(`receipt:${receipt.messageId}`, receipt);
    return receipt;
  }

  async createReceiptIfAbsent(receipt: Receipt): Promise<{ created: boolean; receipt: Receipt }> {
    return this.runExclusive(`receipt:${receipt.messageId}`, async () => {
      const existing = await this.getReceipt(receipt.messageId);
      if (existing) return { created: false, receipt: existing };

      await this.ctx.storage.put(`receipt:${receipt.messageId}`, receipt);
      return { created: true, receipt };
    });
  }

  async markReceiptRead(
    messageId: string,
    actor: string,
    now = new Date(),
  ): Promise<import("./repository").MarkReceiptReadResult> {
    return this.runExclusive(`receipt:${messageId}`, async () => {
      const receipt = await this.getReceipt(messageId);
      if (!receipt) return { outcome: "not-found" };
      if (actor !== receipt.sender && actor !== receipt.recipient) {
        return { outcome: "forbidden" };
      }
      if (receipt.readAt) return { outcome: "already-read", readAt: receipt.readAt };

      const updated = { ...receipt, readAt: now.toISOString() };
      await this.ctx.storage.put(`receipt:${messageId}`, updated);
      return { outcome: "marked", receipt: updated };
    });
  }

  async getPostage(messageId: string): Promise<Postage | null> {
    const postage = (await this.ctx.storage.get(`postage:${messageId}`)) as Postage | undefined;
    return postage ?? null;
  }

  async setPostage(postage: Postage): Promise<Postage> {
    await this.ctx.storage.put(`postage:${postage.messageId}`, postage);
    return postage;
  }

  async transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult> {
    return this.runExclusive(`postage:${messageId}`, async () => {
      const current = (await this.ctx.storage.get(`postage:${messageId}`)) as Postage | undefined;
      if (!current) {
        return { outcome: "not-found" as const };
      }
      if (current.status !== expectedStatus) {
        return { outcome: "conflict" as const, postage: current };
      }
      const updated: Postage = { ...current, status: nextStatus };
      await this.ctx.storage.put(`postage:${messageId}`, updated);
      return { outcome: "applied" as const, postage: updated };
    });
  }

  // BETA-002: Durable User Account, Profile & Credential DO methods
  async getUserById(userId: string): Promise<User | null> {
    const user = (await this.ctx.storage.get(`user:id:${userId}`)) as User | undefined;
    return user ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const norm = email.toLowerCase().trim();
    const userId = (await this.ctx.storage.get(`user:email:${norm}`)) as string | undefined;
    if (!userId) return null;
    return this.getUserById(userId);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const norm = username.toLowerCase().trim();
    const userId = (await this.ctx.storage.get(`user:username:${norm}`)) as string | undefined;
    if (!userId) return null;
    return this.getUserById(userId);
  }

  async getUserByAddress(address: string): Promise<User | null> {
    const norm = address.toUpperCase().trim();
    const userId = (await this.ctx.storage.get(`user:address:${norm}`)) as string | undefined;
    if (!userId) return null;
    return this.getUserById(userId);
  }

  async createUser(user: User, credential?: Credential, profile?: Profile): Promise<User> {
    return this.runExclusive("user-write-lock", async () => {
      const existingId = await this.ctx.storage.get(`user:id:${user.userId}`);
      if (existingId) {
        throw new ApiError(409, "conflict", `User ID ${user.userId} already exists`);
      }

      const normEmail = user.email.toLowerCase().trim();
      const existingEmail = await this.ctx.storage.get(`user:email:${normEmail}`);
      if (existingEmail) {
        throw new ApiError(409, "conflict", `User with email ${user.email} already exists`);
      }

      const normUsername = user.username.toLowerCase().trim();
      const existingUsername = await this.ctx.storage.get(`user:username:${normUsername}`);
      if (existingUsername) {
        throw new ApiError(409, "conflict", `Username ${user.username} already in use`);
      }

      const normAddress = user.address.toUpperCase().trim();
      const existingAddress = await this.ctx.storage.get(`user:address:${normAddress}`);
      if (existingAddress) {
        throw new ApiError(409, "conflict", `Stellar address ${user.address} is already bound`);
      }

      await this.ctx.storage.put(`user:id:${user.userId}`, user);
      await this.ctx.storage.put(`user:email:${normEmail}`, user.userId);
      await this.ctx.storage.put(`user:username:${normUsername}`, user.userId);
      await this.ctx.storage.put(`user:address:${normAddress}`, user.userId);

      if (credential) {
        await this.ctx.storage.put(`credential:${user.userId}`, credential);
      }
      if (profile) {
        await this.ctx.storage.put(`profile:${user.userId}`, profile);
      }

      return user;
    });
  }

  async updateUser(user: User, expectedVersion: number): Promise<UpdateUserResult> {
    return this.runExclusive("user-write-lock", async () => {
      const current = (await this.ctx.storage.get(`user:id:${user.userId}`)) as User | undefined;
      if (!current) {
        return { updated: false, current: null };
      }

      if (current.version !== expectedVersion) {
        return { updated: false, current };
      }

      const normEmail = user.email.toLowerCase().trim();
      const existingEmailOwner = (await this.ctx.storage.get(`user:email:${normEmail}`)) as
        | string
        | undefined;
      if (existingEmailOwner && existingEmailOwner !== user.userId) {
        throw new ApiError(409, "conflict", `User with email ${user.email} already exists`);
      }

      const normUsername = user.username.toLowerCase().trim();
      const existingUsernameOwner = (await this.ctx.storage.get(
        `user:username:${normUsername}`,
      )) as string | undefined;
      if (existingUsernameOwner && existingUsernameOwner !== user.userId) {
        throw new ApiError(409, "conflict", `Username ${user.username} already in use`);
      }

      const normAddress = user.address.toUpperCase().trim();
      const existingAddressOwner = (await this.ctx.storage.get(`user:address:${normAddress}`)) as
        | string
        | undefined;
      if (existingAddressOwner && existingAddressOwner !== user.userId) {
        throw new ApiError(409, "conflict", `Stellar address ${user.address} is already bound`);
      }

      if (current.email.toLowerCase().trim() !== normEmail) {
        await this.ctx.storage.delete(`user:email:${current.email.toLowerCase().trim()}`);
      }
      if (current.username.toLowerCase().trim() !== normUsername) {
        await this.ctx.storage.delete(`user:username:${current.username.toLowerCase().trim()}`);
      }
      if (current.address.toUpperCase().trim() !== normAddress) {
        await this.ctx.storage.delete(`user:address:${current.address.toUpperCase().trim()}`);
      }

      const nextUser: User = {
        ...user,
        version: expectedVersion + 1,
        updatedAt: new Date().toISOString(),
      };

      await this.ctx.storage.put(`user:id:${user.userId}`, nextUser);
      await this.ctx.storage.put(`user:email:${normEmail}`, user.userId);
      await this.ctx.storage.put(`user:username:${normUsername}`, user.userId);
      await this.ctx.storage.put(`user:address:${normAddress}`, user.userId);

      return { updated: true, user: nextUser };
    });
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const profile = (await this.ctx.storage.get(`profile:${userId}`)) as Profile | undefined;
    return profile ?? null;
  }

  async setProfile(profile: Profile): Promise<Profile> {
    await this.ctx.storage.put(`profile:${profile.userId}`, profile);
    return profile;
  }

  async getCredential(userId: string): Promise<Credential | null> {
    const credential = (await this.ctx.storage.get(`credential:${userId}`)) as
      | Credential
      | undefined;
    return credential ?? null;
  }

  async setCredential(credential: Credential): Promise<Credential> {
    await this.ctx.storage.put(`credential:${credential.userId}`, credential);
    return credential;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = (await this.ctx.storage.get(`session:${sessionId}`)) as Session | undefined;
    return session ?? null;
  }

  async createSession(session: Session): Promise<Session> {
    await this.ctx.storage.put(`session:${session.sessionId}`, session);
    await this.ctx.storage.put(`session:user:${session.userId}:${session.sessionId}`, true);
    return session;
  }

  async updateSession(session: Session): Promise<Session> {
    const current = await this.getSession(session.sessionId);
    if (current && current.userId !== session.userId) {
      await this.ctx.storage.delete(`session:user:${current.userId}:${session.sessionId}`);
    }
    await this.ctx.storage.put(`session:${session.sessionId}`, session);
    await this.ctx.storage.put(`session:user:${session.userId}:${session.sessionId}`, true);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    await this.ctx.storage.delete(`session:${sessionId}`);
    if (session) {
      await this.ctx.storage.delete(`session:user:${session.userId}:${sessionId}`);
    }
  }

  async deleteUserSessions(userId: string): Promise<void> {
    const prefix = `session:user:${userId}:`;
    const sessionIndex = await this.ctx.storage.list({ prefix });
    const deletes: string[] = [];
    for (const key of sessionIndex.keys()) {
      deletes.push(key, `session:${key.slice(prefix.length)}`);
    }
    if (deletes.length > 0) {
      await this.ctx.storage.delete(deletes);
    }
  }

  async getRetiredSession(sessionId: string): Promise<RetiredSession | null> {
    const retiredSession = (await this.ctx.storage.get(`retired-session:${sessionId}`)) as
      | RetiredSession
      | undefined;
    return retiredSession ?? null;
  }

  async createRetiredSession(retiredSession: RetiredSession): Promise<RetiredSession> {
    await this.ctx.storage.put(`retired-session:${retiredSession.sessionId}`, retiredSession);
    return retiredSession;
  }

  // BETA-005: Durable verification-token lifecycle methods
  async getVerificationToken(tokenHash: string): Promise<VerificationToken | null> {
    const token = (await this.ctx.storage.get(`verification-token:hash:${tokenHash}`)) as
      | VerificationToken
      | undefined;
    return token ?? null;
  }

  async getActiveVerificationToken(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationToken | null> {
    const tokenHash = (await this.ctx.storage.get(
      `verification-token:active:${userId}:${purpose}`,
    )) as string | undefined;
    if (!tokenHash) return null;
    return this.getVerificationToken(tokenHash);
  }

  async issueVerificationToken(
    token: VerificationToken,
    now: Date,
  ): Promise<IssueVerificationTokenResult> {
    return this.runExclusive(
      `verification-token:user:${token.userId}:${token.purpose}`,
      async () => {
        const existingHash = (await this.ctx.storage.get(
          `verification-token:hash:${token.tokenHash}`,
        )) as VerificationToken | undefined;
        if (existingHash) {
          return { outcome: "conflict", token: existingHash };
        }

        const activeHash = (await this.ctx.storage.get(
          `verification-token:active:${token.userId}:${token.purpose}`,
        )) as string | undefined;
        let replacedToken: VerificationToken | null = null;
        if (activeHash && activeHash !== token.tokenHash) {
          const current = (await this.ctx.storage.get(`verification-token:hash:${activeHash}`)) as
            | VerificationToken
            | undefined;
          if (current && current.consumedAt === null && current.replacedAt === null) {
            const invalidated: VerificationToken = {
              ...current,
              replacedAt: now.toISOString(),
              replacedByTokenHash: token.tokenHash,
            };
            await this.ctx.storage.put(`verification-token:hash:${activeHash}`, invalidated);
            replacedToken = invalidated;
          }
        }

        await this.ctx.storage.put(`verification-token:hash:${token.tokenHash}`, token);
        await this.ctx.storage.put(
          `verification-token:active:${token.userId}:${token.purpose}`,
          token.tokenHash,
        );
        return { outcome: "issued", token, replacedToken };
      },
    );
  }

  async consumeVerificationToken(
    tokenHash: string,
    now: Date,
  ): Promise<ConsumeVerificationTokenResult> {
    return this.runExclusive(`verification-token:consume:${tokenHash}`, async () => {
      const current = (await this.ctx.storage.get(`verification-token:hash:${tokenHash}`)) as
        | VerificationToken
        | undefined;
      if (!current) {
        return { outcome: "not-found" as const };
      }
      if (current.consumedAt !== null) {
        return { outcome: "already-consumed" as const, token: current };
      }
      if (current.replacedAt !== null) {
        return { outcome: "replaced" as const, token: current };
      }
      if (current.attemptCount >= current.maxAttempts) {
        return { outcome: "brute-force-blocked" as const, token: current };
      }
      if (Date.parse(current.expiresAt) <= now.getTime()) {
        return { outcome: "expired" as const, token: current };
      }
      const consumed: VerificationToken = {
        ...current,
        consumedAt: now.toISOString(),
      };
      await this.ctx.storage.put(`verification-token:hash:${tokenHash}`, consumed);
      return { outcome: "consumed" as const, token: consumed };
    });
  }

  async recordVerificationAttempt(
    tokenHash: string,
    now: Date,
  ): Promise<RecordVerificationAttemptResult> {
    return this.runExclusive(`verification-token:consume:${tokenHash}`, async () => {
      const current = (await this.ctx.storage.get(`verification-token:hash:${tokenHash}`)) as
        | VerificationToken
        | undefined;
      if (!current) {
        return { recorded: false, token: null };
      }
      if (current.consumedAt !== null || current.replacedAt !== null) {
        return { recorded: false, token: current };
      }
      const updated: VerificationToken = {
        ...current,
        attemptCount: current.attemptCount + 1,
      };
      await this.ctx.storage.put(`verification-token:hash:${tokenHash}`, updated);
      return { recorded: true, token: updated };
    });
  }

  async getCounter(key: string): Promise<number> {
    const timestamps =
      ((await this.ctx.storage.get(`counter:${key}`)) as number[] | undefined) ?? [];
    return timestamps.length;
  }

  async incrementCounter(key: string, windowSeconds: number, amount = 1): Promise<number> {
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw new RangeError("Counter increment amount must be a positive safe integer");
    }

    return this.runExclusive(`counter:${key}`, async () => {
      const now = Date.now();
      const windowMilliseconds = windowSeconds * 1000;
      const timestamps =
        ((await this.ctx.storage.get(`counter:${key}`)) as number[] | undefined) ?? [];

      const filtered = [...timestamps, ...Array<number>(amount).fill(now)].filter(
        (timestamp) => now - timestamp <= windowMilliseconds,
      );

      await this.ctx.storage.put(`counter:${key}`, filtered);
      return filtered.length;
    });
  }

  // ---------------------------------------------------------------------------
  // Issue #1936 (BETA-029) — Durable encrypted envelope store
  // ---------------------------------------------------------------------------

  async getEnvelope(messageId: string): Promise<StoredEnvelope | null> {
    const envelope = (await this.ctx.storage.get(`envelope:${messageId}`)) as
      | StoredEnvelope
      | undefined;
    return envelope ?? null;
  }

  /**
   * Atomically insert an envelope, enforcing immutable-ID semantics.
   *
   * runExclusive serializes concurrent inserts for the same messageId so
   * two racing callers cannot both observe "absent" and both write — exactly
   * one gets "inserted" and the other gets "duplicate" or "conflict".
   */
  async insertEnvelope(envelope: StoredEnvelope): Promise<InsertEnvelopeResult> {
    return this.runExclusive(`envelope:${envelope.messageId}`, async () => {
      const existing = (await this.ctx.storage.get(`envelope:${envelope.messageId}`)) as
        | StoredEnvelope
        | undefined;

      if (existing) {
        // Byte-equality check — serialize both deterministically for comparison.
        const existingBytes = JSON.stringify(existing);
        const incomingBytes = JSON.stringify(envelope);
        if (existingBytes === incomingBytes) {
          return { outcome: "duplicate" as const, envelope: existing };
        }
        // Different payload for same ID: reject. Prior record is authoritative.
        throw new ApiError(
          409,
          "conflict",
          `An envelope with a different payload already exists for message ${envelope.messageId}`,
        );
      }

      await this.ctx.storage.put(`envelope:${envelope.messageId}`, envelope);
      return { outcome: "inserted" as const, envelope };
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

    const envelopesMap = (await this.ctx.storage.list({ prefix: "envelope:" })) as Map<
      string,
      StoredEnvelope
    >;

    const filtered: StoredEnvelope[] = [];
    for (const env of envelopesMap.values()) {
      if (!env || !env.recipientId) continue;
      if (env.recipientId.toUpperCase().trim() !== normRecipient) continue;

      const isDeleted = Boolean(env.deletedAt);
      if (isDeleted && !includeTombstones) continue;

      const itemStatus = env.status ?? "pending";
      if (statusFilter !== "all" && itemStatus !== statusFilter) continue;

      filtered.push(env);
    }

    const spec = PAGINATED_QUERY_ORDERINGS.listEnvelopes;
    return paginate(filtered, spec, { limit, after: options.after });
  }

  async tombstoneEnvelope(messageId: string, recipient: string): Promise<StoredEnvelope> {
    return this.runExclusive(`envelope:${messageId}`, async () => {
      const existing = (await this.ctx.storage.get(`envelope:${messageId}`)) as
        | StoredEnvelope
        | undefined;
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
      await this.ctx.storage.put(`envelope:${messageId}`, tombstoned);
      return tombstoned;
    });
  }

  async updateEnvelopeStatus(
    messageId: string,
    status: import("./domain").MailboxItemStatus,
  ): Promise<StoredEnvelope> {
    return this.runExclusive(`envelope:${messageId}`, async () => {
      const existing = (await this.ctx.storage.get(`envelope:${messageId}`)) as
        | StoredEnvelope
        | undefined;
      if (!existing) {
        throw new ApiError(404, "not_found", `No envelope found for message ${messageId}`);
      }
      const updated: StoredEnvelope = {
        ...existing,
        status,
      };
      await this.ctx.storage.put(`envelope:${messageId}`, updated);
      return updated;
    });
  }
}
