# Confidential Mode Suggestion

This folder contains the isolated implementation for the Confidential Mode Suggestion tool.

## Purpose

The tool analyzes an email draft and recommends privacy protections before sending. It helps users identify situations where confidential mode or other privacy safeguards may be appropriate.

## Ownership Boundary

All work for this tool must stay inside:

`tools/v2/individual/confidential-mode-suggestion/`

Do not wire this tool into the main application, routing, inbox architecture, wallet core, Stellar integration, database schema, or shared design system.

## Current Status

This tool is being developed as an isolated V2 component and is not connected to the main application.

Future integration should be handled by a separate issue.

See `specs.md` for contributor expectations and project boundaries.
