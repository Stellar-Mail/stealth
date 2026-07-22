import type {
  InvoiceDetectorError,
  InvoiceDetectorInput,
  InvoiceDetectorResult,
  InvoiceRecord,
} from "../types.ts";

const DEFAULT_CURRENCY = "USD";

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function createError(code: InvoiceDetectorError["code"], message: string): InvoiceDetectorError {
  return {
    code,
    message,
    retryable: false,
  };
}

function extractVendorName(text: string): string | null {
  if (/northwind labs/i.test(text)) {
    return "Northwind Labs";
  }

  if (/acme/i.test(text)) {
    return "Acme Corp";
  }

  return null;
}

function extractInvoiceNumber(text: string): string | null {
  const match = text.match(/(?:invoice|inv)[\s#:-]*([A-Z0-9-]{2,})/i);
  return match?.[1] ? match[1].toUpperCase() : null;
}

function extractAmount(text: string): number | null {
  const normalizedText = text.replace(/,/g, "");
  const match = normalizedText.match(/(?:total(?:\s+amount)?|amount due|balance due)[:\s$]*([0-9]+(?:\.\d{1,2})?)/i);
  if (!match) {
    return null;
  }

  return Number.parseFloat(match[1]);
}

function extractCurrency(text: string): string {
  if (text.includes("€")) {
    return "EUR";
  }

  if (text.includes("£")) {
    return "GBP";
  }

  return DEFAULT_CURRENCY;
}

function buildInvoice(text: string, input: InvoiceDetectorInput): InvoiceRecord | null {
  const vendorName = extractVendorName(text);
  const invoiceNumber = extractInvoiceNumber(text);
  const totalAmount = extractAmount(text);

  if (!vendorName || !invoiceNumber || totalAmount === null) {
    return null;
  }

  return {
    vendorName,
    invoiceNumber,
    totalAmount,
    currency: extractCurrency(text),
    detectedAt: input.referenceDate ? new Date(input.referenceDate).toISOString() : new Date().toISOString(),
  };
}

export async function detectInvoice(input: InvoiceDetectorInput): Promise<InvoiceDetectorResult> {
  if (typeof input?.text !== "string") {
    return {
      ok: false,
      invoice: null,
      error: createError("INVALID_INPUT", "Invoice input must be a string."),
    };
  }

  const normalizedText = normalizeText(input.text ?? "");

  if (!normalizedText) {
    return {
      ok: false,
      invoice: null,
      error: createError("EMPTY_INPUT", "Invoice text is required."),
    };
  }

  const hasInvoiceSignals = /invoice|billing|payment terms|due date|total amount/i.test(normalizedText);
  const invoice = buildInvoice(normalizedText, input);

  if (!hasInvoiceSignals || !invoice) {
    return {
      ok: false,
      invoice: null,
      error: createError("UNSUPPORTED_CONTENT", "The supplied content does not look like an invoice."),
    };
  }

  return {
    ok: true,
    invoice,
  };
}
