# Job Application Email Helper Specs

## Purpose

Define a self-contained review contract for job-application email drafts before
any future inbox, resume, attachment, or sending integration.

## Release Scope

- Release tier: V2 later-release tool
- Audience: individual
- Folder ownership: `tools/v2/individual/job-application-email-helper/`
- Integration status: isolated mini-product workspace

## In-Scope Behavior

- Model application draft requests with synthetic role and candidate metadata.
- Distinguish complete drafts from drafts needing review or consent.
- Represent blocked drafts without attempting email sending side effects.
- Provide fixture coverage for each local draft status.
- Give reviewers a single local test command.

## Out-of-Scope Behavior

- Main app routing or dashboard registration
- Inbox ingestion, mail rendering, or attachment storage changes
- Resume parsing or recruiter contact discovery
- Automatic sending, scheduling, or follow-up delivery
- Database schema or shared design system changes

## Application Draft Contract

Each expected draft should include:

- `id`: stable fixture-local draft identifier
- `role`: target role or job title
- `company`: target company display name
- `purpose`: one of `referral`, `cold-application`, `follow-up`
- `status`: one of `ready`, `needs-review`, `blocked`, `sent-sample`
- `tone`: one of `concise`, `warm`, `formal`
- `requiredFields`: fields that must be present before sending
- `sourceRequestId`: source job-application request identifier
- `reviewRequired`: true when a person must resolve missing or risky details

## Review Rules

- drafts missing required candidate or role context must need review
- drafts without consent to contact must be blocked
- sent-sample drafts must include complete review evidence
- blocked and needs-review drafts must set `reviewRequired` to true
- ready drafts should not include live sending side effects

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## Contributor Boundary

Keep all changes for this issue in this folder. If a future issue adds live
email sending, it should define consent, rate limits, privacy, and audit
constraints before connecting this tool to production mailboxes.
