import type { IdempotencyRecord, Postage, PostageStatus } from "./domain";
import type { PostageTransitionResult } from "./repository";

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

  // Postage settlement is money-moving and must never double-fire, so its
  // authoritative state lives in this Durable Object's transactional
  // storage rather than in eventually-consistent KV.
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
    // The read-check-write below is serialized per messageId via
    // runExclusive, so concurrent settle/refund calls for the same
    // message cannot interleave and double-apply the transition.
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
}
