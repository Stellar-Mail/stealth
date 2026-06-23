import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  InvoiceValidationError,
  LIMITS,
  guardApprovalHistory,
  guardAttachments,
  guardLineItems,
  guardTeamMembers,
  sanitizeInvoiceNumber,
  sanitizeMemo,
  sanitizeVendorName,
  validateAmount,
  validateApproverEmail,
  validateAttachment,
  validateAttachments,
  validateCurrency,
  validateInvoiceId,
  validateInvoiceNumber,
  validateInvoiceSubmission,
  validateLineItems,
  validateStatus,
  validateVendorName,
} from "../guards/invoice-guards.mjs";

const currentDir = join(fileURLToPath(import.meta.url), "..");
const fixture = JSON.parse(
  readFileSync(join(currentDir, "..", "fixtures", "sample-invoices.json"), "utf8"),
);

describe("validateInvoiceId", () => {
  it("accepts safe invoice ids", () => {
    assert.equal(validateInvoiceId("invoice-2026-001"), "invoice-2026-001");
    assert.equal(validateInvoiceId("INVOICE_42"), "INVOICE_42");
  });

  it("rejects empty, non-string, path, and oversized ids", () => {
    assert.throws(() => validateInvoiceId(""), InvoiceValidationError);
    assert.throws(() => validateInvoiceId(null), InvoiceValidationError);
    assert.throws(() => validateInvoiceId("../bad"), InvoiceValidationError);
    assert.throws(
      () => validateInvoiceId("x".repeat(LIMITS.MAX_INVOICE_ID_LENGTH + 1)),
      InvoiceValidationError,
    );
  });
});

describe("invoice number guards", () => {
  it("sanitizes control characters", () => {
    assert.equal(sanitizeInvoiceNumber(" INV-1\r\nX-Test "), "INV-1X-Test");
  });

  it("validates safe invoice numbers", () => {
    assert.equal(validateInvoiceNumber("INV-2026.001"), "INV-2026.001");
  });

  it("rejects empty and unsafe invoice numbers", () => {
    assert.throws(() => validateInvoiceNumber(""), InvoiceValidationError);
    assert.throws(() => validateInvoiceNumber("INV<script>"), InvoiceValidationError);
  });
});

describe("vendor and memo sanitizers", () => {
  it("sanitizes vendor names and memos", () => {
    assert.equal(sanitizeVendorName("  Vendor\0Name  "), "VendorName");
    assert.equal(sanitizeMemo("line1\nline2\0"), "line1\nline2");
  });

  it("caps long memo text", () => {
    assert.equal(sanitizeMemo("x".repeat(LIMITS.MAX_MEMO_LENGTH + 1)).length, LIMITS.MAX_MEMO_LENGTH);
  });

  it("rejects empty or markup-like vendor names", () => {
    assert.throws(() => validateVendorName(""), InvoiceValidationError);
    assert.throws(() => validateVendorName("<script>Vendor</script>"), InvoiceValidationError);
  });
});

describe("status, currency, amount, and approver email", () => {
  it("accepts allowed statuses and currencies", () => {
    assert.equal(validateStatus("pending"), "pending");
    assert.equal(validateCurrency("usd"), "USD");
  });

  it("rejects unknown statuses and currencies", () => {
    assert.throws(() => validateStatus("paid"), InvoiceValidationError);
    assert.throws(() => validateCurrency("BTC"), InvoiceValidationError);
  });

  it("validates finite positive amounts with two decimals", () => {
    assert.equal(validateAmount(1250.5), 1250.5);
    assert.throws(() => validateAmount(-1), InvoiceValidationError);
    assert.throws(() => validateAmount(Number.POSITIVE_INFINITY), InvoiceValidationError);
    assert.throws(() => validateAmount(10.001), InvoiceValidationError);
    assert.throws(() => validateAmount(LIMITS.MAX_AMOUNT + 0.01), InvoiceValidationError);
  });

  it("rejects malformed or injected approver emails", () => {
    assert.equal(validateApproverEmail("manager@example.test"), "manager@example.test");
    assert.throws(() => validateApproverEmail("@example.test"), InvoiceValidationError);
    assert.throws(
      () => validateApproverEmail("manager@example.test\r\nBcc: bad@example.test"),
      InvoiceValidationError,
    );
  });
});

describe("line item guards", () => {
  it("guards line item collection size", () => {
    assert.equal(guardLineItems(new Array(LIMITS.MAX_LINE_ITEMS).fill({})), true);
    assert.throws(
      () => guardLineItems(new Array(LIMITS.MAX_LINE_ITEMS + 1).fill({})),
      InvoiceValidationError,
    );
    assert.throws(() => guardLineItems(null), InvoiceValidationError);
  });

  it("validates line item totals", () => {
    assert.equal(
      validateLineItems([
        { description: "Service", amount: 10 },
        { description: "Tax", amount: 1.25 },
      ]),
      11.25,
    );
    assert.throws(() => validateLineItems([{ description: "", amount: 10 }]), InvoiceValidationError);
    assert.throws(() => validateLineItems([{ description: "Bad", amount: -1 }]), InvoiceValidationError);
  });
});

describe("attachment guards", () => {
  it("guards attachment collection size", () => {
    assert.equal(guardAttachments(new Array(LIMITS.MAX_ATTACHMENTS).fill({})), true);
    assert.throws(
      () => guardAttachments(new Array(LIMITS.MAX_ATTACHMENTS + 1).fill({})),
      InvoiceValidationError,
    );
  });

  it("validates safe attachments", () => {
    assert.equal(
      validateAttachment({
        filename: "invoice.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
      }),
      true,
    );
  });

  it("rejects unsafe attachments from fixtures", () => {
    for (const attachment of fixture.unsafeAttachments) {
      assert.throws(() => validateAttachment(attachment), InvoiceValidationError);
    }
  });

  it("validates attachment arrays", () => {
    assert.equal(
      validateAttachments([
        {
          filename: "invoice.csv",
          mimeType: "text/csv",
          sizeBytes: 500,
        },
      ]),
      true,
    );
  });
});

describe("large collection guards", () => {
  it("guards approval history", () => {
    assert.equal(guardApprovalHistory(new Array(LIMITS.MAX_HISTORY_EVENTS).fill({})), true);
    assert.throws(
      () => guardApprovalHistory(new Array(LIMITS.MAX_HISTORY_EVENTS + 1).fill({})),
      InvoiceValidationError,
    );
  });

  it("guards team member lists", () => {
    assert.equal(guardTeamMembers(new Array(LIMITS.MAX_TEAM_MEMBERS).fill({})), true);
    assert.throws(
      () => guardTeamMembers(new Array(LIMITS.MAX_TEAM_MEMBERS + 1).fill({})),
      InvoiceValidationError,
    );
  });
});

describe("fixture-driven invoice submission validation", () => {
  for (const invoice of fixture.validInvoices) {
    it(`${invoice.id} validates and normalizes`, () => {
      const result = validateInvoiceSubmission(invoice);

      assert.equal(result.invoiceId, invoice.invoiceId);
      assert.equal(result.invoiceNumber, invoice.invoiceNumber);
      assert.equal(result.vendorName, invoice.vendorName);
      assert.equal(result.currency, invoice.currency.toUpperCase());
      assert.equal(result.lineItemTotal, invoice.amount);
    });
  }

  it("rejects mismatched line item totals", () => {
    assert.throws(
      () =>
        validateInvoiceSubmission({
          ...fixture.validInvoices[0],
          amount: 999.99,
        }),
      InvoiceValidationError,
    );
  });
});

describe("fixture-driven hostile inputs", () => {
  const validators = {
    invoiceId: validateInvoiceId,
    invoiceNumber: validateInvoiceNumber,
    vendorName: validateVendorName,
    status: validateStatus,
    currency: validateCurrency,
    approverEmail: validateApproverEmail,
    amount: validateAmount,
  };

  for (const entry of fixture.hostileInputs) {
    it(`${entry.id}: ${entry.reason} is rejected`, () => {
      const validator = validators[entry.field];
      assert.ok(validator, `missing validator for ${entry.field}`);
      assert.throws(() => validator(entry.value), InvoiceValidationError);
    });
  }
});

describe("fixture-driven sanitizer cases", () => {
  const sanitizers = {
    memo: sanitizeMemo,
    invoiceNumber: sanitizeInvoiceNumber,
    vendorName: sanitizeVendorName,
  };

  for (const entry of fixture.sanitizerCases) {
    it(`${entry.id}: ${entry.field} sanitizes as expected`, () => {
      assert.equal(sanitizers[entry.field](entry.value), entry.expected);
    });
  }
});
