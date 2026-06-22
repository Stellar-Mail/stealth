# Collision Detection Review Notes

Use these notes to review the isolated Collision Detection folder for #428.

## Scope Checklist

- All changed files stay under `tools/v1/team/collision-detection/`.
- The contribution does not modify app shell, routing, auth, wallet, Stellar,
  database, mail renderer, or shared design-system files.
- Fixtures use synthetic `.test`-style thread data and do not include live
  mailbox content.
- Follow-up integration questions stay documented instead of being implemented
  in this issue.

## Documentation Checklist

- `README.md` explains the ownership boundary and independent review flow.
- `specs.md` defines inputs, outcomes, and out-of-scope work.
- `tests/test-plan.md` maps fixtures to expected outcomes.
- `docs/validation-notes.md` records what can be validated before production
  integration.

## Reviewer Questions

- Are the four initial outcomes enough for launch review?
- Should future semantic matching use deterministic heuristics, a model-assisted
  scorer, or both?
- What team role should be allowed to override a `duplicate` or
  `possible_duplicate` warning?
- Which future integration issue will provide live thread context?
