import type {
  Credential,
  IdempotencyRecord,
  Postage,
  PostageStatus,
  Profile,
  Receipt,
  StoredEnvelope,
  User,
  UsernameRecord,
} from "./domain";
import type {
  AcquireIdempotencyResult,
  InsertEnvelopeResult,
  PostageTransitionResult,
  ReserveUsernameResult,
  UpdateUserResult,
} from "./repository";
import { ApiError } from "./errors";

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

  // Issue #1910: username *reservation* is a uniqueness constraint over
  // identity itself, so (like postage settlement) it must live in this
  // Durable Object's transactional storage rather than eventually-consistent
  // KV. Independent of the BETA-002 user:username:* index above — see the
  // note in memory-repository.ts for how the two relate.
  async getUsernameRecord(username: string): Promise<UsernameRecord | null> {
    const record = (await this.ctx.storage.get(`username:${username}`)) as
      | UsernameRecord
      | undefined;
    return record ?? null;
  }

  async reserveUsernameIfAbsent(record: UsernameRecord): Promise<ReserveUsernameResult> {
    return this.runExclusive(`username:${record.username}`, async () => {
      const existing = await this.getUsernameRecord(record.username);
      if (existing) {
        return { outcome: "taken" as const, record: existing };
      }
      await this.ctx.storage.put(`username:${record.username}`, record);
      return { outcome: "reserved" as const, record };
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
}
