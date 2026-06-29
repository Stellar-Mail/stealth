import type { PayoutRequest } from "../types";

/**
 * Sample payout request fixtures for testing and local development.
 * Never use real Stellar keypairs or real amounts in fixtures.
 *
 * All addresses are syntactically valid Stellar StrKey public keys
 * (56 characters, G-prefix, base32 alphabet A-Z 2-7). They are NOT
 * funded accounts — do not use on mainnet.
 */
export const mockPayouts: PayoutRequest[] = [
  {
    id: "payout-001",
    recipient: {
      name: "Alice Martinez",
      stellarAddress: "GHVFXLBZTPNNPTZBLXFVH3RJD7557DJR3HVFXLBZTPNNPTZBLXFVH3RJ",
      email: "alice@example.com",
    },
    amount: 250,
    currency: "XLM",
    description: "Q2 contractor payment — design deliverables",
    requestedBy: "bob@example.com",
    requestedAt: new Date("2026-06-10T09:00:00Z"),
    priority: "high",
    status: "pending",
    memo: "Q2-DESIGN",
    network: "testnet",
  },
  {
    id: "payout-002",
    recipient: {
      name: "Carlos Nguyen",
      stellarAddress: "GO4M6SIA2WUUW2AIS6M4OCYQKGEEGKQYCO4M6SIA2WUUW2AIS6M4OCYQ",
    },
    amount: 1000,
    currency: "XLM",
    description: "Bug bounty reward — security audit findings",
    requestedBy: "alice@example.com",
    requestedAt: new Date("2026-06-12T14:30:00Z"),
    deadline: new Date("2026-06-20T00:00:00Z"),
    priority: "urgent",
    status: "submitted",
    memo: "BOUNTY-06",
    transactionHash: "3389e9f0f1a65f19736855405ea6ec3f74069e7bff56ae3d7e4a2bce1e547889",
    network: "testnet",
  },
  {
    id: "payout-003",
    recipient: {
      name: "Dana Okonkwo",
      stellarAddress: "GVDTFZPHB5335BHPZFTDVJ7XRNLLNRX7JVDTFZPHB5335BHPZFTDVJ7X",
      email: "dana@example.com",
    },
    amount: 75,
    currency: "XLM",
    description: "Documentation contribution — protocol spec",
    requestedBy: "eve@example.com",
    requestedAt: new Date("2026-06-15T08:00:00Z"),
    priority: "normal",
    status: "confirmed",
    transactionHash: "d6e09b9dc24395d8d5c346e3b37fc57d5e9f1b231e3c3a9d8fc7a8ab04f6b3c2",
    network: "testnet",
  },
  {
    id: "payout-004",
    recipient: {
      name: "Eve Johnson",
      stellarAddress: "G4K2MAWOIECCEIOWAM2K4QG6YUSSUY6GQ4K2MAWOIECCEIOWAM2K4QG6",
    },
    amount: 500,
    currency: "XLM",
    description: "Sprint bonus — backend integration work",
    requestedBy: "bob@example.com",
    requestedAt: new Date("2026-06-17T11:00:00Z"),
    priority: "normal",
    status: "failed",
    notes: "Transaction failed due to insufficient source balance.",
    network: "testnet",
  },
  {
    id: "payout-005",
    recipient: {
      name: "Frank Torres",
      stellarAddress: "GDRBTH5VPLJJLPV5HTBRDXNF73ZZ37FNXDRBTH5VPLJJLPV5HTBRDXNF",
      email: "frank@example.com",
    },
    amount: 150,
    currency: "XLM",
    description: "Mentorship session compensation",
    requestedBy: "alice@example.com",
    requestedAt: new Date("2026-06-18T09:30:00Z"),
    priority: "low",
    status: "cancelled",
    notes: "Cancelled at requester's request.",
    network: "testnet",
  },
];

/** Return all payouts with a specific status */
export function getMockPayoutsByStatus(status: PayoutRequest["status"]): PayoutRequest[] {
  return mockPayouts.filter((p) => p.status === status);
}

/** Return a single payout by id, or undefined */
export function getMockPayout(id: string): PayoutRequest | undefined {
  return mockPayouts.find((p) => p.id === id);
}

/** Return only pending payouts */
export function getMockPendingPayouts(): PayoutRequest[] {
  return getMockPayoutsByStatus("pending");
}

/** Return payouts sorted by priority (urgent first) */
export function getMockPayoutsByPriority(): PayoutRequest[] {
  const order: Record<PayoutRequest["priority"], number> = {
    urgent: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  return [...mockPayouts].sort((a, b) => order[a.priority] - order[b.priority]);
}
