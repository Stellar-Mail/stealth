import type { IdempotencyRecord } from "./domain";

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
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
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

  async getCounter(key: string): Promise<number> {
    const timestamps =
      ((await this.ctx.storage.get(`counter:${key}`)) as number[] | undefined) ?? [];
    return timestamps.length;
  }

  async incrementCounter(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const windowMilliseconds = windowSeconds * 1000;
    const timestamps =
      ((await this.ctx.storage.get(`counter:${key}`)) as number[] | undefined) ?? [];

    // Filter timestamps falling within the sliding window
    const filtered = [...timestamps, now].filter(
      (timestamp) => now - timestamp <= windowMilliseconds,
    );

    await this.ctx.storage.put(`counter:${key}`, filtered);
    return filtered.length;
  }
}
