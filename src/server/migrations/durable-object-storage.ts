import type { MigrationStorage } from "./types";

/**
 * Adapts a Durable Object's transactional storage to the `MigrationStorage`
 * surface so the identity migration engine can run against the same keys the
 * `StealthCoordinator` DO persists (users, sessions, usernames, …). `listKeys`
 * paginates through `ctx.storage.list` to stay complete past the 1000-key
 * per-call limit.
 */
export function createDurableObjectMigrationStorage(
  state: Pick<DurableObjectState, "storage">,
): MigrationStorage {
  const storage = state.storage;

  return {
    async listKeys(prefix: string): Promise<string[]> {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        // NOTE: in real workerd `list()` returns `{ keys, list_complete, cursor }`,
        // while Miniflare 4 emulation returns a `Map<storageKey, value>` whose
        // `keys` property is `Map.prototype.keys` (a function). Handle both.
        const page = (await storage.list({
          prefix,
          limit: 1000,
          ...(cursor ? { cursor } : {}),
        })) as
          | { keys: Array<{ name: string }>; list_complete: boolean; cursor?: string }
          | Map<string, unknown>;

        if (typeof page.keys === "function") {
          for (const key of page.keys()) keys.push(key);
          // Miniflare's Map carries no pagination metadata; it returns every
          // matching key for the prefix, so a single pass is complete.
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

    async get(key: string): Promise<unknown | null> {
      const value = await storage.get<unknown>(key);
      return value ?? null;
    },

    async put(key: string, value: unknown): Promise<void> {
      await storage.put(key, value);
    },

    async delete(key: string): Promise<void> {
      await storage.delete(key);
    },
  };
}
