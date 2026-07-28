# Setup Guide — Mail-to-Ticket Converter

This guide helps OSS contributors set up and run the Mail-to-Ticket Converter tool locally.

## Prerequisites

- Node.js 18+ installed
- Bun or npm for package management
- Git for version control

## Installation

1. Clone the repository and navigate to the project root:

```bash
git clone https://github.com/Benedict315/stealth.git
cd stealth
```

2. Install dependencies:

```bash
bun install
# or
npm install
```

## Running Tests

The tool uses Vitest for unit tests. Run tests from the repository root:

```bash
bun run test
# or
npm test
```

To run only the mail-to-ticket-converter tests:

```bash
bun run test -- mail-to-ticket-converter
# or
npm test -- mail-to-ticket-converter
```

## Project Structure

```
tools/v2/team/mail-to-ticket-converter/
├── components/       # React components for UI
├── services/         # Business logic and data processing
├── hooks/            # React hooks for state management
├── fixtures/         # Sample data for testing
├── tests/            # Test plans and documentation
├── docs/             # Documentation and guides
├── types.ts          # TypeScript type definitions
├── index.ts          # Public API exports
├── README.md         # Tool overview
├── specs.md          # Functional specification
└── ARCHITECTURE.md   # Architecture and module responsibilities
```

## Key Files to Review

- **types.ts**: Core type definitions for emails, tickets, team members, and metrics
- **fixtures/**: Sample data representing realistic email and ticket scenarios
- **docs/review-notes.md**: Validation checklist and known limitations
- **docs/integration-constraints.md**: What is and isn't allowed in this isolated tool

## Development Workflow

1. Make changes within the `tools/v2/team/mail-to-ticket-converter/` directory only
2. Run tests to verify your changes
3. Check that no files outside the tool directory are modified
4. Commit with clear, descriptive messages
5. Push your branch and create a pull request

## Important Constraints

- **Do not** modify files outside `tools/v2/team/mail-to-ticket-converter/`
- **Do not** integrate with the main application (routing, auth, database, etc.)
- **Do not** add live network calls or external API dependencies
- **Do not** include real credentials or personal data in fixtures

This is an isolated V2 tool. Integration with the main app requires a separate, approved issue.

## Getting Help

- Review the [Architecture](ARCHITECTURE.md) for module responsibilities
- Check [Integration Constraints](docs/integration-constraints.md) for allowed dependencies
- See [Review Notes](docs/review-notes.md) for validation criteria
- Refer to [Test Plan](docs/test-plan.md) for coverage expectations
