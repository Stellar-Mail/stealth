import { describe, expect, it } from "vitest";
import {
  deterministicId,
  deterministicSnapshotId,
  detectCollisions,
  normalizeLabels,
  normalizeFolder,
  normalizeTimestamp,
  KNOWN_FOLDERS,
} from "../utils/normalizeDemoData";

describe("deterministicId", () => {
  it("produces stable output for the same input", () => {
    expect(deterministicId("tag", "Onboarding")).toBe("tag-onboarding");
    expect(deterministicId("tag", "Onboarding")).toBe("tag-onboarding");
  });

  it("lowercases and slugifies the name", () => {
    expect(deterministicId("tag", "Hello World")).toBe("tag-hello-world");
    expect(deterministicId("snap", "My Campaign!")).toBe("snap-my-campaign");
  });

  it("trims whitespace", () => {
    expect(deterministicId("tag", "  hello  ")).toBe("tag-hello");
  });

  it("falls back for empty input", () => {
    expect(deterministicId("tag", "")).toBe("tag-unnamed");
  });

  it("uses different prefixes", () => {
    const id1 = deterministicId("tag", "test");
    const id2 = deterministicId("snap", "test");
    expect(id1).not.toBe(id2);
    expect(id1).toBe("tag-test");
    expect(id2).toBe("snap-test");
  });
});

describe("deterministicSnapshotId", () => {
  it("returns base ID when no collision", () => {
    const existing = new Set(["snap-welcome", "snap-security"]);
    expect(deterministicSnapshotId("snap", "Newsletter", existing)).toBe("snap-newsletter");
  });

  it("appends -2 on first collision", () => {
    const existing = new Set(["snap-newsletter"]);
    expect(deterministicSnapshotId("snap", "Newsletter", existing)).toBe("snap-newsletter-2");
  });

  it("increments suffix on repeated collisions", () => {
    const existing = new Set(["snap-newsletter", "snap-newsletter-2", "snap-newsletter-3"]);
    expect(deterministicSnapshotId("snap", "Newsletter", existing)).toBe("snap-newsletter-4");
  });

  it("does not mutate the input set", () => {
    const existing = new Set(["snap-foo"]);
    const sizeBefore = existing.size;
    deterministicSnapshotId("snap", "foo", existing);
    expect(existing.size).toBe(sizeBefore);
  });
});

describe("detectCollisions", () => {
  it("returns empty set when all IDs are unique", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(detectCollisions(items).size).toBe(0);
  });

  it("detects duplicate IDs", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "a" }];
    const collisions = detectCollisions(items);
    expect(collisions.has("a")).toBe(true);
    expect(collisions.size).toBe(1);
  });

  it("detects multiple collisions", () => {
    const items = [{ id: "x" }, { id: "y" }, { id: "x" }, { id: "z" }, { id: "y" }];
    const collisions = detectCollisions(items);
    expect(collisions.has("x")).toBe(true);
    expect(collisions.has("y")).toBe(true);
    expect(collisions.size).toBe(2);
  });

  it("handles empty array", () => {
    expect(detectCollisions([]).size).toBe(0);
  });
});

describe("normalizeLabels", () => {
  it("lowercases labels", () => {
    expect(normalizeLabels(["Security", "OTP"])).toEqual(["security", "otp"]);
  });

  it("trims whitespace", () => {
    expect(normalizeLabels(["  hello  ", "world "])).toEqual(["hello", "world"]);
  });

  it("filters out empty strings", () => {
    expect(normalizeLabels(["valid", "", "  ", "also-valid"])).toEqual(["valid", "also-valid"]);
  });

  it("handles mixed case and special characters", () => {
    expect(normalizeLabels(["Bridge", "Pending"])).toEqual(["bridge", "pending"]);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeLabels([])).toEqual([]);
  });
});

describe("normalizeFolder", () => {
  it("lowercases folder name", () => {
    expect(normalizeFolder("Inbox")).toBe("inbox");
    expect(normalizeFolder("PENDING")).toBe("pending");
  });

  it("trims whitespace", () => {
    expect(normalizeFolder("  spam  ")).toBe("spam");
  });

  it("passes through known folders unchanged", () => {
    for (const folder of KNOWN_FOLDERS) {
      expect(normalizeFolder(folder)).toBe(folder);
    }
  });

  it("falls back to inbox for unknown folders", () => {
    expect(normalizeFolder("unknown")).toBe("inbox");
    expect(normalizeFolder("trash")).toBe("inbox");
  });
});

describe("normalizeTimestamp", () => {
  it("passes through valid ISO 8601 timestamps", () => {
    const ts = "2026-06-16T12:00:00Z";
    expect(normalizeTimestamp(ts)).toBe(ts);
  });

  it("passes through date-only strings", () => {
    expect(normalizeTimestamp("2026-06-16")).toBe("2026-06-16");
  });

  it("passes through relative time display strings", () => {
    expect(normalizeTimestamp("Just now")).toBe("Just now");
    expect(normalizeTimestamp("5m ago")).toBe("5m ago");
    expect(normalizeTimestamp("Yesterday")).toBe("Yesterday");
  });

  it("passes through time-only display strings", () => {
    expect(normalizeTimestamp("9:42 AM")).toBe("9:42 AM");
  });
});
