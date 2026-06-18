import type { PaymentRequest, ApprovalDecision, ApprovalWorkflow } from "../types";

/**
 * Local Payment Service
 *
 * Handles local payment data operations for the tool.
 * Do not wire this into the main wallet or Stellar integration.
 */

class PaymentService {
  private payments: Map<string, PaymentRequest> = new Map();
  private decisions: Map<string, ApprovalDecision[]> = new Map();
  private workflows: Map<string, ApprovalWorkflow> = new Map();

  /**
   * Add or update a payment request
   */
  addPayment(payment: PaymentRequest): void {
    this.payments.set(payment.id, payment);
  }

  /**
   * Get a specific payment
   */
  getPayment(id: string): PaymentRequest | undefined {
    return this.payments.get(id);
  }

  /**
   * Get all payments
   */
  getAllPayments(): PaymentRequest[] {
    return Array.from(this.payments.values());
  }

  /**
   * Get pending payments only
   */
  getPendingPayments(): PaymentRequest[] {
    return Array.from(this.payments.values()).filter((p) => p.status === "pending");
  }

  /**
   * Update payment status
   */
  updatePaymentStatus(id: string, status: "pending" | "approved" | "rejected" | "expired"): void {
    const payment = this.payments.get(id);
    if (payment) {
      payment.status = status;
    }
  }

  /**
   * Record an approval decision
   */
  recordDecision(decision: ApprovalDecision): void {
    const paymentDecisions = this.decisions.get(decision.paymentId) || [];
    paymentDecisions.push(decision);
    this.decisions.set(decision.paymentId, paymentDecisions);
  }

  /**
   * Get decisions for a payment
   */
  getDecisions(paymentId: string): ApprovalDecision[] {
    return this.decisions.get(paymentId) || [];
  }

  /**
   * Get approval workflow for a payment
   */
  getWorkflow(paymentId: string): ApprovalWorkflow | undefined {
    return this.workflows.get(paymentId);
  }

  /**
   * Create approval workflow
   */
  createWorkflow(payment: PaymentRequest, requiredApprovals: number = 2): ApprovalWorkflow {
    const workflow: ApprovalWorkflow = {
      id: `workflow-${payment.id}`,
      paymentId: payment.id,
      status: "pending",
      requiredApprovals,
      approvals: [],
      rejections: [],
      createdAt: new Date(),
    };
    this.workflows.set(payment.id, workflow);
    return workflow;
  }

  /**
   * Clear local data
   */
  clear(): void {
    this.payments.clear();
    this.decisions.clear();
    this.workflows.clear();
  }
}

// Singleton instance
export const paymentService = new PaymentService();
