# Spam Risk Checker Specs

## Purpose

Provide a lightweight, folder-local risk scoring helper for incoming message content.

## Contributor boundary

All work for this tool should stay inside this folder so it remains isolated from the main application shell and inbox architecture.

## Recommended structure

- services/ for the scoring logic
- tests/ for local Vitest coverage
- fixtures for sample inputs
- docs for setup and review notes

## Review focus

- Keep the implementation deterministic and easy to reason about
- Prefer local fixtures over app-wide test data
- Avoid integration work unless a dedicated follow-up issue is created
