# Invoice Approval Workflow — Review Notes

Isolated V2 "team" tool. All review material for this tool lives in this folder.
The production logic is in `engine.ts` / `types.ts`; the UI shell is
`InvoiceApprovalWorkflow.tsx`.

## What to review

1. **Pure logic** — `engine.ts`:
   - `canProcessInvoice(invoice)` — only `PENDING` invoices are actionable.
   - `processInvoiceAction(invoice, action)` — immutable approve/reject reducer
     returning a `WorkflowResult<Invoice>` (never throws).
   - `calculatePendingTotal(invoices, currency)` — outstanding exposure per currency.
2. **Types** — `types.ts` (`Invoice`, `ApprovalAction`, `InvoiceStatus`, `WorkflowResult`).
3. **Fixtures** — `__fixtures__/mockInvoices.ts` (pending / approved / rejected / list).
4. **Tests** — `__tests__/engine.test.ts` (vitest).

## How to run the tests

```sh
# from repo root
npm install
npx vitest run src/tools/v2/team/invoice-approval-workflow
```

Expected: all `engine.test.ts` cases green (canProcess, process approve/reject,
immutability, mismatch/non-pending/no-reason errors, pending-total math).

## Known limitations

- `InvoiceApprovalWorkflow.tsx` is a presentational shell only; no state wiring.
- No persistence / auth layer — this is the isolated logic contract.
- Date fields are ISO strings; no timezone normalization is performed here.
