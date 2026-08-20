import { afterEach, describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "../../../src/server/api/pagination";
import {
  compareByOrdering,
  continuationKeyOf,
  declareOrdering,
  orderingForPaginatedMethod,
  PAGINATED_QUERY_ORDERINGS,
  paginate,
  parseContinuationKey,
  sortByOrdering,
} from "../../../src/server/api/repository";

interface Row {
  createdAt: string;
  messageId: string;
  label?: string | null;
}

const ordering = declareOrdering<Row>([{ field: "createdAt", direction: "desc" }], "messageId");

/** Every row shares one primary sort value, so only the tie-breaker separates them. */
const TIED_AT = "2026-07-22T12:00:00.000Z";
const tied = (ids: readonly string[]): Row[] =>
  ids.map((messageId) => ({ createdAt: TIED_AT, messageId }));

/** Walks every page and returns the rows in the order the client would see them. */
function walk(source: () => readonly Row[], limit: number): Row[] {
  const seen: Row[] = [];
  let after: string | undefined;

  for (let page = 0; page < 100; page += 1) {
    const result = paginate(source(), ordering, { limit, after });
    seen.push(...result.items);
    if (result.nextContinuationKey === null) return seen;
    after = result.nextContinuationKey;
  }

  throw new Error("Pagination did not terminate");
}

describe("ordering declarations", () => {
  it("appends the tie-breaker as the least significant key", () => {
    expect(ordering.keys).toEqual([
      { field: "createdAt", direction: "desc" },
      { field: "messageId", direction: "desc" },
    ]);
    expect(ordering.tieBreaker).toBe("messageId");
  });

  it("defaults an ordering with no primary keys to ascending tie-breaker only", () => {
    expect(declareOrdering<Row>([], "messageId").keys).toEqual([
      { field: "messageId", direction: "asc" },
    ]);
  });

  it("rejects declarations that cannot produce a total order", () => {
    expect(() => declareOrdering<Row>([], "" as never)).toThrow(/tie-breaker/);
    expect(() =>
      declareOrdering<Row>([{ field: "messageId", direction: "asc" }], "messageId"),
    ).toThrow(/already the tie-breaker/);
    expect(() =>
      declareOrdering<Row>(
        [
          { field: "createdAt", direction: "asc" },
          { field: "createdAt", direction: "desc" },
        ],
        "messageId",
      ),
    ).toThrow(/more than once/);
    expect(() =>
      declareOrdering<Row>([{ field: "" as never, direction: "asc" }], "messageId"),
    ).toThrow(/sort field names/);
  });

  it("declares an ordering for every registered paginated method", () => {
    for (const [method, spec] of Object.entries(PAGINATED_QUERY_ORDERINGS)) {
      expect(spec.keys.at(-1)).toEqual({
        field: spec.tieBreaker,
        direction: expect.any(String),
      });
      expect(orderingForPaginatedMethod(method)).toBe(spec);
    }
  });

  it("fails loudly for a paginated method with no declared ordering", () => {
    expect(() => orderingForPaginatedMethod("listSomethingNew")).toThrow(
      /has no declared ordering/,
    );
  });

  it("orders nullish values after defined ones and rejects incomparable values", () => {
    const withLabels = declareOrdering<Row>([{ field: "label", direction: "asc" }], "messageId");
    const rows: Row[] = [
      { createdAt: TIED_AT, messageId: "b", label: null },
      { createdAt: TIED_AT, messageId: "a", label: "z" },
    ];
    expect(sortByOrdering(rows, withLabels).map((row) => row.messageId)).toEqual(["a", "b"]);

    const mixed = [
      { createdAt: TIED_AT, messageId: "a", label: "z" },
      { createdAt: TIED_AT, messageId: "b", label: 1 as unknown as string },
    ];
    expect(() => sortByOrdering(mixed, withLabels)).toThrow(/comparable scalars/);
  });
});

describe("continuation keys", () => {
  it("carries every sort value, not just the primary one", () => {
    expect(continuationKeyOf(ordering, { createdAt: TIED_AT, messageId: "c" })).toBe(
      JSON.stringify([TIED_AT, "c"]),
    );
  });

  it("rejects a key that does not match the ordering", () => {
    expect(() => parseContinuationKey(ordering, "not-json")).toThrow(/Invalid pagination/);
    expect(() => parseContinuationKey(ordering, JSON.stringify([TIED_AT]))).toThrow(
      /does not match this query/,
    );
    expect(() => parseContinuationKey(ordering, JSON.stringify({ createdAt: TIED_AT }))).toThrow(
      /does not match this query/,
    );
  });

  it("survives a round trip through the signed opaque cursor", () => {
    const previous = process.env.STEALTH_CURSOR_SECRET;
    process.env.STEALTH_CURSOR_SECRET = "test-secret";
    try {
      const key = continuationKeyOf(ordering, {
        createdAt: TIED_AT,
        messageId: "c",
      });
      const cursor = encodeCursor("GACTOR", key, "listReceipts");
      expect(decodeCursor(cursor, "GACTOR", "listReceipts").continuationKey).toBe(key);
      expect(parseContinuationKey(ordering, key)).toEqual([TIED_AT, "c"]);
    } finally {
      if (previous === undefined) delete process.env.STEALTH_CURSOR_SECRET;
      else process.env.STEALTH_CURSOR_SECRET = previous;
    }
  });
});

describe("paginating over a total order", () => {
  it("returns every record exactly once when all primary sort values tie", () => {
    const rows = tied(["a", "b", "c", "d", "e"]);
    const seen = walk(() => rows, 2);

    expect(seen.map((row) => row.messageId)).toEqual(["e", "d", "c", "b", "a"]);
    expect(new Set(seen.map((row) => row.messageId)).size).toBe(rows.length);
  });

  it("produces the same total order regardless of input order", () => {
    const forwards = tied(["a", "b", "c"]);
    const backwards = tied(["c", "b", "a"]);
    const ids = (rows: readonly Row[]) => sortByOrdering(rows, ordering).map((r) => r.messageId);

    expect(ids(forwards)).toEqual(ids(backwards));
  });

  it("rejects a non-positive limit", () => {
    expect(() => paginate(tied(["a"]), ordering, { limit: 0 })).toThrow(/positive integer/);
    expect(() => paginate(tied(["a"]), ordering, { limit: 1.5 })).toThrow(/positive integer/);
  });

  it("stops without a continuation key once the last page is returned", () => {
    const exact = paginate(tied(["a", "b"]), ordering, { limit: 2 });
    expect(exact.items).toHaveLength(2);
    expect(exact.nextContinuationKey).toBeNull();
  });
});

describe("concurrent writes during a page walk", () => {
  const collection = new Map<string, Row>();

  afterEach(() => collection.clear());

  const seed = (rows: readonly Row[]) => {
    for (const row of rows) collection.set(row.messageId, row);
  };
  const rows = () => [...collection.values()];

  it("never duplicates or skips a record that exists for the whole walk", () => {
    seed(tied(["a", "c", "e"]));

    const first = paginate(rows(), ordering, { limit: 2 });
    expect(first.items.map((row) => row.messageId)).toEqual(["e", "c"]);

    // Insert on both sides of the cursor between page fetches.
    seed(tied(["d", "b"]));
    seed([{ createdAt: "2026-07-23T00:00:00.000Z", messageId: "f" }]);

    const second = paginate(rows(), ordering, {
      limit: 10,
      after: first.nextContinuationKey ?? undefined,
    });

    // "b" landed after the cursor and appears; "d" and "f" landed at positions
    // already passed and correctly do not reappear.
    expect(second.items.map((row) => row.messageId)).toEqual(["b", "a"]);
    const seen = [...first.items, ...second.items].map((row) => row.messageId);
    expect(seen).toEqual(["e", "c", "b", "a"]);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("does not shift the remaining pages when a record is deleted mid-walk", () => {
    seed(tied(["a", "b", "c", "d"]));

    const first = paginate(rows(), ordering, { limit: 2 });
    expect(first.items.map((row) => row.messageId)).toEqual(["d", "c"]);

    collection.delete("b");

    const second = paginate(rows(), ordering, {
      limit: 10,
      after: first.nextContinuationKey ?? undefined,
    });
    expect(second.items.map((row) => row.messageId)).toEqual(["a"]);
  });

  it("keeps a stable comparator across repeated sorts of a mutating collection", () => {
    seed(tied(["a", "b", "c"]));
    const compare = compareByOrdering(ordering);

    expect(compare(rows()[0], rows()[0])).toBe(0);
    expect(
      compare({ createdAt: TIED_AT, messageId: "a" }, { createdAt: TIED_AT, messageId: "b" }),
    ).toBeGreaterThan(0);
  });
});
