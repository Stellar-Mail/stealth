// ---------------------------------------------------------------------------
// BETA-081 (Issue #1988) — storage adapters.
//
// Adapters expose the three beta stores (Durable Object storage, KV, R2) as the
// byte-oriented `BackupStorage` surface. `listKeys` paginates past the 1000-key
// per-call limit; values round-trip with an explicit encoding so the restore
// path writes back the exact shape each store expects (JSON objects for DO,
// text for KV, raw bytes for R2).
// ---------------------------------------------------------------------------

import type { BackupStorage, BackupStoredValue, BackupStoreKind } from "./types";

function encodeText(value: string): BackupStoredValue {
  return { encoding: "text", bytes: new TextEncoder().encode(value) };
}

function decodeText(value: BackupStoredValue): string {
  return new TextDecoder().decode(value.bytes);
}

/** DO storage values are structured-cloneable; they round-trip as JSON. */
export function createDurableObjectBackupStorage(
  state: Pick<DurableObjectState, "storage">,
): BackupStorage {
  const storage = state.storage;
  return {
    store: "durable-object",
    async listKeys(prefix = ""): Promise<string[]> {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = (await storage.list({
          prefix,
          limit: 1000,
          ...(cursor ? { cursor } : {}),
        })) as
          | { keys: Array<{ name: string }>; list_complete: boolean; cursor?: string }
          | Map<string, unknown>;
        if (typeof page.keys === "function") {
          for (const key of page.keys()) keys.push(key);
          break;
        }
        const recordPage = page as {
          keys: Array<{ name: string }>;
          list_complete: boolean;
          cursor?: string;
        };
        for (const key of recordPage.keys) keys.push(key.name);
        cursor = recordPage.cursor;
        if (!recordPage.list_complete && !cursor) break;
      } while (cursor);
      return keys;
    },
    async get(key: string): Promise<BackupStoredValue | null> {
      const value = await storage.get(key);
      if (value === undefined || value === null) return null;
      return {
        encoding: "json",
        bytes: new TextEncoder().encode(JSON.stringify(value)),
      };
    },
    async put(key: string, value: BackupStoredValue): Promise<void> {
      if (value.encoding !== "json") {
        throw new Error("Durable Object storage requires JSON-encoded values");
      }
      await storage.put(key, JSON.parse(decodeText(value)));
    },
    async delete(key: string): Promise<void> {
      await storage.delete(key);
    },
  };
}

/** KV values are plain strings (the app stores JSON via `put(key, json)`). */
export function createKvBackupStorage(kv: KVNamespace): BackupStorage {
  return {
    store: "kv",
    async listKeys(prefix = ""): Promise<string[]> {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = (await (kv as any).list({
          prefix,
          limit: 1000,
          ...(cursor ? { cursor } : {}),
        })) as { keys: Array<{ name: string }>; list_complete: boolean; cursor?: string };
        for (const key of page.keys) keys.push(key.name);
        cursor = page.cursor;
        if (!page.list_complete && !cursor) break;
      } while (cursor);
      return keys;
    },
    async get(key: string): Promise<BackupStoredValue | null> {
      const value = await kv.get(key, "text");
      if (value === null) return null;
      return encodeText(value);
    },
    async put(key: string, value: BackupStoredValue): Promise<void> {
      if (value.encoding !== "text") {
        throw new Error("KV storage requires text-encoded values");
      }
      await kv.put(key, decodeText(value));
    },
    async delete(key: string): Promise<void> {
      await kv.delete(key);
    },
  };
}

/** R2 stores raw bytes. */
export function createR2BackupStorage(bucket: R2Bucket): BackupStorage {
  return {
    store: "r2",
    async listKeys(prefix = ""): Promise<string[]> {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await bucket.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
        for (const obj of page.objects) keys.push(obj.key);
        cursor = page.cursor;
        if (!page.truncated && !cursor) break;
      } while (cursor);
      return keys;
    },
    async get(key: string): Promise<BackupStoredValue | null> {
      const obj = await bucket.get(key);
      if (!obj) return null;
      return { encoding: "bytes", bytes: new Uint8Array(await obj.arrayBuffer()) };
    },
    async put(key: string, value: BackupStoredValue): Promise<void> {
      if (value.encoding !== "bytes") {
        throw new Error("R2 storage requires bytes-encoded values");
      }
      await bucket.put(key, value.bytes);
    },
    async delete(key: string): Promise<void> {
      await bucket.delete(key);
    },
  };
}

/**
 * In-memory store used by unit tests and the rehearsal harness. Values are
 * kept as JSON-encoded bytes to mimic DO semantics most closely.
 */
export function createMemoryBackupStorage(store: BackupStoreKind): BackupStorage & {
  _size(): Promise<number>;
  _values: Map<string, BackupStoredValue>;
} {
  const values = new Map<string, BackupStoredValue>();
  return {
    store,
    _values: values,
    async listKeys(prefix = ""): Promise<string[]> {
      return [...values.keys()].filter((key) => key.startsWith(prefix));
    },
    async get(key: string): Promise<BackupStoredValue | null> {
      return values.get(key) ?? null;
    },
    async put(key: string, value: BackupStoredValue): Promise<void> {
      values.set(key, value);
    },
    async delete(key: string): Promise<void> {
      values.delete(key);
    },
    async _size(): Promise<number> {
      return values.size;
    },
  };
}
