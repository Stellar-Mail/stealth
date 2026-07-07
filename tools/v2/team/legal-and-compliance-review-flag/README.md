# Legal and Compliance Review Flag

Folder-local review kit for the V2 team Legal and Compliance Review Flag tool.
This contribution documents the independent test surface for the tool while the
runtime implementation is still pending.

## Ownership Boundary

All work for this tool must stay inside:

```
tools/v2/team/legal-and-compliance-review-flag/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core,
Stellar integration, database schema, or design system unless a future integration
issue explicitly allows it.

## Folder Structure

```
legal-and-compliance-review-flag/
  docs/
    test-plan.md                     Independent automated and manual test plan
    review-notes.md                  OSS reviewer guide and boundaries
  fixtures/
    legal-review-items.json          Synthetic legal/compliance review examples
  tests/
    legal-review-fixtures.test.mjs   Executable fixture and contract checks
  README.md                          Setup, usage, fixtures, limitations
  specs.md                           Scope and contributor expectations
```

## Setup

No package install is required for the current review kit. The executable tests use
only Node built-ins.

Requirements:

- Node 18 or later.
- Run commands from the repository root, or from this tool folder as noted below.

## Running the Tests

From the repository root:

```
node --test tools/v2/team/legal-and-compliance-review-flag/tests/legal-review-fixtures.test.mjs
```

From this folder:

```
node --test tests/legal-review-fixtures.test.mjs
```

The tests validate that fixture records are complete, use only reserved example
domains, cover the expected legal/compliance risk areas, and keep review routing
values inside the documented contract.

## Reviewing This Tool Independently

1. Confirm every changed file lives under this folder.
2. Run the fixture test command above.
3. Read `docs/test-plan.md` for the manual review checklist.
4. Read `docs/review-notes.md` for the expected boundaries and future integration
   points.
5. Confirm the fixture data is synthetic and does not contain real customers,
   credentials, wallet values, or legal advice.

## Fixture Contract

`fixtures/legal-review-items.json` contains synthetic examples for messages that
should be routed to legal or compliance review before a team acts on them.

Each review item includes:

- Stable IDs for the review item, email, and thread.
- Synthetic sender/requester addresses using reserved example domains.
- A `riskArea` such as `privacy`, `contract`, `regulatory`, or `marketing`.
- A severity tier: `critical`, `high`, `medium`, or `low`.
- A review status such as `needs-legal-review`, `needs-compliance-review`,
  `approved-with-notes`, `blocked`, or `monitoring`.
- Human-readable signals and a recommended action for reviewers.

The fixture also includes routing rules so future service tests can assert that
specific risk areas map to the right review owner.

## Known Limitations

- This is a documentation and fixture validation contribution. It does not add the
  future service, hook, UI component, persistence layer, or app integration.
- The current tests validate review data shape and review-contract safety. They do
  not classify live email content.
- Fixture examples are not legal advice and should not be treated as a compliance
  policy source.
- No external API calls, LLM calls, sender reputation checks, or jurisdictional
  rule engines are included.
- Authentication, authorization, audit logging, and durable storage belong to
  future integration issues.

## Acceptance Checklist

- [x] Tests and test plan live inside this folder.
- [x] Documentation explains independent setup and review.
- [x] Fixtures are folder-local and synthetic.
- [x] No files outside `tools/v2/team/legal-and-compliance-review-flag/` are needed.
- [x] The contribution is reviewable as a self-contained mini-product change.
