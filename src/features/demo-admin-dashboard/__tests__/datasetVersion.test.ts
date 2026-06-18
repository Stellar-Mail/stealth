import { describe, it, expect, beforeEach } from "vitest";
import {
  versionToNumber,
  compareVersions,
  parseVersion,
  formatVersion,
  calculateChecksum,
  MigrationRegistry,
  globalMigrationRegistry,
  type DatasetVersion,
} from "../types/datasetVersion";

describe("Dataset Versioning", () => {
  describe("versionToNumber", () => {
    it("converts semantic version to comparable number", () => {
      const v = { major: 1, minor: 2, patch: 3, timestamp: "2026-06-16T00:00:00Z" };
      expect(versionToNumber(v)).toBe(10203);
    });

    it("accepts string format", () => {
      expect(versionToNumber("1.2.3")).toBe(10203);
      expect(versionToNumber("v2.0.0")).toBe(20000);
    });

    it("handles major-only changes", () => {
      expect(versionToNumber("2.0.0")).toBeGreaterThan(versionToNumber("1.99.99"));
    });
  });

  describe("compareVersions", () => {
    it("returns -1 when v1 < v2", () => {
      expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
      expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
    });

    it("returns 0 when versions are equal", () => {
      expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    });

    it("returns 1 when v1 > v2", () => {
      expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
      expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
    });

    it("accepts version objects", () => {
      const v1 = { major: 1, minor: 0, patch: 0, timestamp: "2026-06-16T00:00:00Z" };
      const v2 = { major: 1, minor: 0, patch: 1, timestamp: "2026-06-16T00:00:00Z" };
      expect(compareVersions(v1, v2)).toBe(-1);
    });
  });

  describe("parseVersion", () => {
    it("parses semantic version string", () => {
      const v = parseVersion("1.2.3");
      expect(v.major).toBe(1);
      expect(v.minor).toBe(2);
      expect(v.patch).toBe(3);
    });

    it("handles 'v' prefix", () => {
      const v = parseVersion("v2.0.1");
      expect(v.major).toBe(2);
      expect(v.minor).toBe(0);
      expect(v.patch).toBe(1);
    });

    it("sets timestamp on parse", () => {
      const before = new Date();
      const v = parseVersion("1.0.0");
      const after = new Date();

      expect(v.timestamp).toBeDefined();
      const ts = new Date(v.timestamp);
      expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("throws on invalid format", () => {
      expect(() => parseVersion("invalid")).toThrow();
      expect(() => parseVersion("1.2")).toThrow();
      expect(() => parseVersion("1.2.a")).toThrow();
    });
  });

  describe("formatVersion", () => {
    it("formats version object as string", () => {
      const v: DatasetVersion = {
        major: 2,
        minor: 1,
        patch: 0,
        timestamp: "2026-06-16T00:00:00Z",
      };
      expect(formatVersion(v)).toBe("2.1.0");
    });
  });

  describe("calculateChecksum", () => {
    it("produces consistent checksum for same data", () => {
      const data = { name: "test", value: 123 };
      const c1 = calculateChecksum(data);
      const c2 = calculateChecksum(data);
      expect(c1).toBe(c2);
    });

    it("produces different checksums for different data", () => {
      const c1 = calculateChecksum({ value: 1 });
      const c2 = calculateChecksum({ value: 2 });
      expect(c1).not.toBe(c2);
    });

    it("returns hex string", () => {
      const c = calculateChecksum({ test: true });
      expect(/^[0-9a-f]+$/.test(c)).toBe(true);
    });
  });

  describe("MigrationRegistry", () => {
    let registry: MigrationRegistry;

    beforeEach(() => {
      registry = new MigrationRegistry();
    });

    it("registers and retrieves migrations", () => {
      const entry = {
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        description: "Add new field",
        migrate: (data: any) => ({ ...data, newField: true }),
      };

      registry.register(entry);
      const found = registry.findMigration("1.0.0", "1.1.0");
      expect(found).toBe(entry);
    });

    it("executes registered migration", () => {
      registry.register({
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        description: "Transform data",
        migrate: (data: any) => ({ ...data, migrated: true }),
      });

      const migration = registry.findMigration("1.0.0", "1.1.0");
      const result = migration!.migrate({ original: true });
      expect(result).toEqual({ original: true, migrated: true });
    });

    it("detects missing migrations", () => {
      const found = registry.findMigration("1.0.0", "2.0.0");
      expect(found).toBeUndefined();
    });

    it("returns all registered migrations", () => {
      registry.register({
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        description: "M1",
        migrate: (d) => d,
      });
      registry.register({
        fromVersion: "1.1.0",
        toVersion: "2.0.0",
        description: "M2",
        migrate: (d) => d,
      });

      expect(registry.getAll()).toHaveLength(2);
    });

    it("clears registry", () => {
      registry.register({
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        description: "Test",
        migrate: (d) => d,
      });
      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
    });

    it("detects direct migration path", () => {
      registry.register({
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        description: "Direct",
        migrate: (d) => d,
      });

      expect(registry.canMigrate("1.0.0", "1.1.0")).toBe(true);
      expect(registry.canMigrate("1.0.0", "2.0.0")).toBe(false);
      expect(registry.canMigrate("1.0.0", "1.0.0")).toBe(true); // Identity
    });

    it("detects chained migration path", () => {
      registry.register({
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        description: "Step 1",
        migrate: (d) => d,
      });
      registry.register({
        fromVersion: "1.1.0",
        toVersion: "2.0.0",
        description: "Step 2",
        migrate: (d) => d,
      });

      expect(registry.canMigrate("1.0.0", "2.0.0")).toBe(true);
    });

    it("finds migration path via chain", () => {
      registry.register({
        fromVersion: "1.0.0",
        toVersion: "1.1.0",
        description: "Step 1",
        migrate: (d) => d,
      });
      registry.register({
        fromVersion: "1.1.0",
        toVersion: "2.0.0",
        description: "Step 2",
        migrate: (d) => d,
      });

      const path = registry.findMigrationPath("1.0.0", "2.0.0");
      expect(path).toHaveLength(2);
      expect(path[0].toVersion).toBe("1.1.0");
      expect(path[1].toVersion).toBe("2.0.0");
    });

    it("returns empty path for same version", () => {
      const path = registry.findMigrationPath("1.0.0", "1.0.0");
      expect(path).toHaveLength(0);
    });
  });

  describe("globalMigrationRegistry", () => {
    it("is a shared registry instance", () => {
      expect(globalMigrationRegistry).toBeDefined();
      expect(globalMigrationRegistry.getAll).toBeDefined();
    });
  });
});
