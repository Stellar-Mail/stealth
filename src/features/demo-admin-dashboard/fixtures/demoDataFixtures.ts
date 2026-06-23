import { DemoDashboardData } from "../types/demoData";

export const defaultDemoDashboardData: DemoDashboardData = {
  accounts: [
    { name: "Alice Demo", address: "GABCD...1234", balance: "500.0 XLM", type: "User" },
    { name: "Bob Demo", address: "GBCDE...2345", balance: "320.0 XLM", type: "User" },
    { name: "Relay East", address: "GCDEF...3456", balance: "1,200.0 XLM", type: "Relay" },
    { name: "Relay West", address: "GDEFG...4567", balance: "980.0 XLM", type: "Relay" },
  ],
  mail: [
    { subject: "Welcome to Stealth", status: "delivered", folder: "inbox" },
    { subject: "Invoice #1042", status: "pending", folder: "requests" },
    { subject: "Meeting notes", status: "delivered", folder: "inbox" },
    { subject: "Newsletter #47", status: "held", folder: "spam" },
  ],
  audit: [
    { action: "Session started", actor: "demo-user-1", timestamp: "2026-06-16T09:00:00Z" },
    { action: "Policy default changed to request", actor: "demo-user-1", timestamp: "2026-06-16T09:05:00Z" },
    { action: "Sender approved: alice*stealth.xyz", actor: "demo-user-1", timestamp: "2026-06-16T09:10:00Z" },
    { action: "Postage refunded for msg_abc123", actor: "system", timestamp: "2026-06-16T09:12:00Z" },
  ],
};
