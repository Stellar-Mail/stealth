# Test Plan

## Automated Fixture Test

Run from the repository root:

```bash
node --test tools/v1/individual/contact-extractor/tests/contact-extractor-fixtures.test.mjs
```

Expected result:

- the fixture parses as JSON
- success and error cases are represented
- empty, loading, error, and success UI states are documented
- accessibility checks cover labels, live regions, alerts, checkboxes, focus, and
  keyboard controls
- expected contacts include display name, email, and organization context

## Manual Review Checklist

1. Open `ContactExtractorUI.tsx`.
2. Confirm the email text input has a visible label and helper text.
3. Confirm extraction controls are real buttons and disable during loading.
4. Confirm errors render with `role="alert"`.
5. Confirm result announcements use `aria-live="polite"`.
6. Confirm contact selection uses labelled checkboxes.
7. Confirm no files outside `tools/v1/individual/contact-extractor/` changed.

## Edge Cases Covered

- multiple contacts from one thread
- a signature-style single contact
- text with no contact-like details
- contacts missing phone numbers and requiring review

## Future Integration Tests

When a later issue mounts the tool, add coverage for:

- browser rendering with keyboard-only navigation
- focus movement after extraction and error states
- contact deduplication against existing user contacts
- save/export failure handling
- consent and audit behavior before writing contact records
