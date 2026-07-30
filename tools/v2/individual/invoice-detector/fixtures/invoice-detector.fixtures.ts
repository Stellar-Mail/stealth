import type { InvoiceDetectorInput } from "../types.ts";

export interface InvoiceDetectorFixture {
  name: string;
  input: InvoiceDetectorInput;
}

export const successFixture: InvoiceDetectorFixture = {
  name: "recognizable-invoice",
  input: {
    text: "Invoice INV-2048 from Northwind Labs for services rendered. Total amount: $1,250.50 USD.",
    locale: "en-US",
    referenceDate: "2026-07-18",
  },
};

export const failureFixture: InvoiceDetectorFixture = {
  name: "unsupported-content",
  input: {
    text: "Hi team, let’s meet for lunch this week and discuss the roadmap.",
    locale: "en-US",
    referenceDate: "2026-07-18",
  },
};
