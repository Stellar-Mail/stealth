# Review Notes

## Reviewer Intent

The folder-local service prepares ticket candidates from local message records.
It does not create tickets in any external system and does not integrate with
the main inbox. The output is shaped for future UI review: title, description,
category, priority, queue, SLA hours, tags, confidence, and source metadata.

## Rule Coverage

- Security queue: breach, phishing, suspicious login, security incident, or
  production outage language.
- Billing queue: invoice, charge, payment, refund, subscription, or billing
  wording.
- Access queue: login, password, permissions, locked-out, sign-in, or access
  blockers.
- Product support: bug, broken flow, error, exception, failing, or regression
  language.
- Product feedback: feature request, roadmap, improvement, or suggestion
  language.
- Customer support: routine messages that do not match a stronger category.

## State Model

- `loading`: local mail data is not ready yet.
- `empty`: the input is valid but has no messages.
- `success`: all messages were converted into reviewable ticket candidates.
- `error`: invalid local input shape; no conversion is attempted.

## Data Safety

Fixtures are invented and deterministic. The service does not read production
mail, persist records, call APIs, fetch remote resources, use secrets, or submit
tickets to an external system.
