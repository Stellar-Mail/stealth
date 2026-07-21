export { paymentService } from "./payment.service";
export { decisionService, persistentDecisionService } from "./decision.service";
export {
  createPaymentApprovalExecutor,
  type PaymentApprovalExecutor,
  type PaymentApprovalExecutorDeps,
  type PaymentApprovalStore,
} from "./execution.service";

import { createPaymentApprovalExecutor } from "./execution.service";
import { paymentService } from "./payment.service";

/**
 * Backend-facing service entry point bound to the local payment service.
 *
 * Reusable by APIs, tests, and future automation without any UI dependency.
 * `paymentService` satisfies the minimal {@link PaymentApprovalStore} surface
 * because it exposes `getPayment`, `recordDecision`, and `getDecisions`.
 */
export const paymentApprovalExecutor = createPaymentApprovalExecutor({ store: paymentService });
