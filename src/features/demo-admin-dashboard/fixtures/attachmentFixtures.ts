/**
 * Demo attachment fixtures for the admin dashboard.
 *
 * All data is fake, deterministic, and safe for public repository review.
 * Sender addresses use only @example.com, @example.org, or *.stealth.demo.
 * Do not add real user data, live URLs, secrets, or non-deterministic values.
 */

import type { DemoAttachmentRecord } from "../types/attachment";

/**
 * Canonical set of demo attachments covering all supported categories and
 * the full range of metadata fields exercised by the AttachmentEditor.
 */
export const demoAttachmentRecords: DemoAttachmentRecord[] = [
  {
    id: "att-relay-spec",
    fileName: "relay_specification.json",
    fileSize: "4.2 KB",
    fileSizeBytes: 4301,
    fileType: "JSON",
    category: "data",
    messageSubject: "Your relay verification code",
    sender: "relay07*stealth.demo",
    description: "Node registration parameters for Relay Node 07 in JSON format.",
    previewUrl: "#relay-spec-preview",
    receivedAt: "2026-06-16T12:00:00",
  },
  {
    id: "att-soroban-tx",
    fileName: "soroban_transaction.tx",
    fileSize: "12.8 KB",
    fileSizeBytes: 13107,
    fileType: "Transaction Payload",
    category: "transaction",
    messageSubject: "Soroban proof generation pending",
    sender: "bridge*stealth.demo",
    description: "Raw Soroban transaction envelope awaiting ledger proof registration.",
    previewUrl: "#soroban-tx-preview",
    receivedAt: "2026-06-16T12:10:00",
  },
  {
    id: "att-invoice-1042",
    fileName: "invoice_1042.pdf",
    fileSize: "120 KB",
    fileSizeBytes: 122880,
    fileType: "PDF Document",
    category: "document",
    messageSubject: "Message request awaiting approval",
    sender: "billing@example.com",
    description: "Demo invoice for postage payment — no real financial data.",
    previewUrl: "#invoice-1042-preview",
    receivedAt: "2026-06-16T12:09:00",
  },
  {
    id: "att-paid-request",
    fileName: "payment_receipt.pdf",
    fileSize: "88 KB",
    fileSizeBytes: 90112,
    fileType: "PDF Document",
    category: "document",
    messageSubject: "Payment received for message request",
    sender: "review*stealth.demo",
    description: "Synthetic postage-payment receipt for demo sender review flow.",
    previewUrl: "#payment-receipt-preview",
    receivedAt: "2026-06-16T13:12:00",
  },
  {
    id: "att-read-proof",
    fileName: "read_receipt.proof",
    fileSize: "2.1 KB",
    fileSizeBytes: 2150,
    fileType: "Cryptographic Proof",
    category: "proof",
    messageSubject: "Delivery receipt settled",
    sender: "receipts*stealth.demo",
    description: "On-chain read proof signed by the Soroban receipt contract.",
    previewUrl: "#read-proof-preview",
    receivedAt: "2026-06-16T11:00:00",
  },
  {
    id: "att-conference-badge",
    fileName: "conference_badge.png",
    fileSize: "38 KB",
    fileSizeBytes: 38912,
    fileType: "PNG Image",
    category: "image",
    messageSubject: "Your conference registration is confirmed",
    sender: "events*stealth.demo",
    description: "Demo conference attendee badge — synthetic image placeholder.",
    previewUrl: "#conference-badge-preview",
    receivedAt: "2026-06-14T09:00:00",
  },
  {
    id: "att-encrypted-bundle",
    fileName: "secure_payload.zip",
    fileSize: "256 KB",
    fileSizeBytes: 262144,
    fileType: "Archive",
    category: "archive",
    messageSubject: "Encrypted campaign bundle",
    sender: "campaigns*stealth.demo",
    description: "Password-protected archive simulating an encrypted campaign payload.",
    previewUrl: "#encrypted-bundle-preview",
    receivedAt: "2026-06-15T15:30:00",
  },
];

/**
 * Minimal blank draft used as the initial state when adding a new attachment.
 * Pre-fills `category` and `receivedAt` to reduce required user input.
 */
export const blankAttachmentDraft = {
  fileName: "",
  fileSize: "",
  fileSizeBytes: 0,
  fileType: "",
  category: "document" as const,
  messageSubject: "",
  sender: "",
  description: "",
  previewUrl: "",
  receivedAt: "2026-06-19T00:00:00",
} satisfies import("../types/attachment").AttachmentDraft;
