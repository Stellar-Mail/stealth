# Implementation Plan — Issue #1493

## Replace the process-local API repository with environment-backed persistence (KV + Durable Object Split)

Branch: `fix/env-backed-repository-1493`

---

## 1. Context & Rationale for Hybrid Architecture (KV + Durable Object)

To avoid consistency and race condition bugs in production:

- **Eventually Consistent Layer (Cloudflare KV):** Used for read-heavy, write-rarely point-lookups (Policies, Sender Rules, Postage, and Receipts).
- **Strongly Consistent Layer (Durable Objects):** Used for operations requiring absolute atomic correctness and serial execution (Idempotency Records and sliding-window Rate-Limiter Counters).

Using KV alone for idempotency or counters in a multi-region deployment leads to race conditions (e.g., dual execution on concurrent requests). A single-instance Durable Object resolves this by serializing state accesses for these specific domains.

---

## 2. Infrastructure Setup & Bindings

### 2a. `wrangler.jsonc` Updates

We will modify `wrangler.jsonc` to point to a custom server entrypoint `src/server.ts` (instead of the library default) and configure bindings:

```jsonc
{
  "main": "src/server.ts",
  "kv_namespaces": [
    {
      "binding": "STEALTH_KV",
      "id": "<production-kv-id>",
      "preview_id": "<preview-kv-id>",
    },
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "STEALTH_COORDINATOR",
        "class_name": "StealthCoordinator",
      },
    ],
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["StealthCoordinator"],
    },
  ],
}
```

---

## 3. Implementation Details

### 3a. `src/server.ts` — Custom Server Entrypoint

To expose the Durable Object to Wrangler/workerd, we must export it from the server main entry:

```typescript
import handler from "@tanstack/react-start/server-entry";
export { StealthCoordinator } from "./server/api/stealth-coordinator";

export default handler;
```

---

### 3b. `src/types/cloudflare.d.ts` — Types

Declare the virtual module and environment bindings:

```typescript
declare module "cloudflare:workers" {
  export const env: {
    STEALTH_KV?: KVNamespace;
    STEALTH_COORDINATOR?: DurableObjectNamespace;
  };
}
```

---

### 3c. `src/server/api/stealth-coordinator.ts` — Durable Object (Consistent Layer)

Implements the Durable Object class using DO's built-in key-value storage (`this.ctx.storage`) for atomic operations.

```typescript
import { DurableObject } from "cloudflare:workers";
import type { IdempotencyRecord } from "./domain";

export class StealthCoordinator extends DurableObject {
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
  }

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    const record = await this.ctx.storage.get<IdempotencyRecord>(`idempotency:${key}`);
    return record ?? null;
  }

  async setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    await this.ctx.storage.put(`idempotency:${key}`, record);
  }

  async getCounter(key: string): Promise<number> {
    const timestamps = (await this.ctx.storage.get<number[]>(`counter:${key}`)) ?? [];
    return timestamps.length;
  }

  async incrementCounter(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const windowMilliseconds = windowSeconds * 1000;
    const timestamps = (await this.ctx.storage.get<number[]>(`counter:${key}`)) ?? [];

    // Filter timestamps falling within the sliding window
    const filtered = [...timestamps, now].filter(
      (timestamp) => now - timestamp <= windowMilliseconds,
    );

    await this.ctx.storage.put(`counter:${key}`, filtered);
    return filtered.length;
  }
}
```

---

### 3d. `src/server/api/kv-repository.ts` — KV Adapter (Eventual Layer)

Implements standard read/write for non-transactional domains:

- `getPolicy` / `setPolicy`
- `getSenderRule` / `setSenderRule` (rules fallback to `"default"` and delete key when rules are set back to default)
- `getPostage` / `setPostage`
- `getReceipt` / `setReceipt`

---

### 3e. `src/server/api/context.ts` — Environment Selector

Modify `getApiContext()` to be `async` and conditionally instantiate a `HybridApiRepository` in production:

```typescript
import { MemoryApiRepository } from "./memory-repository";
import type { ApiRepository } from "./repository";
import type { MailboxPolicy, SenderRule, Postage, Receipt, IdempotencyRecord } from "./domain";

export class HybridApiRepository implements ApiRepository {
  constructor(
    private kv: KVNamespace,
    private coordinator: DurableObjectNamespace,
  ) {}

  // Prefixing helper to avoid namespace collision
  private key(prefix: string, ...parts: string[]) {
    return `${prefix}:${parts.join(":")}`;
  }

  async getPolicy(owner: string): Promise<MailboxPolicy | null> {
    const policy = await this.kv.get<MailboxPolicy>(this.key("policy", owner), "json");
    return policy ?? null;
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
    const postage = await this.kv.get<Postage>(this.key("postage", messageId), "json");
    return postage ?? null;
  }

  async setPostage(postage: Postage): Promise<Postage> {
    await this.kv.put(this.key("postage", postage.messageId), JSON.stringify(postage));
    return postage;
  }

  async getReceipt(messageId: string): Promise<Receipt | null> {
    const receipt = await this.kv.get<Receipt>(this.key("receipt", messageId), "json");
    return receipt ?? null;
  }

  async setReceipt(receipt: Receipt): Promise<Receipt> {
    await this.kv.put(this.key("receipt", receipt.messageId), JSON.stringify(receipt));
    return receipt;
  }

  // Consistent operations routed to Durable Object
  private getStub() {
    const id = this.coordinator.idFromName("global-stealth-coordinator");
    return this.coordinator.get(id);
  }

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    // Durable Object RPC call
    return this.getStub().getIdempotencyRecord(key);
  }

  async setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    // Durable Object RPC call
    await this.getStub().setIdempotencyRecord(key, record);
  }

  async getCounter(key: string): Promise<number> {
    // Durable Object RPC call
    return this.getStub().getCounter(key);
  }

  async incrementCounter(key: string, windowSeconds: number): Promise<number> {
    // Durable Object RPC call
    return this.getStub().incrementCounter(key, windowSeconds);
  }

  // Relay stub methods matching MemoryApiRepository exactly
  async getRelayQueueDepth(relayId: string): Promise<number> {
    return 0;
  }

  async getRelayRetryCount(relayId: string): Promise<number> {
    return 0;
  }

  async getRelayLastSuccessfulDelivery(relayId: string): Promise<string | null> {
    return null;
  }

  async getRelayLastFailedDelivery(relayId: string): Promise<string | null> {
    return null;
  }

  async getRelayDeadLetterCount(relayId: string): Promise<number> {
    return 0;
  }
}

export async function getApiContext(): Promise<ApiContext> {
  if (!import.meta.env.PROD) {
    globalApi.__stealthApiRepository ??= new MemoryApiRepository();
    return { repository: globalApi.__stealthApiRepository };
  }

  const { env } = await import("cloudflare:workers");
  if (!env.STEALTH_KV || !env.STEALTH_COORDINATOR) {
    throw new Error("Missing required cloudflare bindings: STEALTH_KV or STEALTH_COORDINATOR");
  }
  return { repository: new HybridApiRepository(env.STEALTH_KV, env.STEALTH_COORDINATOR) };
}
```

---

### 3f. Call sites — `src/routes/api/v1/**`

Change from sync `getApiContext()` to async `await getApiContext()` at the 14 call sites across the following 11 files:

1. `src/routes/api/v1/policies/$owner.ts`
2. `src/routes/api/v1/policies/evaluate.ts`
3. `src/routes/api/v1/policies/$owner/senders/$sender.ts`
4. `src/routes/api/v1/postage/index.ts`
5. `src/routes/api/v1/postage/$messageId.ts`
6. `src/routes/api/v1/postage/$messageId/refund.ts`
7. `src/routes/api/v1/postage/$messageId/settle.ts`
8. `src/routes/api/v1/postage/quote.ts`
9. `src/routes/api/v1/receipts/index.ts`
10. `src/routes/api/v1/receipts/$messageId.ts`
11. `src/routes/api/v1/receipts/$messageId/read.ts`

---

## 4. Test Strategy

1. **`tests/unit/api/kv-repository.test.ts`**: Tests the KV adapter using a `Map` stub of `KVNamespace`.
2. **`tests/unit/api/stealth-coordinator.test.ts`**: Tests the `StealthCoordinator` class methods using a mock Durable Object context.
3. Verify that existing unit tests continue to pass (using the unchanged `MemoryApiRepository`).

---

## 5. Scope Boundaries

- ❌ `src/server/api/repository.ts` — **not touched**
- ❌ `src/server/api/memory-repository.ts` — **not touched**
- ❌ `tools/v2/**` — **not touched**
- ✅ Route files touched only to add `await` to `getApiContext()`.

---

## 6. File Inventory

| File                                         | Action                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `wrangler.jsonc`                             | Modify — Update `main` entry, add `kv_namespaces`, `durable_objects`, and `migrations`          |
| `src/server.ts`                              | **New** — Custom server entrypoint                                                              |
| `src/types/cloudflare.d.ts`                  | **New** — Type definitions for Cloudflare bindings                                              |
| `src/server/api/stealth-coordinator.ts`      | **New** — Durable Object implementation                                                         |
| `src/server/api/kv-repository.ts`            | **New** — Cloudflare KV adapter implementation                                                  |
| `src/server/api/context.ts`                  | Modify — Update `getApiContext` to be async and instantiate `HybridApiRepository` in production |
| `src/routes/api/v1/**` (11 files)            | Modify — Change `getApiContext()` to `await getApiContext()`                                    |
| `tests/unit/api/kv-repository.test.ts`       | **New** — Unit tests for KV adapter                                                             |
| `tests/unit/api/stealth-coordinator.test.ts` | **New** — Unit tests for Durable Object                                                         |
