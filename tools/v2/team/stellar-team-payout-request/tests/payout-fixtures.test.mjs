/**
 * Stellar Team Payout Request — Fixture & Logic Tests
 *
 * Uses only Node.js built-in test runner + assert (no tsx loader required).
 * Validates fixture data integrity and the pure helper functions that
 * filter / sort payouts — the same logic the React components depend on.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline the fixture data and helpers so the test file is self-contained
// and does not need a TypeScript loader.
// ---------------------------------------------------------------------------

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

const VALID_STATUSES = ["pending", "submitted", "confirmed", "failed", "cancelled"];
const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];
const VALID_NETWORKS = ["testnet", "mainnet"];

/**
 * Mirror of fixtures/payouts.fixtures.ts — plain JS objects.
 * All addresses are syntactically valid 56-char Stellar public keys
 * (G-prefix, base32 A-Z 2-7). Not real funded accounts.
 */
const mockPayouts = [
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

// ---------------------------------------------------------------------------
// Pure helper functions (mirrors of fixtures/payouts.fixtures.ts)
// ---------------------------------------------------------------------------

function getMockPayoutsByStatus(status) {
  return mockPayouts.filter((p) => p.status === status);
}

function getMockPayout(id) {
  return mockPayouts.find((p) => p.id === id);
}

function getMockPendingPayouts() {
  return getMockPayoutsByStatus("pending");
}

function getMockPayoutsByPriority() {
  const order = { urgent: 0, high: 1, normal: 2, low: 3 };
  return [...mockPayouts].sort((a, b) => order[a.priority] - order[b.priority]);
}

// ---------------------------------------------------------------------------
// Validation helper (mirrors form validation in payout-request-form.tsx)
// ---------------------------------------------------------------------------

function validate(values) {
  const errors = [];
  if (!values.recipientName?.trim()) {
    errors.push({ field: "recipientName", message: "Recipient name is required." });
  }
  if (!STELLAR_ADDRESS_RE.test(values.recipientStellarAddress?.trim() ?? "")) {
    errors.push({
      field: "recipientStellarAddress",
      message: "Enter a valid Stellar account ID.",
    });
  }
  const amount = parseFloat(values.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push({ field: "amount", message: "Amount must be a positive number." });
  }
  if (!values.description?.trim()) {
    errors.push({ field: "description", message: "Description is required." });
  }
  if (values.memo && new TextEncoder().encode(values.memo).length > 28) {
    errors.push({ field: "memo", message: "Memo must be 28 bytes or fewer." });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Payout Fixtures — data integrity", () => {
  it("contains 5 fixture payouts", () => {
    assert.strictEqual(mockPayouts.length, 5);
  });

  it("every payout has a unique id", () => {
    const ids = mockPayouts.map((p) => p.id);
    const unique = new Set(ids);
    assert.strictEqual(unique.size, mockPayouts.length);
  });

  it("every payout amount is a positive number", () => {
    for (const payout of mockPayouts) {
      assert.ok(typeof payout.amount === "number", `${payout.id}: amount is not a number`);
      assert.ok(payout.amount > 0, `${payout.id}: amount must be positive`);
    }
  });

  it("every payout currency is XLM", () => {
    for (const payout of mockPayouts) {
      assert.strictEqual(payout.currency, "XLM", `${payout.id}: currency should be XLM`);
    }
  });

  it("every payout has a valid status", () => {
    for (const payout of mockPayouts) {
      assert.ok(
        VALID_STATUSES.includes(payout.status),
        `${payout.id}: unexpected status "${payout.status}"`,
      );
    }
  });

  it("every payout has a valid priority", () => {
    for (const payout of mockPayouts) {
      assert.ok(
        VALID_PRIORITIES.includes(payout.priority),
        `${payout.id}: unexpected priority "${payout.priority}"`,
      );
    }
  });

  it("every payout has a valid network", () => {
    for (const payout of mockPayouts) {
      assert.ok(
        VALID_NETWORKS.includes(payout.network),
        `${payout.id}: unexpected network "${payout.network}"`,
      );
    }
  });

  it("every recipient Stellar address matches the expected format", () => {
    for (const payout of mockPayouts) {
      assert.ok(
        STELLAR_ADDRESS_RE.test(payout.recipient.stellarAddress),
        `${payout.id}: invalid Stellar address "${payout.recipient.stellarAddress}" (length ${payout.recipient.stellarAddress.length})`,
      );
    }
  });

  it("every recipient has a non-empty name", () => {
    for (const payout of mockPayouts) {
      assert.ok(payout.recipient.name.trim().length > 0, `${payout.id}: recipient name is empty`);
    }
  });
});

describe("getMockPayout", () => {
  it("returns the correct payout by id", () => {
    const result = getMockPayout("payout-001");
    assert.ok(result !== undefined);
    assert.strictEqual(result.id, "payout-001");
    assert.strictEqual(result.recipient.name, "Alice Martinez");
  });

  it("returns undefined for a non-existent id", () => {
    assert.strictEqual(getMockPayout("payout-999"), undefined);
  });
});

describe("getMockPayoutsByStatus", () => {
  it("returns only pending payouts", () => {
    const result = getMockPayoutsByStatus("pending");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "payout-001");
  });

  it("returns only confirmed payouts", () => {
    const result = getMockPayoutsByStatus("confirmed");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "payout-003");
  });

  it("returns the cancelled payout", () => {
    const result = getMockPayoutsByStatus("cancelled");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].status, "cancelled");
  });
});

describe("getMockPendingPayouts", () => {
  it("returns only the pending fixture", () => {
    const result = getMockPendingPayouts();
    assert.strictEqual(result.length, 1);
    assert.ok(result.every((p) => p.status === "pending"));
  });
});

describe("getMockPayoutsByPriority", () => {
  it("returns all payouts sorted urgent → high → normal → low", () => {
    const sorted = getMockPayoutsByPriority();
    assert.strictEqual(sorted.length, mockPayouts.length);
    assert.strictEqual(sorted[0].priority, "urgent");
    assert.strictEqual(sorted[1].priority, "high");
    // remaining should be normal then low
    const rest = sorted.slice(2).map((p) => p.priority);
    const normalIdx = rest.indexOf("normal");
    const lowIdx = rest.indexOf("low");
    assert.ok(normalIdx < lowIdx, "normal should appear before low");
  });

  it("does not mutate the original mockPayouts array", () => {
    const originalFirst = mockPayouts[0].id;
    getMockPayoutsByPriority();
    assert.strictEqual(mockPayouts[0].id, originalFirst);
  });
});

describe("validate — form validation logic", () => {
  // A syntactically valid 56-char Stellar address (base32, G-prefix)
  const VALID_ADDRESS = "GHVFXLBZTPNNPTZBLXFVH3RJD7557DJR3HVFXLBZTPNNPTZBLXFVH3RJ";

  const validValues = {
    recipientName: "Alice",
    recipientStellarAddress: VALID_ADDRESS,
    amount: "100",
    description: "Test payment",
    memo: "",
    priority: "normal",
    network: "testnet",
  };

  it("returns no errors for valid input", () => {
    assert.deepStrictEqual(validate(validValues), []);
  });

  it("rejects empty recipient name", () => {
    const errs = validate({ ...validValues, recipientName: "   " });
    assert.ok(errs.some((e) => e.field === "recipientName"));
  });

  it("rejects invalid Stellar address", () => {
    const errs = validate({ ...validValues, recipientStellarAddress: "not-an-address" });
    assert.ok(errs.some((e) => e.field === "recipientStellarAddress"));
  });

  it("rejects addresses that are too short", () => {
    const errs = validate({ ...validValues, recipientStellarAddress: "GABC123" });
    assert.ok(errs.some((e) => e.field === "recipientStellarAddress"));
  });

  it("rejects zero amount", () => {
    const errs = validate({ ...validValues, amount: "0" });
    assert.ok(errs.some((e) => e.field === "amount"));
  });

  it("rejects negative amount", () => {
    const errs = validate({ ...validValues, amount: "-5" });
    assert.ok(errs.some((e) => e.field === "amount"));
  });

  it("rejects non-numeric amount", () => {
    const errs = validate({ ...validValues, amount: "abc" });
    assert.ok(errs.some((e) => e.field === "amount"));
  });

  it("rejects empty description", () => {
    const errs = validate({ ...validValues, description: "" });
    assert.ok(errs.some((e) => e.field === "description"));
  });

  it("rejects memo longer than 28 bytes", () => {
    const errs = validate({ ...validValues, memo: "this memo is definitely too long for stellar" });
    assert.ok(errs.some((e) => e.field === "memo"));
  });

  it("accepts memo exactly 28 bytes", () => {
    const memo = "a".repeat(28); // 28 ASCII chars = 28 bytes
    const errs = validate({ ...validValues, memo });
    assert.ok(!errs.some((e) => e.field === "memo"));
  });

  it("accepts fractional positive amount", () => {
    const errs = validate({ ...validValues, amount: "0.0000001" });
    assert.ok(!errs.some((e) => e.field === "amount"));
  });
});
