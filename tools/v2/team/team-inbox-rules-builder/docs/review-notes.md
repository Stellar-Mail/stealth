# Review Notes for OSS Contributors

Thank you for helping review the `Team Inbox Rules Builder` tool! This issue focuses on delivering a robust, isolated core for rule evaluation, storage, and UI states.

## Review Goals

1. **Isolation Check**: Ensure NO files outside of `tools/v2/team/team-inbox-rules-builder/` have been modified. This component must remain completely decoupled from the main application.
2. **Core Logic Validation**: Check `services/rule-engine.service.ts` and `services/rule-storage.service.ts`. Ensure they don't have side effects that would make future integration difficult.
3. **Test Completeness**: We have a comprehensive test suite (or documented `tests/test-plan.md` if tests are pending) and local fixtures (`fixtures/rules.fixtures.ts`). Verify the tests cover the primary edge cases, particularly rule priority and disabled states.
4. **Documentation**: Ensure `README.md` clearly outlines how a future developer could hook this into the main app.

## How to Test Locally

Since this tool is not wired to the main app, you can validate its behavior by running the localized tests:

```bash
bun x vitest tools/v2/team/team-inbox-rules-builder/tests/
```

If the tests are still being mapped out via `test-plan.md`, please review the plan to ensure all logical operators (`equals`, `contains`, `startsWith`, `endsWith`, `matches`, `exists`, `notExists`) are accounted for.

## Future Work

If you notice missing integration pieces (e.g., connecting it to real backend endpoints or the global redux store), please do NOT add them here. Instead, open a follow-up issue tagged with `[V2 Integration]`. This issue strictly covers the isolated implementation.
