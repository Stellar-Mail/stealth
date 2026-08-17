/**
 * Demo proof record fixtures for the admin dashboard.
 *
 * All data is fake, deterministic, and safe for public repository review.
 */

import type { ProofRecord } from "../types/proofRecord";
import {
  mockDiagnosticId,
  mockMessageHash,
  mockPaymentHash,
  mockSignature,
} from "../mockHashHelpers";

export const demoProofRecords: ProofRecord[] = [
  {
    id: "proof-001",
    messageHash: mockMessageHash("msg-001"),
    paymentHash: mockPaymentHash("pay-001"),
    contractAddress: "CDEMO1SOROBANCONTRACT1ABCDEFGHIJKLMNOPQRSTUVWXYZ1234",
    diagnosticId: mockDiagnosticId("trace-001"),
    latency: "42ms",
    signature: mockSignature("msg-001"),
    postageStatus: "settled",
  },
  {
    id: "proof-002",
    messageHash: mockMessageHash("msg-002"),
    paymentHash: mockPaymentHash("pay-002"),
    contractAddress: "CDEM02SOROBANCONTRACT2ABCDEFGHIJKLMNOPQRSTUVWXYZ5678",
    diagnosticId: mockDiagnosticId("trace-002"),
    latency: "87ms",
    signature: mockSignature("msg-002"),
    postageStatus: "pending",
  },
  {
    id: "proof-003",
    messageHash: mockMessageHash("msg-003"),
    paymentHash: mockPaymentHash("pay-003"),
    contractAddress: "CDEM03SOROBANCONTRACT3ABCDEFGHIJKLMNOPQRSTUVWXYZ9012",
    diagnosticId: mockDiagnosticId("trace-003"),
    latency: "15ms",
    signature: mockSignature("msg-003"),
    postageStatus: "refunded",
  },
];
