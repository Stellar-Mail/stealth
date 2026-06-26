import { describe, it, expect } from "vitest";
import {
  matchIdentity,
  matchAllIdentities,
  classifyMatches,
  nameSimilarity,
  type ContactRef,
} from "@/features/contacts/import/identityMatcher";
import type { ImportedContactRow } from "@/features/contacts/import/types";

const GA = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const GB = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const GC = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const GD = "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const GX = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

const KNOWN: ContactRef[] = [
  { id: "c1", name: "Alice Anderson", address: GA, trusted: true },
  { id: "c2", name: "Bob Builder", address: GB, trusted: false },
  { id: "c3", name: "Carol Chen", address: GC, trusted: false },
];

function makeRow(overrides: Partial<ImportedContactRow> = {}): ImportedContactRow {
  return {
    id: "test-1",
    name: "",
    address: "",
    source: "csv",
    trust: "default",
    match: null,
    error: null,
    ...overrides,
  };
}

describe("nameSimilarity", () => {
  it("returns 1.0 for exact match (case-insensitive)", () => {
    expect(nameSimilarity("Alice", "alice")).toBe(1);
    expect(nameSimilarity("Bob Builder", "bob builder")).toBe(1);
  });

  it("returns >0.6 for minor typos", () => {
    const score = nameSimilarity("Alice Anderson", "Alic Anderson");
    expect(score).toBeGreaterThan(0.6);
  });

  it("returns 0 for empty strings", () => {
    expect(nameSimilarity("", "Alice")).toBe(0);
    expect(nameSimilarity("Alice", "")).toBe(0);
    expect(nameSimilarity("", "")).toBe(0);
  });

  it("returns 0 for completely different names", () => {
    expect(nameSimilarity("Alice", "Zyxw")).toBe(0);
  });

  it("handles substring names", () => {
    const score = nameSimilarity("Al", "Alice");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.6);
  });
});

describe("matchIdentity", () => {
  it("returns exact match when address matches a known contact", () => {
    const row = makeRow({
      name: "Alice Anderson",
      address: GA,
    });
    const result = matchIdentity(row, KNOWN);
    expect(result.type).toBe("exact");
    expect(result.confidence).toBe(1);
    expect(result.matchedAddress).toBe(GA);
  });

  it("returns ambiguous match when name is similar but address differs", () => {
    const row = makeRow({
      name: "Alice Anderson",
      address: GD,
    });
    const result = matchIdentity(row, KNOWN);
    expect(result.type).toBe("ambiguous");
    expect(result.matchedAddress).toBe(GA);
    expect(result.matchedName).toBe("Alice Anderson");
  });

  it("returns none when address cannot be resolved", () => {
    const row = makeRow({
      name: "Alice",
      address: "not-an-address",
    });
    const result = matchIdentity(row, KNOWN);
    expect(result.type).toBe("none");
  });

  it("returns none when name is empty and no address match", () => {
    const row = makeRow({
      name: "",
      address: GX,
    });
    const result = matchIdentity(row, KNOWN);
    expect(result.type).toBe("none");
  });

  it("returns exact when name and address both match", () => {
    const row = makeRow({
      name: "Bob Builder",
      address: GB,
    });
    const result = matchIdentity(row, KNOWN);
    expect(result.type).toBe("exact");
  });
});

describe("matchAllIdentities", () => {
  it("matches all rows against known contacts", () => {
    const rows: ImportedContactRow[] = [
      makeRow({ id: "r1", name: "Alice Anderson", address: GA }),
      makeRow({ id: "r2", name: "Unknown Person", address: GX }),
      makeRow({ id: "r3", name: "Bob Builder", address: GB }),
    ];
    const result = matchAllIdentities(rows, KNOWN);
    expect(result[0].match?.type).toBe("exact");
    expect(result[1].match?.type).toBe("none");
    expect(result[2].match?.type).toBe("exact");
  });
});

describe("classifyMatches", () => {
  it("groups rows by match type", () => {
    const rows: ImportedContactRow[] = [
      makeRow({
        id: "r1",
        name: "Alice Anderson",
        address: GA,
        match: {
          type: "exact",
          matchedAddress: null,
          matchedName: null,
          confidence: 1,
          reason: "",
        },
      }),
      makeRow({
        id: "r2",
        name: "Fuzzy",
        address: GA,
        match: {
          type: "fuzzy",
          matchedAddress: null,
          matchedName: null,
          confidence: 0.8,
          reason: "",
        },
      }),
      makeRow({
        id: "r3",
        name: "Ambiguous",
        address: GA,
        match: {
          type: "ambiguous",
          matchedAddress: null,
          matchedName: null,
          confidence: 0.7,
          reason: "",
        },
      }),
      makeRow({
        id: "r4",
        name: "None",
        address: GA,
        match: { type: "none", matchedAddress: null, matchedName: null, confidence: 0, reason: "" },
      }),
    ];
    const { exact, fuzzy, ambiguous, none } = classifyMatches(rows);
    expect(exact).toHaveLength(1);
    expect(fuzzy).toHaveLength(1);
    expect(ambiguous).toHaveLength(1);
    expect(none).toHaveLength(1);
  });
});
