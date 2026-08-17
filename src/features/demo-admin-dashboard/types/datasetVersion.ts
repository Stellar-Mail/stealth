/**
 * Dataset versioning and migration support for demo admin dashboard.
 * Enables tracking of dataset structure changes and automatic migrations
 * between versions.
 */

/**
 * Represents the version metadata for a dataset.
 * Used to track structural changes and enable safe migrations.
 */
export interface DatasetVersion {
  major: number;
  minor: number;
  patch: number;
  timestamp: string;
  description?: string;
  checksum?: string;
}

/**
 * Converts a DatasetVersion to a comparable numeric version.
 * Format: major * 10000 + minor * 100 + patch
 * Example: v1.2.3 => 10203
 */
export function versionToNumber(version: DatasetVersion | string): number {
  const parsed = typeof version === "string" ? parseVersion(version) : version;
  return parsed.major * 10000 + parsed.minor * 100 + parsed.patch;
}

/**
 * Compares two versions.
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: DatasetVersion | string, v2: DatasetVersion | string): number {
  const n1 = versionToNumber(v1);
  const n2 = versionToNumber(v2);
  if (n1 < n2) return -1;
  if (n1 > n2) return 1;
  return 0;
}

/**
 * Parses a version string in semantic versioning format.
 * Supports formats: "1.2.3", "v1.2.3"
 */
export function parseVersion(versionString: string): DatasetVersion {
  const cleaned = versionString.replace(/^v/, "").trim();
  const parts = cleaned.split(".").map((p) => parseInt(p, 10));

  if (parts.length < 3 || parts.some(isNaN)) {
    throw new Error(
      `Invalid version format: "${versionString}". Expected semantic versioning (e.g., "1.2.3" or "v1.2.3")`,
    );
  }

  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formats a DatasetVersion as a semantic version string.
 */
export function formatVersion(version: DatasetVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Calculates a simple checksum for version data.
 * Used to detect changes in dataset structure or content.
 */
export function calculateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Migration registry entry for tracking available migrations.
 */
export interface MigrationEntry {
  fromVersion: string;
  toVersion: string;
  description: string;
  migrate(data: any): any;
}

/**
 * Registry for managing dataset migrations.
 * Provides lookup and execution of version-specific migrations.
 */
export class MigrationRegistry {
  private migrations: Map<string, MigrationEntry> = new Map();

  /**
   * Register a migration step from one version to another.
   */
  register(entry: MigrationEntry): void {
    const key = `${entry.fromVersion}->${entry.toVersion}`;
    this.migrations.set(key, entry);
  }

  /**
   * Find a migration from source to target version.
   */
  findMigration(fromVersion: string, toVersion: string): MigrationEntry | undefined {
    const key = `${fromVersion}->${toVersion}`;
    return this.migrations.get(key);
  }

  /**
   * Get all registered migrations.
   */
  getAll(): MigrationEntry[] {
    return Array.from(this.migrations.values());
  }

  /**
   * Clear all registered migrations.
   */
  clear(): void {
    this.migrations.clear();
  }

  /**
   * Check if a migration path exists from source to target version.
   */
  canMigrate(fromVersion: string, toVersion: string, chain: Set<string> = new Set()): boolean {
    if (fromVersion === toVersion) return true;

    const key = `${fromVersion}->${toVersion}`;
    if (this.migrations.has(key)) return true;

    // Check for chained migrations
    if (chain.has(fromVersion)) return false;
    chain.add(fromVersion);

    for (const [, migration] of this.migrations) {
      if (migration.fromVersion === fromVersion) {
        if (this.canMigrate(migration.toVersion, toVersion, new Set(chain))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find a migration path (chain) from source to target version.
   */
  findMigrationPath(fromVersion: string, toVersion: string): MigrationEntry[] {
    if (fromVersion === toVersion) return [];

    const direct = this.findMigration(fromVersion, toVersion);
    if (direct) return [direct];

    // BFS to find shortest path
    const queue: Array<{ version: string; path: MigrationEntry[] }> = [
      { version: fromVersion, path: [] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { version, path } = queue.shift()!;

      if (visited.has(version)) continue;
      visited.add(version);

      if (version === toVersion) return path;

      for (const [, migration] of this.migrations) {
        if (migration.fromVersion === version && !visited.has(migration.toVersion)) {
          queue.push({
            version: migration.toVersion,
            path: [...path, migration],
          });
        }
      }
    }

    return [];
  }
}

/**
 * Default global migration registry instance.
 */
export const globalMigrationRegistry = new MigrationRegistry();
