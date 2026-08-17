# Customer Support Macro Tool

This folder contains the isolated implementation for the Customer Support Macro Tool.

## Purpose

The tool allows support teams to create, organize, search, and apply reusable customer response macros with variable placeholders.

## Ownership Boundary

All work for this tool must stay inside:

`tools/v1/team/customer-support-macro-tool/`

Do not wire this tool into the main application, routing, inbox architecture, wallet core, Stellar integration, database schema, or shared design system.

## Current Status

This tool is developed as an isolated V1 component.

Future integration with the mail application should be completed through a dedicated follow-up issue.

See `specs.md` for contributor expectations and implementation boundaries.
