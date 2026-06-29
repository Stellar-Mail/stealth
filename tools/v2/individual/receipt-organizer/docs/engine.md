# Receipt Organizer Core Engine

## Overview

The core engine provides folder-local services for classifying and organizing receipts.

## API Surface

### `classifyReceipt(receipt: Receipt): ReceiptCategory`

Determines the category of a receipt based on its merchant name.

### `organizeReceipts(receipts: Receipt[]): OrganizeResult`

Takes a list of receipts, applies categorization to those that are uncategorized, and computes summary statistics.

## State Documentation

- **Inputs**: Raw receipts (e.g., from an email parser or user input). Must match `Receipt` interface.
- **Outputs**: `OrganizeResult` which contains processed receipts and financial summaries.
- **Loading States**: Since this is a synchronous pure utility, loading states should be handled by the UI consumer before calling these functions.
- **Error States**: Malformed receipts may result in runtime errors if required fields are missing. The consumer UI should validate inputs before passing them to the engine. No network errors are possible as the engine is pure, synchronous, and local.
