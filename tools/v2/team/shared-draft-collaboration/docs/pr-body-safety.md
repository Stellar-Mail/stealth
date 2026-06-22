## Summary

Adds safety and performance constraints to the **Shared Draft Collaboration** tool inside its isolated workspace `tools/v2/team/shared-draft-collaboration/`.

## Deliverables

### Validation Guards (`guards/draft-guards.mjs`)

- `sanitizeText(raw)`: Strips HTML tags (XSS protection) and control characters like CRLF/null bytes.
- `validateDraftId(id)`: Restricts IDs to 64 alphanumeric chars (with `-` and `_`) to prevent path traversals.
- `validateDraftTitle(title)` & `validateDraftSubject(subject)`: Sets string lengths caps (120 and 200 respectively).
- `validateCollaboratorCount(count)`: Restricts concurrent user limits to 1-50 range.
- `validateSearchQuery(query)`: Caps queries at 100 characters to prevent ReDoS.
- `guardDraftsCount(drafts)`: Imposes 1000 drafts limit.

### Service Updates (`services/draft.service.mjs`)

- Binds validation guards to `addDraft`, `updateDraft`, `removeDraft`, `setActive`, and filter queries.

### Unit Test Additions (`tests/shared-draft.test.mjs`)

- Adds comprehensive security tests covering HTML script tag stripping, header checks, path traversal blocks, collaborator boundaries, query length caps, and service exception handling.

### Documentation (`docs/security-and-performance.md`)

- Explains threat assumptions, input validations, and O(N) memory/processor scale limits.

## Verification

All 34 unit tests run and pass natively:

```bash
node --test tools/v2/team/shared-draft-collaboration/tests/shared-draft.test.mjs
```

No modifications made to any files outside the tool's boundary.
