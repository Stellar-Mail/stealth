/**
 * Migration system for managing schema evolution.
 * Supports both forward and backward migrations for offline-first data.
 */

export type MigrationId = string; // Semantic version: "1.0.0"

export interface Migration {
  id: MigrationId;
  up(state: unknown): Promise<unknown>;
  down(state: unknown): Promise<unknown>;
}

/**
 * Registry of all available migrations in order of application.
 */
const migrations: Migration[] = [
  // Future migrations go here
  // {
  //   id: "1.0.1",
  //   up: migrateAddCreatedAtField,
  //   down: migrateRemoveCreatedAtField,
  // },
];

const STORAGE_KEY = "stealth-schema-version.v1";
const CURRENT_VERSION = "1.0.0";

/**
 * Get the current schema version from storage.
 */
function getCurrentVersion(): MigrationId {
  if (typeof globalThis === "undefined" || !globalThis.localStorage) {
    return "0.0.0";
  }

  try {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY);
    return stored || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Set the schema version in storage.
 */
function setCurrentVersion(version: MigrationId): void {
  if (typeof globalThis === "undefined" || !globalThis.localStorage) {
    return;
  }

  try {
    globalThis.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // Silently fail if storage is unavailable
  }
}

/**
 * Parse semantic version "X.Y.Z" to tuple for comparison.
 */
function parseVersion(version: string): [number, number, number] {
  const parts = version.split(".").map((p) => parseInt(p, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * Compare two semantic versions.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

/**
 * Get migrations needed to reach target version from current version.
 */
function getPendingMigrations(from: MigrationId, to: MigrationId): Migration[] {
  const fromComp = compareVersions(from, to);
  if (fromComp === 0) return [];
  if (fromComp > 0) {
    // Downgrade not supported in this implementation
    console.warn(`Cannot downgrade from ${from} to ${to}`);
    return [];
  }

  return migrations.filter((m) => {
    const cmp = compareVersions(m.id, to);
    return cmp <= 0 && compareVersions(m.id, from) > 0;
  });
}

/**
 * Run pending migrations on data state.
 */
export async function runMigrations(state: unknown): Promise<unknown> {
  const currentVersion = getCurrentVersion();
  const pending = getPendingMigrations(currentVersion, CURRENT_VERSION);

  if (pending.length === 0) {
    return state;
  }

  let result = state;
  for (const migration of pending) {
    try {
      result = await migration.up(result);
    } catch (error) {
      console.error(`Migration ${migration.id} failed:`, error);
      throw error;
    }
  }

  setCurrentVersion(CURRENT_VERSION);
  return result;
}

/**
 * Register a new migration (for runtime registration).
 */
export function registerMigration(migration: Migration): void {
  const existingIndex = migrations.findIndex((m) => m.id === migration.id);
  if (existingIndex >= 0) {
    migrations[existingIndex] = migration;
  } else {
    migrations.push(migration);
    migrations.sort((a, b) => compareVersions(a.id, b.id));
  }
}

/**
 * Get current schema version.
 */
export function getSchemaVersion(): MigrationId {
  return getCurrentVersion();
}

/**
 * Reset schema version (useful for testing).
 */
export function resetSchemaVersion(): void {
  setCurrentVersion("0.0.0");
}
