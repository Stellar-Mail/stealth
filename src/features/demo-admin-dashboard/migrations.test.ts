import { describe, it, expect } from "vitest";
import { runMigrations } from "./migrations";

describe("Migration Runner", () => {
  it("should return successfully if already at target version", () => {
    const data = { version: 3, emails: [] };
    const result = runMigrations(data, 3);
    expect(result.success).toBe(true);
    expect(result.originalVersion).toBe(3);
    expect(result.targetVersion).toBe(3);
    expect(result.stepsApplied.length).toBe(0);
  });

  it("should fail on downgrade requests", () => {
    const data = { version: 3, emails: [] };
    const result = runMigrations(data, 2);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Downgrades are not supported");
  });

  it("should migrate V1 data to V2", () => {
    const v1Data = {
      version: 1,
      emails: [
        { id: "1", from: "Alice", email: "alice*stealth.xyz", trusted: true },
        { id: "2", from: "Bob", email: "bob*stealth.xyz", trusted: false },
        { id: "3", from: "Charlie", email: "charlie*stealth.xyz" },
      ],
    };

    const result = runMigrations(v1Data, 2);
    expect(result.success).toBe(true);
    expect(result.data.version).toBe(2);
    expect(result.data.emails[0].senderPolicy).toBe("allow");
    expect(result.data.emails[0].trusted).toBeUndefined();
    expect(result.data.emails[1].senderPolicy).toBe("block");
    expect(result.data.emails[1].trusted).toBeUndefined();
    expect(result.data.emails[2].senderPolicy).toBe("allow");
  });

  it("should migrate V2 data to V3 by standardizing event details", () => {
    const v2Data = {
      version: 2,
      emails: [
        {
          id: "1",
          from: "Lina",
          email: "lina*stealth.xyz",
          event: {
            title: "Design Review",
            time: "10:00 AM",
            location: "Studio",
            note: "review",
            days: [],
          },
        },
        {
          id: "2",
          from: "Marcus",
          email: "marcus*stealth.xyz",
        },
      ],
    };

    const result = runMigrations(v2Data, 3);
    expect(result.success).toBe(true);
    expect(result.data.version).toBe(3);
    expect(result.data.emails[0].event.endTime).toBe("11:00");
    expect(result.data.emails[0].event.date).toBe("2026-06-13");
    expect(result.data.emails[0].event.calendar).toBe("personal");
    expect(result.data.emails[1].event).toBeUndefined();
  });

  it("should run full V1 to V3 migration path", () => {
    const v1Data = {
      version: 1,
      emails: [
        {
          id: "1",
          from: "Alice",
          email: "alice*stealth.xyz",
          trusted: true,
          event: {
            title: "Meeting",
            time: "03:30 PM",
            location: "Room 1",
            note: "sync",
            days: [],
          },
        },
      ],
    };

    const result = runMigrations(v1Data, 3);
    expect(result.success).toBe(true);
    expect(result.data.version).toBe(3);
    expect(result.data.emails[0].senderPolicy).toBe("allow");
    expect(result.data.emails[0].event.endTime).toBe("16:30");
    expect(result.data.emails[0].event.date).toBe("2026-06-13");
    expect(result.data.emails[0].event.calendar).toBe("personal");
    expect(result.stepsApplied).toEqual(["Migrated V1 to V2", "Migrated V2 to V3"]);
  });
});
