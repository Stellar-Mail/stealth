# Customer Support Macro Tool

Reusable responses.

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
  "@ | Set-Content -Path "tools/v1/team/customer-support-macro-tool/README.md"
  @"

# Customer Support Macro Tool Specs

## Purpose

Reusable responses.

## Contributor boundary

All work for this tool should stay in:

$dir/

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
