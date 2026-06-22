## Summary

Establishes the **Role-Based Mail Access** tool's isolated architecture contracts (module boundaries, integration limits, and data ownership definitions) inside `tools/v2/team/role-based-mail-access/`.

## Deliverables

1. **`MODULE_BOUNDARIES.md`**: Defines responsibilities and public interface signatures for:
   - low-level guard validation helper sub-modules
   - pure state management factories
   - React custom syncing hooks
   - presentational visual layout components
2. **`DATA_OWNERSHIP.md`**: Clarifies the lifecycle flow of credentials, temporary session RAM, policies configurations, immutable log collections, and security checks.
3. **`INTEGRATION_CONSTRAINTS.md`**: Details non-negotiable boundaries, forbidden relative imports from `src/`, database isolation rules, routing restrictions, and validation checklists.

## Verification

All local unit test suites run and pass cleanly:

- Native guard tests check happy-path and 19 hostile threat vectors.
- Vitest tests verify UI service policies changes.
