import { describe, expect, it } from "vitest";
import { sortData } from "../components/AdminDataTable";

interface TestItem {
  id: number;
  name: string;
  count: number;
  optional?: string | null;
}

describe("AdminDataTable sortData helper", () => {
  const items: TestItem[] = [
    { id: 1, name: "Charlie", count: 15, optional: "Yes" },
    { id: 2, name: "Alice", count: 42, optional: null },
    { id: 3, name: "Bob", count: 7, optional: "No" },
  ];

  it("returns original data if sortKey is null", () => {
    const result = sortData(items, null, "asc");
    expect(result).toEqual(items);
    // Should be a reference match (or at least return the exact same array/elements)
    expect(result).toBe(items);
  });

  it("sorts string fields in ascending order", () => {
    const result = sortData(items, "name", "asc");
    expect(result.map((item) => item.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts string fields in descending order", () => {
    const result = sortData(items, "name", "desc");
    expect(result.map((item) => item.name)).toEqual(["Charlie", "Bob", "Alice"]);
  });

  it("sorts numeric fields in ascending order", () => {
    const result = sortData(items, "count", "asc");
    expect(result.map((item) => item.count)).toEqual([7, 15, 42]);
  });

  it("sorts numeric fields in descending order", () => {
    const result = sortData(items, "count", "desc");
    expect(result.map((item) => item.count)).toEqual([42, 15, 7]);
  });

  it("handles null/undefined values by treating them as empty strings", () => {
    const result = sortData(items, "optional", "asc");
    // null optional value (Alice) should sort first in ascending
    expect(result[0].name).toBe("Alice");
  });

  it("uses custom sortValue function if provided", () => {
    const column = {
      key: "name",
      header: "Name",
      sortValue: (row: TestItem) => row.name.length,
    };
    // Charlie (7), Alice (5), Bob (3)
    const result = sortData(items, "name", "asc", column);
    expect(result.map((item) => item.name)).toEqual(["Bob", "Alice", "Charlie"]);
  });

  it("does not mutate the original array", () => {
    const itemsCopy = [...items];
    sortData(items, "name", "asc");
    expect(items).toEqual(itemsCopy);
  });
});
