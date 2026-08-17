# Invoice Approval Workflow

This folder is the isolated workspace for the Invoice Approval Workflow tool — a
presentation-free service that runs an invoice review process: submit →
approve/reject → list by status.

## Ownership Boundary

All work for this tool must stay inside:
`tools/v2/team/invoice-approval-workflow/`

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, or existing design system unless a future
integration issue explicitly allows it.

See `specs.md` for the architecture contract, issue categories, and contributor
expectations.

## Non-UI execution contract

The workflow exposes a presentation-free execution contract so it can run as a
backend service, independent of any UI.

- `types.ts` — domain types: `Invoice`, `InvoiceInput`, `InvoiceStatus`,
  `ApprovalDecision`.
- `contract.ts` — the typed contract: `InvoiceOperation`, `InvoiceContractOutput`,
  the `InvoiceResult<T>` discriminated union, and explicit `InvoiceErrorCode`
  values. Also holds the pure reducer `applyInvoiceOperation` plus
  `validateInvoiceInput`.
- `services/invoice-approval.service.ts` — `createInvoiceApprovalContract()`
  keeps state in an in-memory map and adapts the pure reducer into an
  `InvoiceContract` whose `execute(...)` returns typed success/error results
  instead of throwing.
- `fixtures.ts` — representative submit inputs (valid, non-positive amount,
  missing vendor).
- `tests/contract.test.ts` — vitest coverage of the submit → approve/reject →
  list lifecycle plus the validation / not-found / invalid-state error paths.

Usage:

```ts
import { createInvoiceApprovalContract } from ".";

const contract = createInvoiceApprovalContract();
const submitted = contract.execute({
  operation: "submit",
  input: { vendor: "Acme Hosting LLC", amount: 1250, submittedBy: "finops@acme.example.com" },
});
if (submitted.ok && submitted.value.operation === "submit") {
  const id = submitted.value.invoice.id;
  const decided = contract.execute({ operation: "approve", id, approver: "lead@acme.example.com" });
  // decided.ok === true, or decided.error is an InvoiceErrorCode
}
```
