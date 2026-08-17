# Escalation Tool

The Escalation Tool is an isolated V2 team workspace for managing conversation escalation workflows.

This workspace is intentionally independent from the main application until a future integration issue explicitly authorizes wiring it into the product.

## Purpose

The tool supports team workflows that require escalating conversations based on predefined business rules or manual review. It exports a presentation-independent backend service contract so execution can run independently of UI concerns.

## Ownership Boundary

All work for this tool must remain inside:

```text
tools/v2/team/escalation-tool/
```

Do not modify or integrate with:

- Main application shell
- Dashboard layout
- Navigation
- Authentication
- Wallet or Stellar integration
- Mail rendering
- Inbox architecture
- Database schema
- Shared design system

## Execution & Service Entry Point

```ts
import { escalationToolService } from "./tools/v2/team/escalation-tool";

const result = await escalationToolService.execute({
  conversationId: "conv-123",
  reason: "SLA breach",
  priority: "high",
  requestedBy: "user-456",
});
```

See `CONTRACT.md` for complete input, output, error code, and service boundary specifications.

## Documentation

- `CONTRACT.md` — backend execution contract, error codes, and service boundaries
- `specs.md` — tool scope and contributor expectations
- `docs/TEST_PLAN.md` — validation strategy and unit test verification
- `docs/REVIEW_NOTES.md` — reviewer guidance

## Testing

Run isolated unit tests for this workspace:

```bash
npx vitest run --config tools/v2/team/escalation-tool/vitest.config.ts
```
