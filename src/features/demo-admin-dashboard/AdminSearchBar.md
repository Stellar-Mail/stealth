# Admin Search Bar

A local, presentational search bar for demo-admin dashboard tables and pickers.

## Parts

- AdminSearchBar — controlled input with a search icon, a clear (X) button that appears once text is entered, and a live result count.
- filterRows(rows, query, fields) — pure, generic, case-insensitive filter. An empty or whitespace-only query returns all rows.
- searchAdminRecords(rows, query) — wrapper bound to the demo record shape (searches name, address, role, status).
- resultCountLabel(count, total) — formats counts as "3 results" or "2 results of 8".
- demoAdminRecords — deterministic, fake fixture data safe for public review.

## Usage

Keep the query in parent state, derive filtered rows with filterRows (or searchAdminRecords), and pass the counts to the bar:

- value — the query string
- onChange — update the query
- resultCount — filtered rows length
- totalCount — full dataset length

The component does not filter internally, so it can be reused with any table by supplying the searchable fields in the parent.

## Notes

- No production mail flows, network calls, or real user data are used.
- Filtering is synchronous and deterministic for stable demo behaviour.
