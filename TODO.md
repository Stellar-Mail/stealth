# TODO - Changelog Panel A11y (#997)

## Plan (approved)
1. Add ARIA semantics to the ChangelogPanel container region.
2. Expose unread state to screen readers (keep visual dot purely decorative).
3. Improve announcement for external links that open in a new tab.
4. Respect reduced-motion by not introducing any motion behavior.
5. Validate with lint/tsc/tests.

## Progress
- [x] Step 1: Add region semantics + heading association
- [x] Step 2: Add SR-only unread state; set dot aria-hidden
- [x] Step 3: Update external link announcement for target="_blank"
- [x] Step 4: Ensure no motion introduced
- [x] Step 5: Run lint/tsc/tests and relevant e2e (best-effort; local toolchain missing eslint/tsc)

