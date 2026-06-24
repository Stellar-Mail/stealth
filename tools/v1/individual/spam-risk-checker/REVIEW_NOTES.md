# Review Notes

This folder is meant to be reviewed as a self-contained mini-product.

## What to validate

- The scoring logic lives in [services/spamRiskChecker.ts](services/spamRiskChecker.ts) and uses local heuristics only.
- The tests in [tests/spamRiskChecker.test.ts](tests/spamRiskChecker.test.ts) cover low, medium, and high-risk cases without depending on the main app.
- The fixture content in [tests/fixtures.ts](tests/fixtures.ts) stays local to the tool and can be extended without touching app-wide fixtures.
- The documentation in [README.md](README.md) explains setup, usage, and current limitations.

## Isolation checklist

- No imports from the app shell, dashboard, routing, wallet, or database layers were added.
- The tool can be reviewed and tested from this folder alone.
- Any future integration with the inbox experience should be tracked as a separate follow-up issue.
