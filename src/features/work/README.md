# Stealth Work Preview

Work is a separate workspace, with its own navigation and restrained glass surfaces.
Its header entry sits beside Notifications and Personal. Personal mail keeps the
existing inbox and folder structure; Work has Overview, Mail, Tasks, Calendar and
Private notes. The workspace chunk loads on demand.

## What Works

- Overview uses actual starred mail, task counts, calendar events and note counts.
- Tasks can be added, completed, deleted and linked back to a conversation.
- Calendar reuses the existing planner, includin event editing.
- Private notes use the controlled V1 internal-comment tool, keyed by conversation.
- Switching modes preserves the mailbox selection and in-memory Work session.
- The UI uses existing theme tokens in both dark and light modes.

## Boundaries

This is a developer/demo preview, not a paid subscription or shared team service.
Production access is gated. Billing and server-authorized entitlements must be
implemented before opening paid Work. Tasks and notes live only in memory and are
discarded on reload; changing accounts does not expose another account's session.
No plaintext notes are written to browser storage, sent as mail or presented as
shared collaboration. The V2 tool prototypes remain isolated and unlinked.

## Design

The material layering follows [Apple's material guidance](https://developer.apple.com/design/human-interface-guidelines/materials):
navigation and controls use glass; readable content stays quiet. Lighting is
stationary and subtle, with no looping decorations or added row animations.
