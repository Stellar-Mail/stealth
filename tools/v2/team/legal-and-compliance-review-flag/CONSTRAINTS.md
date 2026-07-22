# Legal & Compliance Review Flag - Safety & Performance Constraints

## Threat Assumptions & Unsafe Inputs

As this tool will process data sourced from potentially untrusted or highly complex sources (such as external emails, attachments, and deep thread histories), we assume the following threat vectors:

1. **Malicious Payloads (Injection & XSS)**
   - **Assumption**: `flagReason`, `reviewer`, `targetResource`, and `evidenceRefs` could contain malicious strings, HTML, or command injection sequences.
   - **Mitigation**: The `contract.ts` strictly validates inputs as strings and guarantees output only in structured data formats. Downstream consumers (e.g., UIs displaying the `flagReason`) must handle HTML escaping. No data is interpreted as executable code.

2. **Resource Exhaustion (Large Payloads)**
   - **Assumption**: An attacker or an automated script might submit excessively large strings for the reason or resource IDs to exhaust memory or database storage.
   - **Mitigation**: The `sanitizeReviewFlagInput` and `invalidFields` functions enforce strict character limits:
     - `MAX_REASON_LENGTH = 2000`
     - `MAX_REVIEWER_LENGTH = 128`
     - `MAX_RESOURCE_LENGTH = 256`

3. **Array Explosion (DDoS)**
   - **Assumption**: `evidenceRefs` could be sent as an array with millions of elements, causing CPU exhaustion during validation or out-of-memory errors.
   - **Mitigation**: `evidenceRefs` is strictly capped at a maximum of `10` items (`MAX_EVIDENCE_REFS`), and each reference string is capped at `512` characters (`MAX_EVIDENCE_REF_LENGTH`).

4. **Malformed Types**
   - **Assumption**: The incoming data might be constructed maliciously to bypass type guards (e.g., passing arrays where strings are expected).
   - **Mitigation**: `sanitizeReviewFlagInput` checks the runtime `typeof` of all values before assignment or trimming, dropping invalid types cleanly, so the resulting input is always a well-formed object before it touches any core logic.

## Performance Notes

1. **Large Emails and Attachments**
   - The flag service does _not_ read the entire email body or parse attachments. It only operates on the opaque `targetResource` identifier (e.g. `mail:thread:abc`).
   - Resolving what `targetResource` points to is delegated to the downstream `ReviewFlagDependency.resourceExists()`. The main mail app must implement this check efficiently, ideally using indexed database lookups, without fetching the entire email blob or attachment contents into memory.

2. **Large Teams and Histories**
   - We avoid unbounded work by truncating or rejecting arbitrarily large arrays (like `evidenceRefs`).
   - The tool does not load the entire review history for a resource. The dependency `findExistingFlag()` should only query for the _presence_ of an open flag (e.g., `LIMIT 1` query) rather than returning all historical flags.
