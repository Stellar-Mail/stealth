import type { PresetScenario } from "../types";
import {
  mockDiagnosticId,
  mockMessageHash,
  mockPaymentHash,
  mockSignature,
} from "../mockHashHelpers";

/**
 * Campaign Preset: Conference Pass & Calendar Invite
 *
 * This preset simulates an event registration flow, including ticket delivery,
 * calendar integration, and related communications for a tech conference.
 * It is designed to populate the dashboard with data for testing event-driven
 * campaign features.
 *
 * All data is fake, deterministic, and safe for public review.
 * This is issue 47 of 70 for the Demo Admin Dashboard initiative.
 */
export const conferenceCampaignPreset: PresetScenario = {
  id: "conference-pass",
  name: "Conference Pass & Calendar Invite",
  description:
    "A campaign simulating event registration, ticket delivery, and calendar integration for a tech conference.",
  stats: [
    { label: "Attendees", value: "1,200" },
    { label: "Invites Sent", value: "2,500" },
    { label: "Calendar Adds", value: "850" },
    { label: "Tickets Issued", value: "1,200" },
  ],
  accounts: [
    {
      name: "Stellar Summit Events",
      address: "events*stellarsummit.org",
      balance: "50,000 XLM",
      type: "Organization",
    },
  ],
  mail: [
    {
      subject: "Your pass for Stellar Summit 2026 is ready",
      status: "Delivered",
      folder: "inbox",
      from: "Stellar Summit Events",
      email: "events*stellarsummit.org",
      body: "Your ticket for Stellar Summit 2026 is attached. Add the event to your calendar to get reminders and session updates.",
      time: "9:30 AM",
      unread: true,
      starred: true,
      labels: ["Conference", "Ticket", "Important"],
      avatarColor: "#3b82f6",
      verifiedSender: true,
      receiptState: "sent",
      proofMetadata: {
        messageHash: mockMessageHash("conf-msg-1"),
        paymentHash: mockPaymentHash("conf-pay-1"),
        diagnosticId: mockDiagnosticId("conf-trace-1"),
        contractAddress: "CDCONF...TICKET",
        latency: "28ms",
        signature: mockSignature("conf-msg-1"),
        postageStatus: "settled",
      },
    },
    {
      subject: "Reminder: Stellar Summit starts next week",
      status: "Delivered",
      folder: "inbox",
      from: "Stellar Summit Events",
      email: "events*stellarsummit.org",
      body: "Just one week until Stellar Summit 2026! Check out the final speaker schedule and plan your agenda.",
      time: "Yesterday",
      unread: false,
      starred: false,
      labels: ["Conference", "Reminder"],
      avatarColor: "#3b82f6",
      verifiedSender: true,
      receiptState: "sent",
    },
  ],
  attachments: [
    {
      id: "conf-att-1",
      fileName: "StellarSummit2026-Pass.pkpass",
      fileSize: "1.2 MB",
      fileType: "pkpass",
      messageSubject: "Your pass for Stellar Summit 2026 is ready",
      sender: "Stellar Summit Events",
    },
    {
      id: "conf-att-2",
      fileName: "event.ics",
      fileSize: "1 KB",
      fileType: "ics",
      messageSubject: "Your pass for Stellar Summit 2026 is ready",
      sender: "Stellar Summit Events",
    },
  ],
  events: [
    {
      id: "evt-stellar-summit",
      title: "Stellar Summit 2026",
      date: "2026-07-15",
      time: "9:00 AM",
      location: "Virtual Event",
      organizer: "events*stellarsummit.org",
      status: "confirmed",
    },
  ],
  auditEvents: [
    {
      action: "Campaign 'Stellar Summit 2026' created",
      actor: "Admin User",
      timestamp: "2026-06-01T10:00:00Z",
    },
    {
      action: "Published 2,500 invites for 'Stellar Summit 2026'",
      actor: "Admin User",
      timestamp: "2026-06-10T14:00:00Z",
    },
  ],
};
