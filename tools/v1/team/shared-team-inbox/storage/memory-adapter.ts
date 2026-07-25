import type { StorageAdapter, StorageEntry } from '../types';

export function createMemoryStorageAdapter(): StorageAdapter {
  const store = new Map<string, StorageEntry<unknown>>();

  return {
    async get<T>(key: string): Promise<StorageEntry<T> | null> {
      const entry = store.get(key);
      return (entry as StorageEntry<T>) ?? null;
    },

    async getAll<T>(prefix: string): Promise<StorageEntry<T>[]> {
      const results: StorageEntry<T>[] = [];
      for (const [key, value] of store) {
        if (key.startsWith(prefix)) {
          results.push(value as StorageEntry<T>);
        }
      }
      return results.sort((a, b) => {
        const aData = a.data as Record<string, unknown>;
        const bData = b.data as Record<string, unknown>;
        const aTime = (aData.receivedAt as string) ?? (aData.createdAt as string) ?? '';
        const bTime = (bData.receivedAt as string) ?? (bData.createdAt as string) ?? '';
        return bTime.localeCompare(aTime);
      });
    },

    async set<T>(key: string, entry: StorageEntry<T>): Promise<void> {
      store.set(key, entry);
    },

    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}
