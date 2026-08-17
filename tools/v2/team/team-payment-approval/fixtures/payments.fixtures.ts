import type { PaymentRequest } from "../types";

/**
 * Payment Request Fixtures
 *
 * Local test data for the Team Payment Approval tool.
 * Use these in local testing, demo modes, and to verify accessibility.
 */

const baseDate = new Date();

export const mockPayments: PaymentRequest[] = [
  {
    id: "payment-1",
    recipient: "Acme Corp",
    amount: 5000,
    currency: "USD",
    description: "Q1 Service Contract Payment",
    requestedBy: "Alice Johnson",
    requestedAt: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    deadline: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000),
    priority: "normal",
    status: "pending",
  },
  {
    id: "payment-2",
    recipient: "Stellar Development",
    amount: 12500,
    currency: "USD",
    description: "Infrastructure costs for API infrastructure",
    requestedBy: "Bob Smith",
    requestedAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000),
    deadline: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
    priority: "high",
    status: "pending",
  },
  {
    id: "payment-3",
    recipient: "Security Audit Firm",
    amount: 25000,
    currency: "USD",
    description: "Annual security audit and penetration testing",
    requestedBy: "Charlie Davis",
    requestedAt: new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000),
    deadline: new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000),
    priority: "urgent",
    status: "pending",
  },
  {
    id: "payment-4",
    recipient: "Office Supplies Inc",
    amount: 250,
    currency: "USD",
    description: "Monthly office supplies and equipment",
    requestedBy: "Diana Wilson",
    requestedAt: new Date(baseDate.getTime() - 6 * 60 * 60 * 1000),
    priority: "low",
    status: "pending",
  },
  {
    id: "payment-5",
    recipient: "CloudHost Systems",
    amount: 8750,
    currency: "USD",
    description: "Cloud hosting and database services",
    requestedBy: "Eve Martinez",
    requestedAt: new Date(baseDate.getTime() - 12 * 60 * 60 * 1000),
    deadline: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000),
    priority: "high",
    status: "pending",
  },
  {
    id: "payment-6",
    recipient: "Training Academy Ltd",
    amount: 3200,
    currency: "USD",
    description: "Professional development courses",
    requestedBy: "Frank Thompson",
    requestedAt: new Date(baseDate.getTime() - 18 * 60 * 60 * 1000),
    priority: "normal",
    status: "pending",
  },
];

/**
 * Get a single mock payment by ID
 */
export function getMockPayment(id: string): PaymentRequest | undefined {
  return mockPayments.find((p) => p.id === id);
}

/**
 * Get pending mock payments
 */
export function getMockPendingPayments(): PaymentRequest[] {
  return mockPayments.filter((p) => p.status === "pending");
}

/**
 * Get mock payments by priority
 */
export function getMockPaymentsByPriority(priority: string): PaymentRequest[] {
  return mockPayments.filter((p) => p.priority === priority);
}

/**
 * Simulate approved/rejected payments (for demo purposes)
 */
export const completedPayments: PaymentRequest[] = [
  {
    id: "payment-completed-1",
    recipient: "Previous Vendor",
    amount: 15000,
    currency: "USD",
    description: "Contract completion payment",
    requestedBy: "Greg Anderson",
    requestedAt: new Date(baseDate.getTime() - 30 * 24 * 60 * 60 * 1000),
    priority: "normal",
    status: "approved",
  },
  {
    id: "payment-completed-2",
    recipient: "Rejected Vendor",
    amount: 5000,
    currency: "USD",
    description: "Rejected service payment",
    requestedBy: "Helen Brown",
    requestedAt: new Date(baseDate.getTime() - 20 * 24 * 60 * 60 * 1000),
    priority: "normal",
    status: "rejected",
  },
];
