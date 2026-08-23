import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  registerRecordSchema,
  validateRecord,
  versionRecord,
} from "../../../src/server/api/repository";
import { DataIntegrityError } from "../../../src/server/api/errors";
import { identityRecordFamilies } from "../../../src/server/migrations/adapters";
import { InMemoryMigrationStorage } from "../../../src/server/migrations/in-memory-storage";
import { forward, rollback } from "../../../src/server/migrations/runner";
import { wrapEnvelope } from "../../../src/server/migrations/envelope";

describe("Schema Versioning and Migrations", () => {
  it("denies unapproved mutation and resumes an approved batch with checksums", async () => {
    const base = identityRecordFamilies[0];
    const family = {
      ...base,
      currentVersion: 2,
      schema: z.any(),
      forward: { 1: (data: Record<string, unknown>) => ({ ...data, migrated: true }) },
      backward: {
        2: (data: Record<string, unknown>) => {
          const { migrated, ...rest } = data;
          return rest;
        },
      },
    };
    const storage = new InMemoryMigrationStorage();
    storage.seed("user:id:a", wrapEnvelope({ userId: "a" }, 1));
    storage.seed("user:id:b", wrapEnvelope({ userId: "b" }, 1));

    const denied = await forward(storage, [family], { batchSize: 1 });
    expect(denied.failureKind).toBe("precondition_failed");
    expect(await storage.get("user:id:a")).toEqual(wrapEnvelope({ userId: "a" }, 1));

    const first = await forward(storage, [family], { approval: "approved", batchSize: 1 });
    expect(first.families[0].changed).toBe(1);
    expect(first.families[0].nextCursor).toBe("user:id:a");
    expect(first.families[0].beforeChecksum).toBeTruthy();
    expect(first.families[0].afterChecksum).toBeTruthy();

    const resumed = await forward(storage, [family], {
      approval: "approved",
      batchSize: 1,
      resumeAfter: first.families[0].nextCursor,
    });
    expect(resumed.families[0].changed).toBe(1);
    expect(resumed.families[0].resumed).toBe(true);
  });

  it("blocks rollback when a backward transform is not registered", async () => {
    const family = { ...identityRecordFamilies[0], currentVersion: 2 };
    const storage = new InMemoryMigrationStorage();
    storage.seed("user:id:a", wrapEnvelope({ userId: "a" }, 2));

    const report = await rollback(storage, [family], { targetVersion: 1, approval: "approved" });
    expect(report.failureKind).toBe("rollback_blocked");
    expect(report.ok).toBe(false);
    expect(await storage.get("user:id:a")).toEqual(wrapEnvelope({ userId: "a" }, 2));
  });

  it("uses version 1 by default when no version is provided", () => {
    const testSchema = z.object({ foo: z.string() });
    // Register v1 with no migrations
    registerRecordSchema("testRecord1", 1, testSchema);

    // Provide a v0-like unversioned record
    const unversioned = { foo: "bar" };

    // validateRecord will assume it is v1, and since we are on v1, it just validates
    const result = validateRecord<{ foo: string }>("testRecord1", unversioned);
    expect(result.foo).toBe("bar");
  });

  it("applies deterministic migrations from older versions", () => {
    // Current schema is v3: { currentName: string }
    const v3Schema = z.object({ currentName: z.string() });

    const migrations = {
      // v1 -> v2: rename `oldName` to `intermediateName`
      1: (data: any) => ({ intermediateName: data.oldName }),
      // v2 -> v3: rename `intermediateName` to `currentName`
      2: (data: any) => ({ currentName: data.intermediateName }),
    };

    registerRecordSchema("testMigration", 3, v3Schema, migrations);

    // Provide an unversioned (v1) record
    const v1Record = { oldName: "alice" };

    const result = validateRecord<{ currentName: string }>("testMigration", v1Record);
    expect(result.currentName).toBe("alice");

    // Provide a v2 record
    const v2Record = { $v: 2, intermediateName: "bob" };
    const result2 = validateRecord<{ currentName: string }>("testMigration", v2Record);
    expect(result2.currentName).toBe("bob");
  });

  it("fails safely when encountering an unsupported newer schema", () => {
    const testSchema = z.object({ foo: z.string() });
    // Register as v2
    registerRecordSchema("testFuture", 2, testSchema);

    // Provide a v3 record (from the future)
    const futureRecord = { $v: 3, foo: "bar", extra: "data" };

    expect(() => validateRecord("testFuture", futureRecord)).toThrowError(DataIntegrityError);
    expect(() => validateRecord("testFuture", futureRecord)).toThrowError(
      /Unsupported newer schema version 3/,
    );
  });

  it("fails safely if a migration is missing in the chain", () => {
    const testSchema = z.object({ foo: z.string() });

    const missingMigrations = {
      // Missing v1 -> v2
      2: (data: any) => data,
    };

    registerRecordSchema("testMissing", 3, testSchema, missingMigrations);

    const v1Record = { oldName: "alice" };

    expect(() => validateRecord("testMissing", v1Record)).toThrowError(DataIntegrityError);
    expect(() => validateRecord("testMissing", v1Record)).toThrowError(
      /Missing migration from version 1 to 2/,
    );
  });

  it("versionRecord accurately stamps the current schema version", () => {
    const testSchema = z.object({ foo: z.string() });
    registerRecordSchema("testStamp", 5, testSchema);

    const data = { foo: "bar" };
    const versioned = versionRecord("testStamp", data) as any;

    expect(versioned.$v).toBe(5);
    expect(versioned.foo).toBe("bar");
  });
});
