# Review Guide - Stellar Team Payout Request

## How to Review This Tool

This document helps reviewers validate the Stellar Team Payout Request tool submission.

## Scope Verification

### Folder Boundary ✓

- [ ] All changes are within `tools/v2/team/stellar-team-payout-request/`
- [ ] No changes to main app components
- [ ] No changes to routing or navigation
- [ ] No changes to shared design system
- [ ] No modifications to authentication or wallet core
- [ ] No database schema changes

### Not Integrated

- [ ] Tool is not mounted in main app
- [ ] No new routes added to main app
- [ ] No new navigation links added

## Documentation Review

### Test Plan (`tests/TEST_PLAN.md`)

- [ ] Clear test structure and organization
- [ ] Test scenarios are comprehensive
- [ ] Happy path, error scenarios, edge cases covered
- [ ] Mocking strategy is documented
- [ ] Test naming is clear and follows patterns
- [ ] Acceptance criteria for tests are defined

**Questions to Ask:**

- Are all critical paths tested?
- Are edge cases handled?
- Is mocking strategy sound?

### Setup Guide (`docs/SETUP.md`)

- [ ] Prerequisites are clearly listed
- [ ] Installation steps are straightforward
- [ ] Folder structure is documented
- [ ] Common tasks explained
- [ ] Stellar integration points documented
- [ ] Configuration section covers env vars
- [ ] Debugging tips provided
- [ ] Integration notes are clear

**Questions to Ask:**

- Can a new contributor follow these steps?
- Are there missing prerequisites?
- Is the folder structure accurate?

### API Documentation (`docs/API.md`)

- [ ] Component interfaces documented
- [ ] Service method signatures documented
- [ ] Hook return types documented
- [ ] Usage examples provided
- [ ] Error handling documented
- [ ] Configuration documented
- [ ] Testing approach documented

**Questions to Ask:**

- Is the API clear and usable?
- Are examples correct?
- Are edge cases documented?

### Known Issues (`docs/KNOWN_ISSUES.md`)

- [ ] Current limitations are listed
- [ ] Workarounds provided for each
- [ ] Future roadmap outlined
- [ ] Issues are prioritized (High/Medium/Low)
- [ ] Related to PR issue is noted

**Questions to Ask:**

- Are limitations reasonable for V2?
- Are workarounds practical?
- Does roadmap match the issue requirements?

## Fixtures Review

### Test Data (`fixtures/`)

- [ ] Mock data is realistic
- [ ] Fixtures cover different scenarios
- [ ] No hardcoded production data
- [ ] Test accounts use testnet keys only
- [ ] Fixture format is consistent
- [ ] Comments explain fixture purpose

**Checklist:**

```typescript
// fixture should have:
// ✓ Descriptive variable names
// ✓ Comments explaining purpose
// ✓ Realistic but controlled data
// ✓ Cover multiple scenarios
// ✓ Use testnet keys/values
```

## Test Coverage Verification

### Test Plan Structure

- [ ] Unit tests section defined
- [ ] Integration tests section defined
- [ ] Fixture location specified
- [ ] Test scenarios are documented
- [ ] Running tests instructions provided
- [ ] Coverage goals specified

### Test Location

- [ ] Tests are in `tests/` folder
- [ ] Unit tests in `tests/unit/`
- [ ] Integration tests in `tests/integration/`
- [ ] Test files are co-located with implementation when possible

### Test Quality

- [ ] Tests use descriptive names
- [ ] Tests are focused (one concern)
- [ ] Error messages are clear
- [ ] Tests are independent (no order dependency)
- [ ] Mocks are appropriate for test type

## Documentation Quality

### Completeness

- [ ] All major components documented
- [ ] All services documented
- [ ] All hooks documented
- [ ] Configuration documented
- [ ] Error handling documented

### Clarity

- [ ] Code examples are correct and runnable
- [ ] API signatures are accurate
- [ ] Usage is clear and practical
- [ ] No ambiguous terminology
- [ ] Links to resources are valid

### Accessibility

- [ ] Documentation is scannable
- [ ] Headings are hierarchical
- [ ] Code blocks are syntax-highlighted
- [ ] Lists are properly formatted
- [ ] Related docs are cross-linked

## Completeness Checklist

### Documentation Files

- [ ] `tests/TEST_PLAN.md` - Test planning and coverage
- [ ] `docs/SETUP.md` - Development setup
- [ ] `docs/API.md` - Component/Service/Hook APIs
- [ ] `docs/KNOWN_ISSUES.md` - Limitations and workarounds
- [ ] Root `README.md` - Tool overview
- [ ] Root `specs.md` - Issue specifications

### Test Plan Content

- [ ] Test scope defined
- [ ] Test structure organized
- [ ] Test scenarios documented
- [ ] Happy path scenario
- [ ] Error scenarios
- [ ] Edge cases
- [ ] Acceptance criteria
- [ ] Running tests instructions
- [ ] Coverage goals
- [ ] Mocking strategy
- [ ] Dependencies listed
- [ ] Review checklist for future PRs

### Setup Guide Content

- [ ] Prerequisites listed
- [ ] Quick start section
- [ ] Folder structure documented
- [ ] Key files described
- [ ] Configuration section
- [ ] Common tasks explained
- [ ] Stellar integration explained
- [ ] Testing strategy
- [ ] Known issues referenced
- [ ] Review checklist
- [ ] Support info

### API Documentation Content

- [ ] Components documented with props
- [ ] Services documented with methods
- [ ] Hooks documented with signatures
- [ ] Types defined
- [ ] Utilities documented
- [ ] Error handling shown
- [ ] Configuration included
- [ ] Testing approach
- [ ] Usage examples
- [ ] "See Also" section

### Known Issues Content

- [ ] Current status noted
- [ ] Issues listed with description
- [ ] Impact explained
- [ ] Workarounds provided
- [ ] Component-specific issues
- [ ] Future improvements roadmap
- [ ] How to report issues
- [ ] Contributing notes

## Code Organization Check

### Folder Structure

```
stellar-team-payout-request/
├── components/        ✓ Components organized
├── services/          ✓ Business logic separated
├── hooks/             ✓ Hooks isolated
├── tests/             ✓ Tests organized by type
├── fixtures/          ✓ Test data centralized
├── docs/              ✓ Documentation together
├── README.md          ✓ Overview present
└── specs.md           ✓ Specifications present
```

- [ ] All expected folders exist
- [ ] No unexpected files in root
- [ ] Folder purposes are clear

## Documentation Usefulness

### For New Contributors

- [ ] Can they clone repo and start developing?
- [ ] Can they understand the architecture?
- [ ] Can they run tests successfully?
- [ ] Can they understand what needs work?

### For Reviewers

- [ ] Is scope clear and bounded?
- [ ] Are limitations understood?
- [ ] Is test coverage adequate?
- [ ] Is documentation quality high?

### For Future Integrators

- [ ] Are integration points documented?
- [ ] Are assumptions stated?
- [ ] Are dependencies clear?
- [ ] Is the tool self-contained?

## Red Flags

Watch for:

- [ ] ❌ Changes outside tool folder
- [ ] ❌ Main app modifications
- [ ] ❌ Production keys in fixtures
- [ ] ❌ Incomplete documentation
- [ ] ❌ No test plan
- [ ] ❌ Vague error messages
- [ ] ❌ Undocumented assumptions
- [ ] ❌ No examples provided
- [ ] ❌ Missing API documentation
- [ ] ❌ Unclear folder structure

## Sign-Off Checklist

Before approving, verify:

- [ ] All documentation is complete
- [ ] Test plan is comprehensive
- [ ] Fixtures are appropriate
- [ ] Scope is properly bounded
- [ ] Known issues are documented
- [ ] Workarounds are provided
- [ ] Setup is straightforward
- [ ] API is clear
- [ ] Examples work
- [ ] No red flags present

## Reviewer Comments Template

**For approval:**

```
Excellent documentation and test planning. The test plan is comprehensive,
fixtures are well-organized, and setup guide is clear. The tool is properly
scoped and isolated. Ready to merge.

✅ Approved
```

**For changes:**

```
Good work on the documentation. A few suggestions:

1. [Specific feedback]
2. [Specific feedback]
3. [Specific feedback]

Once updated, this will be ready to merge.

🔄 Review requested
```

## Post-Approval

After approval:

- [ ] Squash and merge to main
- [ ] Tag with issue number (#668)
- [ ] Close related issues if any
- [ ] Move task to done in project board
