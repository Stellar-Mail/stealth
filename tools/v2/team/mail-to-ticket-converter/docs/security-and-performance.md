# Security and Performance Constraints

## Threat Assumptions and Unsafe Inputs

The Mail-to-Ticket Converter processes data derived from external emails. Emails are inherently untrusted and can contain malicious or malformed content. The following threat vectors are assumed, and the tool enforces specific constraints before any data is mapped to a ticket draft:

1. **XSS & Malicious Payloads in Body**: Email bodies can contain arbitrary HTML and scripts. The tool sanitizes input strings to strip obvious script tags and other potentially hazardous content. (Note: A more robust HTML sanitizer like DOMPurify should be used when rendering rich text, but the base service strips basic attack vectors.)
2. **Excessive String Length (Resource Exhaustion)**: Malicious actors could send extremely long subjects or bodies to exhaust memory or database limits. We enforce a `MAX_SUBJECT_LENGTH` of 255 characters and a `MAX_STRING_LENGTH` of 10,000 characters for descriptions.
3. **Missing or Invalid References**: Input IDs (like `emailId` or `assignedTo`) must be validated against existing resources to prevent mapping failures or orphaned references.
4. **Data Type Mismatches**: Incoming data is validated to ensure it conforms to expected types (e.g., strings) before processing.

## Validation & Sanitization Helpers

The tool includes a dedicated `services/guards.ts` module providing:

- `sanitizeAndValidateString`: Trims whitespace, strips `<script>` tags, and enforces maximum lengths.
- `validateArraySize`: Prevents processing extremely large arrays that could block the event loop.

These helpers are invoked inside the core `mail-to-ticket-service.ts` logic to ensure that no malformed data reaches the drafted state.

## Performance Notes for Large Datasets

1. **Large Emails and Attachments**: Rendering and parsing massive email threads can cause browser stutter or memory bloat. The conversion service limits the description length to avoid propagating excessively large text blocks to the ticket provider. Attachments (if added in the future) should be lazily loaded or size-capped.
2. **Large Teams**: Fetching a massive list of assignable team members might impact UI performance. For teams >1000 members, the future UI integration should rely on paginated searches or debounced autocompletes instead of rendering full dropdowns.
3. **Metric Calculations**: The `computeMetrics` function runs in `O(N)` time relative to the number of tickets. While acceptable for a small tool or limited local state, pulling a massive historical ticket list directly into the client will block the main thread. Future backend integration should handle metric aggregation on the server.
4. **Pagination**: Currently, `getEmails()` and `getTickets()` return full mock datasets. Any future adapter connecting to the live inbox API _must_ enforce server-side pagination and return bounded responses.
