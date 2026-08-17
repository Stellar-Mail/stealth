# Deterministic pagination

Cursor pagination is only safe when the underlying query has a **total order**. If two records can
compare equal, their relative position is left to storage-engine chance, and a client walking pages
can see the same record twice or never see it at all. The same failure appears when records are
inserted while a client is paging: without a total order there is no stable "position" for the
cursor to name.

This document defines the ordering contract that every paginated repository method must satisfy, and
the guarantees clients can rely on.

## The contract

Every paginated repository method declares an ordering specification with
`declareOrdering()` in [`src/server/api/repository.ts`](../../src/server/api/repository.ts):

```ts
export const PAGINATED_QUERY_ORDERINGS = {
  listPostage: declareOrdering<Postage>([{ field: "createdAt", direction: "desc" }], "messageId"),
  listReceipts: declareOrdering<Receipt>(
    [{ field: "deliveredAt", direction: "desc" }],
    "messageId",
  ),
} as const;
```

`declareOrdering` takes the primary sort keys, most significant first, and a **tie-breaker field**
that is unique across the collection. It appends the tie-breaker as the final, least significant
sort key and validates the result at module load:

- The tie-breaker may not also appear among the primary keys.
- Every field name must be non-empty and declared once.

A specification that violates either rule throws immediately, so a malformed ordering fails at
startup rather than silently producing a non-deterministic query.

The tie-breaker inherits the direction of the last primary key, so a descending primary sort yields
`ORDER BY primary_field DESC, id DESC` and a page walk never reverses direction mid-key.

Orderings are registered in `PAGINATED_QUERY_ORDERINGS`, keyed by repository method name. A
paginated method resolves its ordering with `orderingForPaginatedMethod(name)`, which throws when
the method has no declared ordering — so a new list method cannot ship without one.

## Continuation keys

A cursor carries the **complete continuation key**: the value of every sort field of the last record
on the page, including the tie-breaker — not just the primary sort value.

`continuationKeyOf(spec, record)` serializes those values in declaration order.
`paginate()` decodes the key and resumes strictly after that exact position using the same
comparator that produced the ordering. Because the key names a full position in the total order, a
tie on the primary field cannot make the server resume at the wrong record.

The key is embedded in the signed, versioned opaque cursor described in
[`src/server/api/pagination.ts`](../../src/server/api/pagination.ts), which additionally binds the
cursor to the requesting actor and the query scope. Clients must treat the cursor as opaque.

## Guarantees

For a record that exists unchanged for the whole page walk:

- **No duplicates.** It is returned at most once across all pages.
- **No skips.** It is returned at least once across all pages.

For records mutated during the walk, the usual cursor-pagination semantics apply and are stated
explicitly here:

- A record **inserted at a position already passed** is not returned. Its position is behind the
  cursor, so it cannot appear on a later page.
- A record **inserted at a position not yet reached** is returned on a later page.
- A record **deleted before it is reached** is not returned. Deletion does not shift the cursor,
  because the cursor names an absolute position in the total order rather than an offset.

These follow from the cursor naming a position rather than an offset: unlike `LIMIT/OFFSET`, an
insert or delete elsewhere in the collection never shifts the remaining pages.

## Tests

[`tests/unit/api/pagination-ordering.test.ts`](../../tests/unit/api/pagination-ordering.test.ts)
covers:

- Every record with an identical primary sort value, verifying the tie-breaker produces a stable
  total order and a full page walk yields each record exactly once.
- Inserts landing before, at, and after the cursor position between page fetches.
- Deletes between page fetches.
- Rejection of orderings without a valid unique tie-breaker.
