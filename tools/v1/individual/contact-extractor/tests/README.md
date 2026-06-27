# Contact Extractor Test Plan

## Review Strategy

Since no implementation exists, testing is limited to documentation and fixture validation. When source code is added, the following strategy applies:

- **Unit tests** — Test extraction logic in isolation with deterministic fixtures
- **Fixture-based tests** — Validate that sample messages produce the expected extracted contacts
- **Manual review** — Documentation, structure, and boundary compliance checked by independent contributors

## Documentation Validation Checks

- [ ] All files are inside `tools/v1/individual/contact-extractor/`
- [ ] No files outside this folder were modified
- [ ] README.md contains a clear overview and ownership boundary
- [ ] specs.md is free of template placeholders and corrupted content
- [ ] Setup instructions are accurate and testable
- [ ] No real user data, secrets, or private keys appear anywhere
- [ ] Prettier formatting passes (`bun x prettier --check .`)

## Fixture Validation Scenarios

When fixtures are added, they should cover:

| Scenario           | Description                                 |
| ------------------ | ------------------------------------------- |
| Single contact     | Message with one sender, basic name + email |
| Multiple contacts  | Message body mentioning several people      |
| No contacts        | Message with no extractable contact data    |
| Malformed headers  | Missing From header, unparseable addresses  |
| Duplicate contacts | Same person appears in multiple messages    |
| Edge cases         | Empty body, special characters, long names  |

## Manual Review Checklist

- [ ] Tool purpose is clearly stated
- [ ] Audience is identified
- [ ] Ownership boundary is documented and respected
- [ ] Setup and usage documentation is complete
- [ ] Known limitations are documented
- [ ] Fixtures are documented with expected outcomes
- [ ] Review notes explain what independent reviewers should look for

## OSS Contributor Verification Steps

1. Clone the repository
2. Navigate to `tools/v1/individual/contact-extractor/`
3. Read `README.md` to understand the tool
4. Read `specs.md` for scope and constraints
5. Review `docs/setup.md` for setup instructions
6. Verify formatting with `bun x prettier --check .`
7. Confirm no files outside the tool folder were modified
8. Confirm all test data is fake and deterministic
