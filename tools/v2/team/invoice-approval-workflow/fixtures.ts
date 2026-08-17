/**
 * fixtures.ts — Invoice Approval Workflow (execution contract fixtures)
 *
 * Deterministic local fixtures used by the contract tests and as documentation
 * of the contract shape.
 */

import type { InvoiceInput } from "./types";

/** A valid invoice submission. */
export const VALID_SUBMIT_INPUT: InvoiceInput = {
  vendor: "Acme Hosting LLC",
  amount: 1250.0,
  submittedBy: "finops@client-acme.example.com",
};

/** A submission with a non-positive amount (should fail validation). */
export const INVALID_AMOUNT_INPUT: InvoiceInput = {
  vendor: "Bad Vendor",
  amount: 0,
  submittedBy: "someone@example.com",
};

/** A submission missing a vendor (should fail validation). */
export const MISSING_VENDOR_INPUT: InvoiceInput = {
  vendor: "",
  amount: 50,
  submittedBy: "someone@example.com",
};
