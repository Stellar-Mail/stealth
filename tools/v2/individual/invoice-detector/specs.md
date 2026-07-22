# Invoice Detector Specs

## Purpose

Provide a stable backend-facing contract for identifying invoice-like content without introducing any UI or layout concerns.

## Scope

- Release tier: V2 later-release tool
- Audience: individual
- Folder ownership: tools/v2/individual/invoice-detector/

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Service Contract

The service entry point is `detectInvoice(input: InvoiceDetectorInput): Promise<InvoiceDetectorResult>`.

### Input

- `text`: raw content to inspect
- `locale?`: optional locale hint
- `referenceDate?`: optional date hint used for deterministic timestamps

### Output

- On success: `{ ok: true, invoice }`
- On failure: `{ ok: false, invoice: null, error }`

### Error Codes

- `EMPTY_INPUT`
- `UNSUPPORTED_CONTENT`
- `INVALID_INPUT`

## Contributor Boundary

All work for this tool should stay in:

```text
tools/v2/individual/invoice-detector/
```

## Required issue categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation
