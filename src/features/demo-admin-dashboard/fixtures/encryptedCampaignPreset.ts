import type { PresetScenario } from "../types";
import {
  mockDiagnosticId,
  mockMessageHash,
  mockPaymentHash,
  mockSignature,
} from "../mockHashHelpers";

/**
 * Campaign Preset: Encrypted Payload & Provenance
 *
 * This preset demonstrates the full lifecycle of a secure, encrypted message,
 * including its on-chain provenance records and associated attachments. It is
 * designed to populate the dashboard with data for testing encrypted payload
 * delivery, provenance inspection, and secure attachment demos.
 *
 * All data is fake, deterministic, and safe for public review.
 * This is Campaign issue 20 of 50 for the Demo Admin Dashboard initiative.
 */
export const encryptedCampaignPreset: PresetScenario = {
  id: "encrypted-payload",
  name: "Encrypted Payload & Provenance",
  description:
    "A campaign focused on secure, end-to-end encrypted messaging with full on-chain provenance and attachment handling.",
  stats: [
    { label: "Encrypted Messages", value: "3" },
    { label: "Proof Records", value: "5" },
    { label: "Secure Attachments", value: "2" },
    { label: "Pending Payloads", value: "1" },
  ],
  accounts: [
    {
      name: "Cipher Relay Node",
      address: "relay*cipher.network",
      balance: "1,500,000 XLM",
      type: "Relay Node",
      relayMetadata: {
        nodeUri: "wss://relay.cipher.network",
        latency: "12ms",
        signatureScheme: "Ed25519",
        status: "verified",
        owner: "Cipher Network Inc.",
      },
    },
  ],
  mail: [
    {
      subject: "Sealed Proposal - Decryption Key Required",
      status: "Locked",
      folder: "encrypted",
      from: "Kael Ortega",
      email: "kael*nexus.io",
      body: "This funding proposal is sealed with your registered public key. Please approve access to decrypt the payload.",
      time: "10:30 AM",
      unread: true,
      starred: true,
      labels: ["Encrypted", "Proposal", "High-Priority"],
      avatarColor: "#4d5560",
      verifiedSender: true,
      receiptState: "pending",
      proofMetadata: {
        messageHash: mockMessageHash("enc-msg-1"),
        paymentHash: mockPaymentHash("enc-pay-1"),
        diagnosticId: mockDiagnosticId("enc-trace-1"),
        contractAddress: "CCL2...9DME",
        latency: "45ms",
        signature: mockSignature("enc-msg-1"),
        postageStatus: "settled",
      },
    },
    {
      subject: "Decrypted: Project Phoenix Specs",
      status: "Decrypted",
      folder: "encrypted",
      from: "Nadia Reyes",
      email: "nadia*atlas.dev",
      body: "The Curve25519 envelope has been successfully decrypted. Attached are the technical specifications and test vectors.",
      time: "11:00 AM",
      unread: false,
      starred: false,
      labels: ["Encrypted", "Engineering", "Attachment"],
      avatarColor: "#5b6470",
      verifiedSender: true,
      receiptState: "sent",
      proofMetadata: {
        messageHash: mockMessageHash("enc-msg-2"),
        paymentHash: mockPaymentHash("enc-pay-2"),
        diagnosticId: mockDiagnosticId("enc-trace-2"),
        contractAddress: "CCL2...9DME",
        latency: "32ms",
        signature: mockSignature("enc-msg-2"),
        postageStatus: "settled",
      },
    },
    {
      subject: "Decryption Failed - Integrity Check Mismatch",
      status: "Failed",
      folder: "encrypted",
      from: "Vault Node",
      email: "vault*stealth.network",
      body:
        "The payload failed integrity verification. This may indicate a corrupted message or potential relay tampering. Diagnostic ID: " +
        mockDiagnosticId("enc-trace-3"),
      time: "11:15 AM",
      unread: false,
      starred: false,
      labels: ["Encrypted", "Failed", "Security-Alert"],
      avatarColor: "#9098a4",
      verifiedSender: true,
      receiptState: "none",
      proofMetadata: {
        messageHash: mockMessageHash("enc-msg-3"),
        paymentHash: mockPaymentHash("enc-pay-3"),
        diagnosticId: mockDiagnosticId("enc-trace-3"),
        contractAddress: "CCL2...9DME",
        latency: "120ms",
        signature: mockSignature("enc-msg-3"),
        postageStatus: "refunded",
      },
    },
  ],
  attachments: [
    {
      id: "enc-att-1",
      fileName: "project-phoenix-specs.pdf",
      fileSize: "12.8 MB",
      fileType: "pdf",
      messageSubject: "Decrypted: Project Phoenix Specs",
      sender: "Nadia Reyes",
    },
    {
      id: "enc-att-2",
      fileName: "test-vectors.json",
      fileSize: "72 KB",
      fileType: "json",
      messageSubject: "Decrypted: Project Phoenix Specs",
      sender: "Nadia Reyes",
    },
  ],
  events: [],
  auditEvents: [],
};
