# Stellar Team Payout Request

This folder is the isolated workspace for the Stellar Team Payout Request tool.

## Ownership Boundary

All work for this tool must stay inside:

`text
.\tools\v2\team\stellar-team-payout-request\
`

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

See specs.md for the issue categories and contributor expectations.

## Security and Performance

This tool includes comprehensive security and performance documentation:

- **Security Threat Model** (docs/SECURITY_THREAT_MODEL.md) - Documents threat assumptions, unsafe inputs, and security controls
- **Validation Helpers** (docs/VALIDATION_HELPERS.md) - Specifies validation, sanitization, and guard helpers for handling malformed or hostile input
- **Performance Constraints** (docs/PERFORMANCE_CONSTRAINTS.md) - Outlines performance requirements and optimization strategies for large datasets

These documents must be reviewed before implementing any features to ensure the tool meets security and performance requirements.
