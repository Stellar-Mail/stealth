# Mail-to-Ticket Converter

Folder-local architecture contract for the V2 Mail-to-Ticket Converter team tool.
The tool will turn normalized mail data into reviewable ticket drafts, but this
issue does not implement or integrate that behavior.

## Status

- Release tier: V2 later-release tool
- Audience: Team
- Integration status: Isolated and not mounted in the main application
- Owned path: `tools/v2/team/mail-to-ticket-converter/`

## Documents

- [Architecture](ARCHITECTURE.md) defines module responsibilities and dependency
  direction.
- [Specification](specs.md) defines the future tool contract and non-goals.
- [Data ownership](docs/data-ownership.md) defines input, derived, and persisted
  data boundaries.
- [Integration constraints](docs/integration-constraints.md) defines allowed and
  forbidden dependencies.
- [Test plan](tests/test-plan.md) defines future contract-level coverage.

All future work for this tool must remain inside this directory until a separate
integration issue explicitly authorizes changes elsewhere.
