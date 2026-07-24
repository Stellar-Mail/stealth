# Test Plan

## Automated Tests

Run from the repository root:

```bash
npx vitest run tools/v2/team/project-mail-binder/
```

The current suite validates:

- core business logic
- binder service behavior
- state transitions
- fixture integrity
- type guards
- accessibility constants

## Manual Review Checklist

- Confirm all changed files remain inside:

```text
tools/v2/team/project-mail-binder/
```

- Review README documentation.
- Review specs documentation.
- Confirm fixtures remain synthetic.
- Verify no application wiring has been introduced.
- Confirm accessibility guidance matches the implemented UI.

## Functional Areas Covered

- project creation
- project deletion
- mail binding
- mail unbinding
- async service behavior
- deterministic state generation
- validation logic

## Edge Cases

- duplicate project names
- unknown project IDs
- unknown mail IDs
- empty collections
- invalid input
- deterministic fixture behavior

## Future Integration Tests

When future integration work is approved, additional testing should cover:

- mailbox synchronization
- persistence layer
- routing
- navigation
- real mail service integration
- end-to-end workflows
