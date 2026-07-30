# Invoice Detector

This folder is the isolated workspace for the Invoice Detector tool.

## Ownership Boundary

All work for this tool stays inside:

```text
tools/v2/individual/invoice-detector/
```

No UI, layout, or styling files are introduced here. The implementation is a backend-facing service that can be called independently from presentation concerns.

## Service Contract

The service entry point is exported from [index.ts](index.ts) as `detectInvoice`.

### Input

```ts
export interface InvoiceDetectorInput {
  text: string;
  locale?: string;
  referenceDate?: string;
}
```

### Output

```ts
export type InvoiceDetectorResult =
  | { ok: true; invoice: InvoiceRecord }
  | { ok: false; invoice: null; error: InvoiceDetectorError };
```

### Error Codes

- `EMPTY_INPUT`: the text payload is missing or blank.
- `UNSUPPORTED_CONTENT`: the content does not look like an invoice.
- `INVALID_INPUT`: reserved for future validation failures.

## Fixtures

Synthetic fixtures live in [fixtures/invoice-detector.fixtures.ts](fixtures/invoice-detector.fixtures.ts) and cover:

- a success case with invoice-like content
- a failure case with unrelated content

## Verification

The contract can be exercised locally with:

```bash
node --test tools/v2/individual/invoice-detector/tests/invoice-detector.test.ts
```

## Notes

This change is intentionally limited to service typing, exports, fixtures, and documentation. It does not register the tool in app routing or alter any visual layer.
