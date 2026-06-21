# Job Application Email Helper

Job Application Email Helper is an isolated V2 individual tool workspace for
drafting and reviewing job-application outreach emails before a future mail-app
integration.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/individual/job-application-email-helper/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system unless a future
integration issue explicitly allows it.

## Reviewer Setup

This issue adds folder-local documentation, fixtures, and a standalone Node test.
No app install is required to review the contribution.

Run from the repository root:

```bash
node --test tools/v2/individual/job-application-email-helper/tests/application-email-fixtures.test.mjs
```

The test validates the sample application-email fixture against the local review
contract described in `specs.md`.

## Drafting Workflow

1. Capture synthetic job target, candidate profile, and recruiter context.
2. Normalize each draft into purpose, tone, required fields, and risk flags.
3. Route each draft to `ready`, `needs-review`, `blocked`, or `sent-sample`.
4. Preserve a source request id for traceability.
5. Keep sending and recruiter contact discovery out of scope until a future
   integration issue allows it.

## Fixtures

The folder-local fixture at `fixtures/sample-application-emails.json` contains:

- a ready referral outreach draft with complete candidate and role context
- a cold application draft that needs review for missing portfolio details
- a blocked draft missing consent to contact the recruiter
- a sent-sample follow-up draft with complete review evidence

The fixture intentionally uses `example.test` addresses, synthetic people, and
fake role ids so contributors can validate behavior without using real job
applications or personal contact data.

## Documentation Map

- `specs.md` defines the local application-email draft contract and scope.
- `docs/test-plan.md` lists automated and manual review steps.
- `docs/review-notes.md` explains validation and known limits.
- `tests/application-email-fixtures.test.mjs` validates the fixture contract.

## Known Limitations

- This contribution does not add app UI or live email sending.
- Draft behavior is represented through fixture expectations only.
- Recruiter scraping, resume parsing, attachment handling, and mailbox mutation
  remain out of scope for this isolated V2 folder.
