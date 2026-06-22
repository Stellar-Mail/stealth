# Collision Detection Test Plan

This folder does not include an executable detector yet. Until the service is
implemented, use this plan and `fixtures/collision-cases.json` to review the
expected behavior independently.

## Fixture Validation

Run from the repository root:

```bash
node -e "JSON.parse(require('fs').readFileSync('tools/v1/team/collision-detection/fixtures/collision-cases.json', 'utf8'))"
```

## Scenario Matrix

| Case | Fixture | Expected Result | Review Focus |
| --- | --- | --- | --- |
| Exact duplicate | `exact-duplicate-renewal` | `duplicate` | Same thread, same body, prior response exists |
| Semantic overlap | `possible-duplicate-shipping` | `possible_duplicate` | Similar resolution with different wording |
| Different response | `distinct-billing-followup` | `distinct` | Same team workflow but different customer problem |
| Empty draft | `invalid-empty-draft` | `invalid_input` | Required draft body is missing |

## Future Executable Tests

When the detector service is added, keep tests in this folder and cover:

- Normalized exact body matches.
- Case and whitespace-insensitive comparisons.
- Semantic overlap cases that should not auto-block.
- Distinct replies in the same thread.
- Empty draft bodies.
- Missing `threadId`.
- Missing `priorResponses`.
- Defensive behavior when optional timestamps are absent.

## Review Boundaries

- Do not import production mailbox data.
- Do not call external services.
- Do not wire the tool into inbox routing or navigation.
- Do not add app-wide tests for this issue.
