/**
 * Deterministic fixtures for visual / screenshot tests.
 *
 * Rules:
 *  - All IDs, timestamps, and Stellar addresses are synthetic.
 *  - No real personal data. Names, domains, and addresses are fictional.
 *  - Values are frozen so tests cannot mutate shared state.
 *  - Every field matches the TypeScript types in src/components/mail/data.ts
 *    and src/features/calendar/types.ts; type errors here are test failures.
 */

import type { Email, MailFolder } from "../../src/components/mail/data";
import type {
  CalendarDefinition,
  CalendarEvent,
  MailEvent,
} from "../../src/features/calendar/types";
import type { UiPreferences } from "../../src/features/preferences/types";
import type { FeedbackItem } from "../../src/features/design-system/feedback/use-feedback";

// ---------------------------------------------------------------------------
// Viewport breakpoints used across screenshot scenarios
// ---------------------------------------------------------------------------

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

// ---------------------------------------------------------------------------
// Stellar-style synthetic addresses (format G + 55 uppercase alphanumeric)
// ---------------------------------------------------------------------------

const ADDR_A = "GCKNEMXRSVXHBXNRETJKDGXZ7XTFEWQSZNHLOBTFHVBFKNXJDKQN4XQ";
const ADDR_B = "GBQHZTJL7BQZRFZXVNTPBGKFPXHYHVRBDXNHBDYVQLB9LDVBQ4NVQNB";
const ADDR_C = "GDQN5HXNTZRG9QHVXMKFPJQGWLRZ9PXLTZRBGTXM7DPLNHQMX4CJNF";

// ---------------------------------------------------------------------------
// Calendar events
// ---------------------------------------------------------------------------

const calendarEventInMail: MailEvent = Object.freeze({
  id: "fix-token2049",
  title: "TOKEN2049 Abu Dhabi",
  month: "April",
  day: "21",
  cadence: "Event",
  date: "2026-04-21",
  time: "9:00 AM GST",
  endTime: "18:00",
  location: "Abu Dhabi Global Market",
  note: "Founder pass confirmed",
  calendar: "protocol",
  organizer: "TOKEN2049",
  meetingUrl: "https://www.token2049.com",
  days: [
    { label: "S", date: "18" },
    { label: "M", date: "19" },
    { label: "T", date: "20" },
    { label: "W", date: "21", active: true },
    { label: "T", date: "22" },
    { label: "F", date: "23" },
    { label: "S", date: "24" },
  ],
});

const calendarEventStudio: MailEvent = Object.freeze({
  id: "fix-studio-visit",
  title: "Studio visit",
  month: "April",
  day: "21",
  cadence: "Weekly",
  date: "2026-04-21",
  time: "10:30 AM",
  endTime: "11:30",
  location: "Mission studio",
  note: "New print walkthrough",
  calendar: "personal",
  organizer: "Aria Voss",
  days: [
    { label: "S", date: "18" },
    { label: "M", date: "19" },
    { label: "T", date: "20" },
    { label: "W", date: "21", active: true },
    { label: "T", date: "22" },
    { label: "F", date: "23" },
    { label: "S", date: "24" },
  ],
});

// ---------------------------------------------------------------------------
// Email fixture set — covers every MailLocation and key protocol states
// ---------------------------------------------------------------------------

export const EMAILS: readonly Email[] = Object.freeze([
  // --- inbox / priority ---
  {
    id: "fix-001",
    from: "Lina Park",
    email: "lina*vantage.studio",
    subject: "Q2 brand system - final direction",
    preview: "The monochrome system feels strongest across product surfaces.",
    body: "Hey,\n\nThe monochrome system feels strongest across product surfaces. Attached the latest spec sheet and motion principles.\n\nLina",
    time: "9:42 AM",
    unread: true,
    starred: true,
    folder: "priority",
    labels: ["Design", "Priority"],
    attachments: [
      { name: "vantage-identity-v3.pdf", size: "4.2 MB", type: "pdf" },
      { name: "motion-principles.key", size: "12.1 MB", type: "key" },
    ],
    avatarColor: "#5b6470",
  },
  // --- verified (protocol) ---
  {
    id: "fix-002",
    from: "TOKEN2049 Abu Dhabi",
    email: "events*token2049.global",
    subject: "TOKEN2049 Abu Dhabi - founder pass ready",
    preview: "Your event pass, agenda window, and wallet reminder are ready.",
    body: "Your TOKEN2049 Abu Dhabi founder pass is ready.\n\nDate: April 21, 2026\nTime: 9:00 AM GST\nVenue: Abu Dhabi Global Market\nPass: Founder access",
    time: "9:18 AM",
    unread: true,
    starred: false,
    folder: "verified",
    labels: ["Event", "Verified", "Pass"],
    avatarColor: "#7a8290",
    event: calendarEventInMail,
  },
  // --- pending (OTP / security) ---
  {
    id: "fix-003",
    from: "Relay Node 07",
    email: "relay07*stealth.network",
    subject: "Your relay verification code",
    preview: "Use the one-time passkey below to authorize this relay session.",
    body: "Hi Eve,\n\nA new relay session is requesting authorization on Node 07.\n\nYour OTP code: 482 015\n\nThis code expires in 10 minutes.",
    time: "8:57 AM",
    unread: true,
    starred: false,
    folder: "pending",
    labels: ["Security", "OTP"],
    avatarColor: "#4d5560",
  },
  // --- inbox (general, starred) ---
  {
    id: "fix-004",
    from: "Uthaimin Lawal",
    email: `mina*${ADDR_B.slice(0, 10).toLowerCase()}.capital`,
    subject: "Investor update and postage policy",
    preview: "Can you send over the sender-tier thresholds and postage refund details?",
    body: "The paid-inbox model makes sense.\n\nCan you send over the sender-tier thresholds and how postage refunds work for approved contacts?",
    time: "8:23 AM",
    unread: false,
    starred: true,
    folder: "inbox",
    labels: ["Investors", "Postage"],
    avatarColor: "#9098a4",
  },
  // --- requests (paid, unknown sender) ---
  {
    id: "fix-005",
    from: "Unknown Sender",
    email: ADDR_A,
    subject: "Message request awaiting approval",
    preview: "This sender paid postage but is not in your trusted contacts yet.",
    body: "This sender paid postage but is not in your trusted contacts yet.\n\nApprove the request to decrypt future messages, or reject it to keep the address quarantined.",
    time: "7:48 AM",
    unread: true,
    starred: false,
    folder: "requests",
    labels: ["Request", "Paid"],
    avatarColor: "#3d434d",
  },
  // --- encrypted ---
  {
    id: "fix-006",
    from: "Nadia Reyes",
    email: "nadia*atlas.dev",
    subject: "Encrypted payload test",
    preview: "The Curve25519 envelope opens cleanly with the same account key.",
    body: "The Curve25519 envelope opens cleanly on desktop and mobile with the same account key.\n\nAttached: test vector and decoded header output.",
    time: "Yesterday",
    unread: false,
    starred: false,
    folder: "encrypted",
    labels: ["Encrypted", "Engineering"],
    attachments: [{ name: "payload-test-vector.json", size: "18 KB", type: "json" }],
    avatarColor: "#5b6470",
  },
  // --- receipts ---
  {
    id: "fix-007",
    from: "Receipt Contract",
    email: "receipts*stealth.network",
    subject: "Delivery receipt settled",
    preview: "Soroban receipt confirmed read proof for message 48fb...c29a.",
    body: "Delivery receipt settled.\n\nMessage: 48fb...c29a\nContract: CCL2...9DME\nEvent: read_proof\nFee: 0.00002 XLM",
    time: "Yesterday",
    unread: false,
    starred: false,
    folder: "receipts",
    labels: ["Receipt", "Soroban"],
    avatarColor: "#7a8290",
  },
  // --- snoozed ---
  {
    id: "fix-008",
    from: "Aria Voss",
    email: "aria*studio.aria",
    subject: "Studio visit next Thursday?",
    preview: "Snoozed until tomorrow — Aria wants to show the new prints in person.",
    body: "Would love to show you the new prints in person. We're in the Mission until the end of the month.",
    time: "Tomorrow",
    unread: false,
    starred: false,
    folder: "snoozed",
    labels: ["Event", "Snoozed"],
    avatarColor: "#4d5560",
    event: calendarEventStudio,
  },
  // --- archive ---
  {
    id: "fix-009",
    from: "Marcus Chen",
    email: "marcus*northwind.io",
    subject: "Re: Architecture review notes",
    preview: "A few follow-ups on the edge runtime concerns we discussed.",
    body: "Thanks for the deep dive yesterday. A few follow-ups on the edge runtime concerns we discussed.",
    time: "Mon",
    unread: false,
    starred: true,
    folder: "archive",
    labels: ["Engineering"],
    avatarColor: "#9098a4",
  },
  // --- sent ---
  {
    id: "fix-010",
    from: "Eve Navarro",
    email: "eve*stealth.xyz",
    subject: "Re: Co-marketing proposal",
    preview: "Sent with verified postage and memo hash 8d31...5b9c.",
    body: "Thanks Daniela,\n\nThis sounds useful. I sent over the launch calendar and the partner guidelines. The on-chain memo for this message is 8d31...5b9c.\n\nEve",
    time: "Sun",
    unread: false,
    starred: false,
    folder: "sent",
    labels: ["Partnerships"],
    avatarColor: "#3d434d",
  },
  // --- drafts ---
  {
    id: "fix-011",
    from: "Eve Navarro",
    email: "eve*stealth.xyz",
    subject: "Protocol launch notes",
    preview: "Draft saved locally. Add sender-verification screenshots before sending.",
    body: "Launch notes:\n\n- Explain Stellar federation in one paragraph\n- Show paid inbox settings\n- Add proof badge states\n- Include migration path for SMTP contacts",
    time: "Sat",
    unread: false,
    starred: false,
    folder: "drafts",
    labels: ["Draft"],
    avatarColor: "#5b6470",
  },
  // --- scheduled ---
  {
    id: "fix-012",
    from: "Eve Navarro",
    email: "eve*stealth.xyz",
    subject: "Founder update - scheduled",
    preview: "Scheduled for tomorrow at 8:00 AM with minimum postage attached.",
    body: "This founder update is scheduled for tomorrow at 8:00 AM.\n\nMinimum postage is attached and the memo hash will be generated at send time.",
    time: "Tomorrow",
    unread: false,
    starred: false,
    folder: "scheduled",
    labels: ["Scheduled"],
    avatarColor: "#7a8290",
  },
  // --- outbox (signature required) ---
  {
    id: "fix-013",
    from: "Outbound Queue",
    email: "queue*stealth.network",
    subject: "Waiting for wallet signature",
    preview: "One message is ready but still needs a Stellar wallet signature.",
    body: "One message is ready to leave your outbox.\n\nStatus: waiting for wallet signature\nPostage: 0.00001 XLM",
    time: "Now",
    unread: true,
    starred: false,
    folder: "outbox",
    labels: ["Signature Required"],
    avatarColor: "#4d5560",
  },
  // --- spam ---
  {
    id: "fix-014",
    from: "Legacy Bridge",
    email: "bridge*stealth.network",
    subject: "SMTP bridge warning",
    preview: "This message was bridged from SMTP and cannot be fully verified.",
    body: "This message was bridged from SMTP and cannot be fully verified.\n\nThe sender domain passed standard checks, but there is no Stellar signature attached.",
    time: "Fri",
    unread: false,
    starred: false,
    folder: "spam",
    labels: ["Bridge", "Unverified"],
    avatarColor: "#9098a4",
  },
  // --- trash ---
  {
    id: "fix-015",
    from: "Deleted Thread",
    email: "old-contact*example.fixture",
    subject: "Old import from test inbox",
    preview: "This imported thread is marked for deletion.",
    body: "This imported thread is marked for deletion and will be removed after the retention window closes.",
    time: "Jan 12",
    unread: false,
    starred: false,
    folder: "trash",
    avatarColor: "#3d434d",
  },
] satisfies Email[]);

// ---------------------------------------------------------------------------
// Folder view fixtures — derived subsets for each UI scenario
// ---------------------------------------------------------------------------

export function emailsForFolder(folder: MailFolder): Email[] {
  const INBOX_PROTOCOL = new Set<string>(["inbox", "priority", "verified", "pending", "requests", "encrypted"]);
  if (folder === "all") return EMAILS.filter((e) => e.folder !== "spam" && e.folder !== "trash") as Email[];
  if (folder === "starred") return EMAILS.filter((e) => e.starred) as Email[];
  if (folder === "inbox") return EMAILS.filter((e) => INBOX_PROTOCOL.has(e.folder)) as Email[];
  return EMAILS.filter((e) => e.folder === folder) as Email[];
}

/** Single email used as the selected/open email in reader tests. */
export const SELECTED_EMAIL: Email = EMAILS.find((e) => e.id === "fix-001")!;

/** Email with a calendar event attached. */
export const EMAIL_WITH_EVENT: Email = EMAILS.find((e) => e.id === "fix-002")!;

/** Email with an OTP code in body. */
export const EMAIL_OTP: Email = EMAILS.find((e) => e.id === "fix-003")!;

/** Encrypted email. */
export const EMAIL_ENCRYPTED: Email = EMAILS.find((e) => e.id === "fix-006")!;

/** Receipt email. */
export const EMAIL_RECEIPT: Email = EMAILS.find((e) => e.id === "fix-007")!;

// ---------------------------------------------------------------------------
// Calendar fixtures
// ---------------------------------------------------------------------------

export const CALENDARS: readonly CalendarDefinition[] = Object.freeze([
  { id: "personal", name: "Personal", color: "#d5d7dc", visible: true },
  { id: "work", name: "Work", color: "#8fa8ff", visible: true },
  { id: "protocol", name: "Protocol", color: "#6ee7c7", visible: true },
]);

export const CALENDAR_EVENTS: readonly CalendarEvent[] = Object.freeze([
  {
    id: "fix-cal-001",
    title: "Design review",
    date: "2026-06-13",
    time: "10:00",
    endTime: "10:45",
    location: "Vantage studio",
    note: "Approve final identity direction and motion principles.",
    calendarId: "work",
    cadence: "One time",
    organizer: "Lina Park",
    meetingUrl: "https://meet.stealth.local/design-review",
    response: "going",
    reminder: "15 minutes",
  },
  {
    id: "fix-cal-002",
    title: "1:1 with Marcus",
    date: "2026-06-13",
    time: "13:30",
    endTime: "14:00",
    location: "Private relay room",
    note: "Review edge runtime follow-ups and ownership.",
    calendarId: "work",
    cadence: "Weekly",
    organizer: "Marcus Chen",
    response: "going",
    reminder: "10 minutes",
  },
  {
    id: "fix-cal-003",
    title: "Investor sync",
    date: "2026-06-13",
    time: "16:00",
    endTime: "16:45",
    location: "Lumos Capital",
    note: "Walk through paid inbox thresholds and postage refunds.",
    calendarId: "protocol",
    cadence: "Monthly",
    organizer: "Uthaimin Lawal",
    response: "maybe",
    reminder: "30 minutes",
  },
  {
    id: "fix-cal-004",
    title: "Protocol launch planning",
    date: "2026-06-16",
    time: "09:00",
    endTime: "10:30",
    location: "Stealth operations",
    note: "Finalize launch sequence, sender policy defaults, and proof messaging.",
    calendarId: "protocol",
    cadence: "One time",
    response: "going",
    reminder: "1 hour",
  },
] satisfies CalendarEvent[]);

// ---------------------------------------------------------------------------
// Preference fixtures
// ---------------------------------------------------------------------------

export const PREFS_DEFAULT: UiPreferences = Object.freeze({
  theme: "dark",
  compactMode: false,
  showAvatars: true,
  emailNotifications: true,
  desktopNotifications: true,
  sound: false,
  unknownSenders: "request",
  minimumPostage: "0.0001",
  onboardingCompleted: true,
  receiptOnDelivery: false,
});

export const PREFS_COMPACT: UiPreferences = Object.freeze({
  ...PREFS_DEFAULT,
  compactMode: true,
  showAvatars: false,
});

export const PREFS_STRICT_POLICY: UiPreferences = Object.freeze({
  ...PREFS_DEFAULT,
  unknownSenders: "verified",
  minimumPostage: "0.001",
  receiptOnDelivery: true,
});

// ---------------------------------------------------------------------------
// Feedback / notification fixtures
// ---------------------------------------------------------------------------

export const FEEDBACK_ITEMS: readonly FeedbackItem[] = Object.freeze([
  { id: "fix-fb-001", message: "Message sent with verified postage.", tone: "success" },
  { id: "fix-fb-002", message: "Relay node 07 is offline — retrying.", tone: "warning" },
  { id: "fix-fb-003", message: "Wallet signature rejected.", tone: "danger" },
  { id: "fix-fb-004", message: "Draft saved.", tone: "neutral" },
] satisfies FeedbackItem[]);

// ---------------------------------------------------------------------------
// Compose draft fixture
// ---------------------------------------------------------------------------

export const COMPOSE_DRAFT = Object.freeze({
  to: "nadia*atlas.dev",
  subject: "Re: Encrypted payload test",
  body: "Thanks for the test vector. The envelope opens cleanly on my side too.",
  attachPostage: true,
  postageAmount: "0.00001",
  encrypt: true,
  scheduleAt: null as string | null,
});

// ---------------------------------------------------------------------------
// Stellar account identity fixture
// ---------------------------------------------------------------------------

export const IDENTITY = Object.freeze({
  displayName: "Eve Navarro",
  stealthAddress: "eve*stealth.xyz",
  stellarAddress: ADDR_C,
  publicKey: ADDR_C,
});

// ---------------------------------------------------------------------------
// Empty-state scenarios
// ---------------------------------------------------------------------------

export const EMPTY_FOLDERS: MailFolder[] = [
  "inbox",
  "verified",
  "pending",
  "requests",
  "encrypted",
  "receipts",
  "snoozed",
  "spam",
  "trash",
  "starred",
];
