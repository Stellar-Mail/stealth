export type AdminDashboardBreakpoint = "tablet" | "laptop" | "desktop";

export type AdminDashboardPanel = {
  id: string;
  title: string;
  description: string;
  status: "ready" | "needs-review" | "draft";
  demoRecords: number;
};

export type AdminDashboardWidthNote = {
  breakpoint: AdminDashboardBreakpoint;
  minWidth: number;
  maxWidth?: number;
  columns: number;
  sidebarMode: "stacked" | "rail" | "expanded";
  note: string;
};

export type AdminDashboardLayoutCheck = {
  id: string;
  label: string;
  breakpoint: AdminDashboardBreakpoint;
  expected: string;
};

/**
 * Types for the Demo Admin Dashboard feature shell.
 *
 * All data is fake, deterministic, and safe for public repository review.
 * No real user data, secrets, private keys, or live network calls are used.
 */

/** A navigable section within the admin dashboard. */
export interface DashboardNavItem {
  /** Unique identifier for the section. */
  id: DashboardSection;
  /** Display label shown in the nav bar. */
  label: string;
  /** Optional short description for tooltips or aria labels. */
  description?: string;
}

/** The available top-level sections in the admin dashboard. */
export type DashboardSection =
  | "overview"
  | "accounts"
  | "mail"
  | "attachments"
  | "events"
  | "templates"
  | "campaigns"
  | "timeline"
  | "audit"
  | "analytics";

/** Props passed to the dashboard shell. */
export interface DemoAdminDashboardProps {
  /** Optional className override for the root element. */
  className?: string;
}

/** A summary stat card shown in the overview section. */
export interface StatCard {
  label: string;
  value: string;
  /** Optional comparison indicator (e.g., "+12%"). */
  delta?: string;
}

export type PresetId =
  | "none"
  | "relay-verification"
  | "proof-pending"
  | "paid-sender-request"
  | "receipt-settlement"
  | "encrypted-provenance"
  | "encrypted-payload"
  | "conference-pass";

export interface PresetAccount {
  name: string;
  address: string;
  balance: string;
  type: string;
  relayMetadata?: {
    nodeUri: string;
    latency: string;
    signatureScheme: string;
    status: "verified" | "pending" | "failed";
    owner: string;
  };
}

export interface PresetMail {
  subject: string;
  status: string;
  folder: string;
  from: string;
  email: string;
  body: string;
  time: string;
  unread: boolean;
  starred: boolean;
  labels: string[];
  avatarColor: string;
  postageAmount?: string;
  verifiedSender?: boolean;
  receiptState?: "none" | "pending" | "sent";
  proofMetadata?: {
    messageHash: string;
    paymentHash: string;
    diagnosticId: string;
    contractAddress: string;
    latency: string;
    signature: string;
    postageStatus: "pending" | "settled" | "refunded";
  };
}

export interface PresetAuditEvent {
  action: string;
  actor: string;
  timestamp: string;
}

export interface PresetAttachment {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  messageSubject: string;
  sender: string;
}

export interface PresetEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  status: "confirmed" | "tentative" | "cancelled";
}

export interface PresetScenario {
  id: PresetId;
  name: string;
  description: string;
  stats: StatCard[];
  accounts: PresetAccount[];
  mail: PresetMail[];
  attachments: PresetAttachment[];
  events: PresetEvent[];
  auditEvents: PresetAuditEvent[];
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface DemoItem {
  id: string;
  title: string;
  description: string;
}

export interface Persona {
  id: string;
  name: string;
  email: string;
  stellarAddress: string;
  avatar: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  owner: Persona;
  reviewer: Persona;
  lastEditor: Persona;
}
