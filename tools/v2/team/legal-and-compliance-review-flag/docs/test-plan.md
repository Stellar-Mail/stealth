# Test Plan - Legal and Compliance Review Flag

This issue covers testing and documentation for the isolated V2 team tool. The
runtime service and UI are not implemented yet, so the current automated coverage
validates the fixture contract and review boundaries that future code should keep.

## Automated Test

Run from the repository root:

```
node --test tools/v2/team/legal-and-compliance-review-flag/tests/legal-review-fixtures.test.mjs
```

Run from this tool folder:

```
node --test tests/legal-review-fixtures.test.mjs
```

No install step is required. The test uses Node built-ins only.

### Automated Coverage

The fixture test verifies:

1. Metadata identifies this tool as `legal-and-compliance-review-flag` and keeps
   scope folder-local.
2. Each review item has required fields, stable IDs, and unique email/thread
   references.
3. Risk areas, severity values, statuses, and review owners stay inside the
   documented allow-lists.
4. Sender and requester addresses use reserved `example.com`, `example.net`, or
   `example.org` domains.
5. High-risk review items include at least two explanatory signals and remain in
   a review queue status.
6. Fixture examples cover privacy, contract, regulatory, and marketing review
   areas.
7. Routing rules map to at least one covered fixture item.

## Manual Review Checklist

1. Confirm all changed files live under:

   ```
   tools/v2/team/legal-and-compliance-review-flag/
   ```

2. Open `README.md` and confirm it documents:

   - Setup requirements.
   - Test command.
   - Fixture purpose and shape.
   - Known limitations.
   - Independent review steps.

3. Open `fixtures/legal-review-items.json` and confirm:

   - Examples are synthetic and use reserved domains.
   - No real customer, employee, credential, wallet, contract, or legal advice is
     included.
   - High-risk examples explain why the item needs legal or compliance review.

4. Open `docs/review-notes.md` and confirm:

   - The contribution does not claim app integration.
   - Future implementation seams are documented as follow-up work.
   - The issue remains reviewable without running the main app.

## Future Service Test Plan

When `services/` is added in a future issue, add executable tests for:

| Behavior | Expected coverage |
| --- | --- |
| `createReviewItem(input)` | Accepts well-formed data and rejects missing IDs, invalid enum values, and empty signals. |
| `routeReviewItem(item)` | Maps privacy/contract items to legal and regulatory/marketing items to compliance. |
| `canResolveReview(status)` | Allows terminal decisions only from review queue statuses. |
| `sanitizeReviewText(value)` | Trims whitespace and rejects control characters or script-like payloads. |
| `validateSyntheticFixture(item)` | Keeps fixture safety checks reusable from tests. |

## Future UI and Accessibility Test Plan

When `components/` is added in a future issue, review:

1. Keyboard access for filter controls and decision buttons.
2. Visible labels for status, severity, risk area, and review owner.
3. `role="alert"` or equivalent announcement for validation errors.
4. Clear empty, loading, success, and blocked states.
5. No color-only indication for severity or review status.

## Known Limitations

- Current automated tests cover fixture and review-contract quality, not live
  classification logic.
- No app route, inbox data source, persistence layer, or permission model exists
  in this contribution.
- Jurisdiction values are illustrative and do not encode legal obligations.
- The fixture is intentionally small so reviewers can inspect it by hand.
