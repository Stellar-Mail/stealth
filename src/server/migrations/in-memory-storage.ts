import type { MigrationStorage } from "./types";

/**
 * In-memory `MigrationStorage` used by unit tests (and useful for a local
 * dry-run against disposable data). Maps are keyed by storage key.
 */
export class InMemoryMigrationStorage implements MigrationStorage {
  private readonly store = new Map<string, unknown>();

  async listKeys(prefix: string): Promise<string[]> {
    return [...this.store.keys()].filter((key) => key.startsWith(prefix)).sort();
  }

  async get(key: string): Promise<unknown | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /** Test helper: seed a record directly. */
  seed(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}
