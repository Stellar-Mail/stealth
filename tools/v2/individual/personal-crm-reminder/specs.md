# Personal CRM Reminder

Follow-up relationship management.

## Scope

- Release tier: $(System.Collections.Hashtable.Tier.ToUpperInvariant())
- Audience: $(System.Collections.Hashtable.Audience)
- Folder ownership: $dir/

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

Recommended internal structure:

- components/
- services/
- hooks/
-     ests/
- docs/
  "@ | Set-Content -Path "tools/v2/individual/personal-crm-reminder/README.md"
  @"

# Personal CRM Reminder Specs

## Purpose

Follow-up relationship management.

## Contributor boundary

All work for this tool should stay in:

$dir/

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
