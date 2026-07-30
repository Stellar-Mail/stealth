import assert from "node:assert/strict";
import test from "node:test";

import { detectInvoice } from "../index.ts";
import { failureFixture, successFixture } from "../fixtures/invoice-detector.fixtures.ts";

test("returns a typed success payload for recognizable invoice text", async () => {
  const result = await detectInvoice(successFixture.input);

  assert.equal(result.ok, true);
  assert.ok(result.invoice !== null);
  assert.deepEqual(result.invoice, {
    vendorName: "Northwind Labs",
    invoiceNumber: "INV-2048",
    totalAmount: 1250.5,
    currency: "USD",
    detectedAt: new Date(successFixture.input.referenceDate ?? "2026-07-18").toISOString(),
  });
  assert.equal(result.error, undefined);
});

test("returns a typed failure payload for unsupported content", async () => {
  const result = await detectInvoice(failureFixture.input);

  assert.equal(result.ok, false);
  assert.equal(result.invoice, null);
  assert.deepEqual(result.error, {
    code: "UNSUPPORTED_CONTENT",
    message: "The supplied content does not look like an invoice.",
    retryable: false,
  });
});
