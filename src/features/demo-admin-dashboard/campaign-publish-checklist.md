# Campaign Publish Readiness Checklist

`campaignPublishChecklist.ts` provides pure, deterministic helpers that decide whether a demo campaign is ready for the mock publish flow in the Demo Admin Dashboard. It complements the integration-level `readiness-checklist.md` by validating an individual campaign's draft data before a mock publish is attempted.

All checks run locally against in-memory demo data. Nothing is mutated, no network calls are made, and the same input always produces the same report.

## Input

A campaign is described with a local, structural shape so the checklist can be reused independently of other dashboard modules:

- name: the campaign name.
- tags: campaign tags used for filtering the demo dataset.
- drafts: the campaign drafts, each with a subject, body, and recipients list.

## Output

`buildCampaignPublishChecklist(input)` returns a report with:

- ready: true when there are no failing blockers.
- items: every evaluated checklist item, in a stable order.
- blockers: failing items that must be resolved before publishing.
- warnings: failing items that are advisory only.
- summary: a short, human-readable status line.

## Rules

Blockers (must pass before publishing):

- campaign-name: the campaign has a non-empty name.
- has-drafts: the campaign has at least one draft.
- draft-subjects: every draft has a subject.
- draft-bodies: every draft has body content.
- draft-recipients: every draft has at least one recipient.
- no-secret-keys: no draft body or recipient contains a Stellar secret key, matching the data-sanitization guidance in readiness-checklist.md.

Warnings (advisory, do not block publishing):

- has-tags: the campaign has at least one tag.
- unique-recipients: no draft contains duplicate recipients.
- batch-size: the draft count stays within the preview limit (50 drafts).
- subject-length: no draft subject exceeds 120 characters.

## States

- Ready, no warnings: the campaign is safe to mock publish.
- Ready, with warnings: the campaign can publish, but reviewers should confirm the advisory items.
- Not ready: at least one blocker is failing and must be fixed first.

## Usage

Call `buildCampaignPublishChecklist(input)` for the full checklist, `isCampaignReadyToPublish(input)` for a quick boolean gate, and `summarizeCampaignPublishChecklist(report)` for the status line.
