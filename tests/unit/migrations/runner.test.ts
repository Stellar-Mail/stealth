import { describe, expect, it } from "vitest";

import { identityRecordFamilies } from "../../../src/server/migrations/adapters";
import { wrapEnvelope } from "../../../src/server/migrations/envelope";
import { InMemoryMigrationStorage } from "../../../src/server/migrations/in-memory-storage";
import { dryRun, forward, integrityCheck, rollback } from "../../../src/server/migrations/runner";
import type { IdentityRecordFamily } from "../../../src/server/migrations/types";

const NULL_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function validUser(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    userId,
    address: NULL_ADDRESS,
    email: `${userId}@example.com`,
    username: userId,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function validSession(sessionId: string) {
  return {
    sessionId,
    userId: "u_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-02-01T00:00:00.000Z",
    lastActiveAt: "2026-01-01T00:00:00.000Z",
  };
}

/** A v2 user family with a forward + backward transform, for migration tests. */
function v2UserFamily(): IdentityRecordFamily {
  const base = identityRecordFamilies[0];
  return {
    ...base,
    currentVersion: 2,
    schema: (base.schema as any).passthrough(),
    forward: {
      1: (data) => ({ ...data, displayName: "" }),
    },
    backward: {
      2: (data) => {
        const { displayName, ...rest } = data;
        return rest;
      },
    },
  };
}

describe("identity migration runner", () => {
  describe("dry-run", () => {
    it("reports per-family totals and forward-pending counts without mutating storage", async () => {
      const storage = new InMemoryMigrationStorage();
      storage.seed("user:id:u_1", wrapEnvelope(validUser("u_1"), 1));
      storage.seed("session:s_1", wrapEnvelope(validSession("s_1"), 1));

      const report = await dryRun(storage, [v2UserFamily()]);
      const user = report.families.find((f) => f.family === "user")!;
      expect(user.totalKeys).toBe(1);
      expect(user.forwardPending).toBe(1);
      expect(user.changed).toBe(0);

      const stored = await storage.get("user:id:u_1");
      expect(stored).toEqual(wrapEnvelope(validUser("u_1"), 1));
      expect(report.ok).toBe(true);
    });

    it("flags records newer than the current schema version", async () => {
      const storage = new InMemoryMigrationStorage();
      storage.seed("user:id:u_9", wrapEnvelope(validUser("u_9"), 3));

      const report = await dryRun(storage, [v2UserFamily()]);
      const user = report.families.find((f) => f.family === "user")!;
      expect(user.failed).toBe(1);
      expect(user.errors[0]).toContain("unsupported schema version 3");
      expect(report.ok).toBe(false);
    });
  });

  describe("forward", () => {
    it("migrates v1 -> v2 and is restartable with exact counts", async () => {
      const storage = new InMemoryMigrationStorage();
      storage.seed("user:id:u_1", wrapEnvelope(validUser("u_1"), 1));

      const first = await forward(storage, [v2UserFamily()], { approval: "approved" });
      const user = first.families.find((f) => f.family === "user")!;
      expect(user.changed).toBe(1);
      expect(user.skipped).toBe(0);
      expect(first.ok).toBe(true);

      const stored = await storage.get("user:id:u_1");
      expect(stored).toMatchObject({ $v: 2, displayName: "" });

      const second = await forward(storage, [v2UserFamily()], { approval: "approved" });
      const user2 = second.families.find((f) => f.family === "user")!;
      expect(user2.changed).toBe(0);
      expect(user2.skipped).toBe(1);
      expect(user2.failed).toBe(0);
      expect(second.ok).toBe(true);
    });

    it("leaves records untouched and reports failure when a forward step is missing", async () => {
      const family = v2UserFamily();
      family.currentVersion = 3;
      const storage = new InMemoryMigrationStorage();
      const seeded = wrapEnvelope(validUser("u_1"), 1);
      storage.seed("user:id:u_1", seeded);

      const report = await forward(storage, [family], { approval: "approved" });
      const user = report.families.find((f) => f.family === "user")!;
      expect(user.failed).toBe(1);
      expect(user.errors[0]).toContain("missing forward migration step");
      expect(report.ok).toBe(false);
      expect(await storage.get("user:id:u_1")).toEqual(seeded);
    });
  });

  describe("rollback", () => {
    it("rejects a run without a target version", async () => {
      const report = await rollback(new InMemoryMigrationStorage(), identityRecordFamilies, {});
      expect(report.ok).toBe(false);
      expect(report.families[0].errors[0]).toContain("--target-version");
    });

    it("reverts v2 -> v1 with a backward transform and is restartable", async () => {
      const storage = new InMemoryMigrationStorage();
      storage.seed("user:id:u_1", wrapEnvelope({ ...validUser("u_1"), displayName: "Al" }, 2));

      const first = await rollback(storage, [v2UserFamily()], {
        targetVersion: 1,
        approval: "approved",
      });
      const user = first.families.find((f) => f.family === "user")!;
      expect(user.changed).toBe(1);
      expect(first.ok).toBe(true);

      const stored = await storage.get("user:id:u_1");
      expect(stored).toMatchObject({ $v: 1 });
      expect(stored).not.toHaveProperty("displayName");

      const second = await rollback(storage, [v2UserFamily()], {
        targetVersion: 1,
        approval: "approved",
      });
      const user2 = second.families.find((f) => f.family === "user")!;
      expect(user2.changed).toBe(0);
      expect(user2.skipped).toBe(1);
    });

    it("reports failure without mutating when a backward step is missing", async () => {
      const family = v2UserFamily();
      family.currentVersion = 3;
      family.forward = {
        1: (d) => ({ ...d, a: 1 }),
        2: (d) => ({ ...d, b: 2 }),
      };
      family.backward = {
        2: (d) => {
          const { a, ...rest } = d;
          return rest;
        },
      };
      const storage = new InMemoryMigrationStorage();
      storage.seed("user:id:u_1", wrapEnvelope(validUser("u_1"), 3));

      const report = await rollback(storage, [family], { targetVersion: 1, approval: "approved" });
      const user = report.families.find((f) => f.family === "user")!;
      expect(user.failed).toBe(1);
      expect(user.errors[0]).toContain("missing backward migration step");
      expect(report.ok).toBe(false);
    });
  });

  describe("integrity-check", () => {
    it("reports a clean bill of health for consistent identity records", async () => {
      const storage = new InMemoryMigrationStorage();
      const user = validUser("u_1");
      storage.seed("user:id:u_1", wrapEnvelope(user, 1));
      storage.seed("user:email:u_1@example.com", user.userId);
      storage.seed("user:username:u_1", user.userId);
      storage.seed(
        "user:address:GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        user.userId,
      );
      storage.seed("session:s_1", wrapEnvelope(validSession("s_1"), 1));

      const report = await integrityCheck(storage, identityRecordFamilies);
      const userReport = report.families.find((f) => f.family === "user")!;
      const sessionReport = report.families.find((f) => f.family === "session")!;
      expect(userReport.issues).toEqual([]);
      expect(sessionReport.issues).toEqual([]);
      expect(report.ok).toBe(true);
    });

    it("detects invalid, missing, mismatched and dangling index records", async () => {
      const storage = new InMemoryMigrationStorage();

      const badUser = validUser("u_bad", { address: "not-a-stellar-address" });
      storage.seed("user:id:u_bad", wrapEnvelope(badUser, 1));
      storage.seed("user:email:u_bad@example.com", "u_bad");
      storage.seed("user:username:u_bad", "u_bad");

      const orphan = validUser("u_missing_index");
      storage.seed("user:id:u_missing_index", wrapEnvelope(orphan, 1));
      // no email/username/address indexes written

      const wrongOwner = validUser("u_wrong");
      storage.seed("user:id:u_wrong", wrapEnvelope(wrongOwner, 1));
      storage.seed("user:email:u_wrong@example.com", "someone-else");
      storage.seed("user:username:u_wrong", "u_wrong");
      storage.seed(
        "user:address:GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        "u_wrong",
      );

      storage.seed("user:username:ghost", "u_does_not_exist");

      const report = await integrityCheck(storage, identityRecordFamilies);
      const user = report.families.find((f) => f.family === "user")!;
      const kinds = user.issues.map((i) => i.kind).sort();

      expect(kinds).toContain("invalid_record");
      expect(kinds).toContain("missing_index");
      expect(kinds).toContain("index_mismatch");
      expect(report.ok).toBe(false);

      const username = report.families.find((f) => f.family === "username")!;
      expect(username.issues.some((i) => i.kind === "dangling_index")).toBe(true);
    });

    it("detects records at an unsupported schema version", async () => {
      const storage = new InMemoryMigrationStorage();
      storage.seed("user:id:u_9", wrapEnvelope(validUser("u_9"), 9));

      const report = await integrityCheck(storage, identityRecordFamilies);
      const user = report.families.find((f) => f.family === "user")!;
      expect(user.issues.some((i) => i.kind === "unsupported_version")).toBe(true);
    });

    it("never echoes record payloads or full index values in the report", async () => {
      const storage = new InMemoryMigrationStorage();
      storage.seed("user:id:secret-user", wrapEnvelope(validUser("secret-user"), 1));
      storage.seed("user:email:topsecret@example.com", "someone-else");
      storage.seed("user:username:secret-user", "secret-user");
      storage.seed(
        "user:address:GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        "secret-user",
      );

      const report = await integrityCheck(storage, identityRecordFamilies);
      const serialized = JSON.stringify(report);

      expect(serialized).not.toContain("topsecret@example.com");
      expect(serialized).not.toContain("secret-user");
      expect(serialized).not.toContain("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
      expect(serialized).toContain("user:email:");
    });
  });
});
