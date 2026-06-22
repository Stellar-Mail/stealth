import type { OwnershipThread } from "../types";

export const ownershipThreads: OwnershipThread[] = [
  {
    id: "thread-enterprise-renewal",
    subject: "Enterprise renewal timing",
    sender: "renewals@example.test",
    status: "unassigned",
    ownerId: null,
    ownerName: null,
    updatedAt: "2026-06-17T09:00:00Z",
  },
  {
    id: "thread-delivery-proof",
    subject: "Delivery proof mismatch",
    sender: "ops@example.test",
    status: "assigned",
    ownerId: "agent-mika",
    ownerName: "Mika",
    updatedAt: "2026-06-17T09:10:00Z",
  },
  {
    id: "thread-refund-policy",
    subject: "Refund policy clarification",
    sender: "billing@example.test",
    status: "released",
    ownerId: null,
    ownerName: null,
    updatedAt: "2026-06-17T09:20:00Z",
  },
];
