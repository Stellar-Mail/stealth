import { describe, it, expect } from "vitest";
import { filterRows, normalize, resultCountLabel, searchAdminRecords } from "./searchRows";
import { demoAdminRecords } from "./fixtures";

describe("normalize", () => {
  it("trims and lowercases", () => {
    expect(normalize("  AdA  ")).toBe("ada");
  });
});

describe("filterRows / searchAdminRecords", () => {
  it("returns all rows for an empty query", () => {
    expect(searchAdminRecords(demoAdminRecords, "")).toHaveLength(demoAdminRecords.length);
  });

  it("returns all rows for a whitespace-only query", () => {
    expect(searchAdminRecords(demoAdminRecords, "   ")).toHaveLength(demoAdminRecords.length);
  });

  it("matches case-insensitively by name", () => {
    const result = searchAdminRecords(demoAdminRecords, "ADA");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rec_001");
  });

  it("matches partial address text", () => {
    const result = searchAdminRecords(demoAdminRecords, "demo.stealth");
    expect(result).toHaveLength(demoAdminRecords.length);
  });

  it("matches by role", () => {
    const admins = searchAdminRecords(demoAdminRecords, "admin");
    expect(admins.length).toBeGreaterThan(0);
    expect(admins.every((r) => r.role === "Admin")).toBe(true);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchAdminRecords(demoAdminRecords, "zzzznope")).toHaveLength(0);
  });

  it("does not mutate the source array", () => {
    const copy = [...demoAdminRecords];
    searchAdminRecords(demoAdminRecords, "ada");
    expect(demoAdminRecords).toEqual(copy);
  });
});

describe("resultCountLabel", () => {
  it("uses singular for one result", () => {
    expect(resultCountLabel(1, 1)).toBe("1 result");
  });

  it("uses plural for multiple results", () => {
    expect(resultCountLabel(3, 3)).toBe("3 results");
  });

  it("shows the total when filtered", () => {
    expect(resultCountLabel(2, 8)).toBe("2 results of 8");
  });
});
