import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  registerRecordSchema,
  validateRecord,
  versionRecord,
} from "../../../src/server/api/repository";
import { DataIntegrityError } from "../../../src/server/api/errors";

describe("Schema Versioning and Migrations", () => {
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
