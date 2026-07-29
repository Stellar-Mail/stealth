import test from "node:test";
import assert from "node:assert/strict";

import { paymentService } from "../services/payment.service.ts";

function payment(overrides) {
  return {
    id: "pay-1",
    recipient: "Vendor",
    amount: 1000,
    currency: "USD",
    description: "Invoice",
    requestedBy: "Requester",
    requestedAt: new Date("2026-06-25T12:00:00Z"),
    priority: "normal",
    status: "pending",
    ...overrides,
  };
}

test("getPayment returns undefined for an unknown id", () => {
  paymentService.clear();
  assert.equal(paymentService.getPayment("missing"), undefined);
});

test("updatePaymentStatus is a no-op when the payment does not exist", () => {
  paymentService.clear();
  paymentService.updatePaymentStatus("missing", "approved");
  assert.equal(paymentService.getPayment("missing"), undefined);
  assert.equal(paymentService.getAllPayments().length, 0);
});

test("recordDecision accumulates multiple decisions for the same payment", () => {
  paymentService.clear();
  paymentService.recordDecision({
    approverId: "user-1",
    paymentId: "pay-1",
    decision: "approve",
    decidedAt: new Date(),
  });
  paymentService.recordDecision({
    approverId: "user-2",
    paymentId: "pay-1",
    decision: "reject",
    decidedAt: new Date(),
  });
  const decisions = paymentService.getDecisions("pay-1");
  assert.equal(decisions.length, 2);
  assert.deepEqual(
    decisions.map((d) => d.approverId),
    ["user-1", "user-2"],
  );
});

test("getDecisions returns an empty array for a payment with no decisions", () => {
  paymentService.clear();
  assert.deepEqual(paymentService.getDecisions("pay-unknown"), []);
});

test("createWorkflow defaults to requiring two approvals", () => {
  paymentService.clear();
  const workflow = paymentService.createWorkflow(payment({ id: "pay-1" }));
  assert.equal(workflow.requiredApprovals, 2);
  assert.equal(workflow.paymentId, "pay-1");
  assert.equal(workflow.status, "pending");
  assert.deepEqual(workflow.approvals, []);
  assert.deepEqual(workflow.rejections, []);
});

test("getWorkflow returns undefined when no workflow exists", () => {
  paymentService.clear();
  assert.equal(paymentService.getWorkflow("pay-none"), undefined);
});

test("clear removes payments, decisions, and workflows", () => {
  paymentService.clear();
  paymentService.addPayment(payment({ id: "pay-1" }));
  paymentService.recordDecision({
    approverId: "user-1",
    paymentId: "pay-1",
    decision: "approve",
    decidedAt: new Date(),
  });
  paymentService.createWorkflow(payment({ id: "pay-1" }));

  paymentService.clear();

  assert.equal(paymentService.getAllPayments().length, 0);
  assert.deepEqual(paymentService.getDecisions("pay-1"), []);
  assert.equal(paymentService.getWorkflow("pay-1"), undefined);
});
