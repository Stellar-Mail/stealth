# Team Payment Approval - Execution Contract

This document defines the **backend-facing, presentation-independent execution
contract** for the Team Payment Approval tool. It is intended for APIs, tests,
and future automation. It deliberately contains no UI, styling, or layout
concerns.

> Scope note: This contract operates on the tool's local data services. It does
> not wire into the main app, wallet, Stellar, auth, or any database. Those are
> out of scope (see `README.md` ownership boundary).

## Service Entry Point

The contract is executed through a single, non-UI service entry point:

```ts
import { paymentApprovalExecutor } from "./services";
// or construct your own bound to a custom store:
import { createPaymentApprovalExecutor } from "./services";

const result = paymentApprovalExecutor.execute(input);
```

`createPaymentApprovalExecutor({ store })` returns `{ execute }`. It is
dependency-injected: pass any object implementing `PaymentApprovalStore`
(`getPayment`, `recordDecision`, `getDecisions`). The singleton
`paymentApprovalExecutor` is pre-bound to the local `paymentService`.

The executor **never throws** for expected failures. Every outcome is returned
as a typed `PaymentApprovalResult`. Only genuinely unexpected datastore
failures surface as `INTERNAL_ERROR`.

## Input Schema (`PaymentApprovalInput`)

| Field        | Type                      | Required | Behavior                                                                                                    |
| ------------ | ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `paymentId`  | `string`                  | yes      | Stable id of the payment request being acted on. Must be non-empty.                                         |
| `approverId` | `string`                  | yes      | Identity of the approver recording the decision. Must be non-empty.                                         |
| `decision`   | `"approve" \| "reject"`   | yes      | The decision to record. Invalid values yield `VALIDATION_FAILED`.                                           |
| `notes`      | `string?`                 | no       | Free-form rationale for audit only. Never rendered as UI. Must be a string when present.                    |
| `decidedAt`  | `string \| Date?`         | no       | Authoritative decision time. Normalized to an ISO-8601 string. Defaults to now when omitted.                |
| `context`    | `PaymentApprovalContext?` | no       | Security context. Omitting it enables local/demo mode (no authorization). When present, policy is enforced. |

### `PaymentApprovalContext`

| Field           | Type        | Required | Behavior                                                                                                               |
| --------------- | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `approverId`    | `string`    | yes      | Expected to match the top-level `approverId`.                                                                          |
| `role`          | `string`    | yes      | Role used for policy evaluation (e.g. `admin`, `manager`). Unknown roles → `UNAUTHORIZED`.                             |
| `approvalLimit` | `number?`   | no       | Monetary ceiling for the caller. If the payment amount exceeds it → `APPROVER_LIMIT_EXCEEDED`. Omit to skip the check. |
| `allowedRoles`  | `string[]?` | no       | Roles permitted to approve. Defaults to `["admin","manager"]`.                                                         |

## Output Schema (`PaymentApprovalResult`)

```ts
interface PaymentApprovalResult {
  ok: boolean;
  data?: PaymentApprovalSuccess; // present when ok === true
  error?: PaymentApprovalError; // present when ok === false
}
```

### `PaymentApprovalSuccess`

| Field            | Type                    | Description                                 |
| ---------------- | ----------------------- | ------------------------------------------- |
| `paymentId`      | `string`                | Echoed input payment id.                    |
| `approverId`     | `string`                | Echoed approver id.                         |
| `decision`       | `"approve" \| "reject"` | Echoed decision.                            |
| `decidedAt`      | `string` (ISO-8601)     | Normalized decision timestamp.              |
| `status`         | `ApprovalStatus`        | Resulting status: `approved` or `rejected`. |
| `approvalCount`  | `number`                | Approvals recorded against the payment.     |
| `rejectionCount` | `number`                | Rejections recorded against the payment.    |

### `PaymentApprovalError`

| Field     | Type                       | Description                                                     |
| --------- | -------------------------- | --------------------------------------------------------------- |
| `code`    | `PaymentApprovalErrorCode` | Stable, typed error code. **Branch on this, not on `message`.** |
| `message` | `string`                   | Human-readable text. Not stable across versions.                |
| `field`   | `string?`                  | Offending field, present only for `VALIDATION_FAILED`.          |

## Error Codes

| Code                      | Meaning                             | Trigger                                                                                                      |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `VALIDATION_FAILED`       | Input failed the contract.          | Missing/empty `paymentId`, `approverId`; invalid `decision`; bad `notes`/`decidedAt` types. Carries `field`. |
| `PAYMENT_NOT_FOUND`       | Referenced payment does not exist.  | `store.getPayment` returns `undefined`.                                                                      |
| `ALREADY_DECIDED`         | A terminal decision already exists. | `store.getDecisions` is non-empty.                                                                           |
| `UNAUTHORIZED`            | Caller lacks required role.         | `context.role` is not in `allowedRoles`.                                                                     |
| `APPROVER_LIMIT_EXCEEDED` | Amount exceeds approver ceiling.    | `payment.amount > context.approvalLimit`.                                                                    |
| `INTERNAL_ERROR`          | Unexpected execution failure.       | Any thrown error inside the execution layer (e.g. datastore outage).                                         |

Consumers MUST NOT branch on `error.message`. Treat `message` as log-only.

## Execution Flow

```
execute(input)
  │
  ├─ validateInput(input)
  │     └─ invalid → { ok:false, VALIDATION_FAILED, field }
  │
  ├─ store.getPayment(paymentId)
  │     └─ missing → { ok:false, PAYMENT_NOT_FOUND }
  │
  ├─ store.getDecisions(paymentId)
  │     └─ non-empty → { ok:false, ALREADY_DECIDED }
  │
  ├─ authorize(context)
  │     └─ context present & role not allowed → { ok:false, UNAUTHORIZED }
  │
  ├─ limit check (context.approvalLimit)
  │     └─ amount > limit → { ok:false, APPROVER_LIMIT_EXCEEDED }
  │
  ├─ store.recordDecision(decision)
  │
  └─ { ok:true, data: { status, approvalCount, rejectionCount, ... } }
```

Any thrown error anywhere in the flow is caught and returned as
`{ ok:false, INTERNAL_ERROR }` — the executor never throws for handled paths.

## Service Boundaries

- **In scope:** input validation, authorization policy, limit enforcement,
  decision recording against the injected `PaymentApprovalStore`, and the
  typed result envelope.
- **Out of scope:** UI rendering, React state, DOM/localStorage, network/API
  transport, wallet/Stellar, and persistence backends. Those belong to the
  caller or to a later integration phase.
- The executor depends only on the `PaymentApprovalStore` interface, so it can
  be pointed at the production store, an in-memory fake, or a mock in tests
  without code changes.

## Fixtures

Presentation-independent fixtures live in `fixtures/execution.fixtures.ts` and
cover:

- `fixtureApproveInput` / `fixtureRejectInput` — successful execution
- `fixtureValidationFailureInput` / `fixtureInvalidDecisionInput` — validation failure
- `fixtureAuthorizationFailureInput` / `fixtureLimitExceededInput` — authorization / permission failure
- `createFailingStore()` — unexpected internal/service failure (`INTERNAL_ERROR`)
- `fixtureNotFoundInput` — `PAYMENT_NOT_FOUND` boundary

## Extension Guidance (for future contributors)

1. **Add a field:** extend `PaymentApprovalInput`/`PaymentApprovalSuccess` in
   `types/contract.ts`, update `validateInput`, and document it in this file.
   Keep UI types (`types/payment.ts`) separate from the contract.
2. **Add an error code:** add it to `PaymentApprovalErrorCode`, handle it in
   `execution.service.ts`, and add a row to the error-code table above. Never
   return free-form error strings as a code.
3. **Change authorization rules:** adjust `authorized()` /
   `DEFAULT_ALLOWED_ROLES` or pass `allowedRoles` via `context`. Do not
   hardcode role checks at call sites.
4. **Swap the backend:** implement `PaymentApprovalStore` against your real
   datastore and construct `createPaymentApprovalExecutor({ store })`. No
   changes to the executor or contract are required.
5. **Keep it backend-facing:** do not import React, DOM, or rendering
   primitives into `execution.service.ts` or `types/contract.ts`. UI lives in
   `components/`; business logic stays here.
