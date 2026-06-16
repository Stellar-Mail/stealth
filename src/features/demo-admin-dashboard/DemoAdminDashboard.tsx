import { useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Mail,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DashboardNavItem,
  DashboardSection,
  DemoAdminDashboardProps,
  StatCard,
} from "./types";

// ─── Deterministic fake data ──────────────────────────────────────────────────

const NAV_ITEMS: DashboardNavItem[] = [
  { id: "overview", label: "Overview", description: "High-level demo system status" },
  { id: "accounts", label: "Accounts", description: "Demo Stellar accounts and balances" },
  { id: "mail", label: "Mail", description: "Demo mail fixtures and delivery states" },
  { id: "audit", label: "Audit", description: "Demo protocol event log" },
];

const OVERVIEW_STATS: StatCard[] = [
  { label: "Active Accounts", value: "12", delta: "+2" },
  { label: "Messages Sent", value: "847", delta: "+12%" },
  { label: "Pending Requests", value: "3", delta: "-1" },
  { label: "Total Postage (XLM)", value: "1,240.5", delta: "+45.2" },
];

const ACCOUNTS_FAKE: { name: string; address: string; balance: string; type: string }[] = [
  { name: "Alice Demo", address: "GABCD...1234", balance: "500.0 XLM", type: "User" },
  { name: "Bob Demo", address: "GBCDE...2345", balance: "320.0 XLM", type: "User" },
  { name: "Relay East", address: "GCDEF...3456", balance: "1,200.0 XLM", type: "Relay" },
  { name: "Relay West", address: "GDEFG...4567", balance: "980.0 XLM", type: "Relay" },
];

const MAIL_FIXTURES: { subject: string; status: string; folder: string }[] = [
  { subject: "Welcome to Stealth", status: "delivered", folder: "inbox" },
  { subject: "Invoice #1042", status: "pending", folder: "requests" },
  { subject: "Meeting notes", status: "delivered", folder: "inbox" },
  { subject: "Newsletter #47", status: "held", folder: "spam" },
];

const AUDIT_EVENTS_FAKE: { action: string; actor: string; timestamp: string }[] = [
  { action: "Session started", actor: "demo-user-1", timestamp: "2026-06-16T09:00:00Z" },
  { action: "Policy default changed to request", actor: "demo-user-1", timestamp: "2026-06-16T09:05:00Z" },
  { action: "Sender approved: alice*stealth.xyz", actor: "demo-user-1", timestamp: "2026-06-16T09:10:00Z" },
  { action: "Postage refunded for msg_abc123", actor: "system", timestamp: "2026-06-16T09:12:00Z" },
];

// ─── Section icon map ─────────────────────────────────────────────────────────

const SECTION_ICON: Record<DashboardSection, React.ElementType> = {
  overview: LayoutDashboard,
  accounts: Users,
  mail: Mail,
  audit: Activity,
};

// ─── Content region components ────────────────────────────────────────────────

function OverviewContent() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Summary of the demo environment. All data is synthetic and resets on each page load.
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {OVERVIEW_STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
            {stat.delta && (
              <p className="mt-0.5 text-xs font-medium text-emerald-400">{stat.delta}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountsContent() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Demo Stellar accounts used for populating the inbox UI.
      </p>
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Address</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Balance</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
            </tr>
          </thead>
          <tbody>
            {ACCOUNTS_FAKE.map((acct) => (
              <tr key={acct.address} className="border-b border-white/[0.04] last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{acct.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {acct.address}
                </td>
                <td className="px-4 py-3 tabular-nums text-foreground">{acct.balance}</td>
                <td className="px-4 py-3 text-muted-foreground">{acct.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MailContent() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Mail fixtures available for populating the demo inbox.
      </p>
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-4 py-3 font-medium text-muted-foreground">Subject</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Folder</th>
            </tr>
          </thead>
          <tbody>
            {MAIL_FIXTURES.map((mail, i) => (
              <tr key={i} className="border-b border-white/[0.04] last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{mail.subject}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      mail.status === "delivered" &&
                        "bg-emerald-500/10 text-emerald-400",
                      mail.status === "pending" &&
                        "bg-amber-500/10 text-amber-400",
                      mail.status === "held" &&
                        "bg-rose-500/10 text-rose-400",
                    )}
                  >
                    {mail.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{mail.folder}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditContent() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Recent demo protocol events. No real user data or message body content is recorded.
      </p>
      <div className="space-y-2">
        {AUDIT_EVENTS_FAKE.map((evt, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-3"
          >
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.04]">
              <Shield className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{evt.action}</p>
              <p className="text-xs text-muted-foreground">
                {evt.actor} &middot; {new Date(evt.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SECTION_CONTENT: Record<DashboardSection, () => ReactNode> = {
  overview: OverviewContent,
  accounts: AccountsContent,
  mail: MailContent,
  audit: AuditContent,
};

// ─── Dashboard Shell ──────────────────────────────────────────────────────────

export function DemoAdminDashboard({ className }: DemoAdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const Icon = SECTION_ICON[activeSection];
  const ContentComponent = SECTION_CONTENT[activeSection];

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black/60 backdrop-blur-xl",
        className,
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
            <BarChart3 className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Demo Admin Dashboard</h2>
            <p className="text-xs text-muted-foreground">
              Manage demo data for the Stealth inbox UI
            </p>
          </div>
        </div>
        <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
          Demo
        </span>
      </div>

      {/* ── Navigation slots ── */}
      <nav
        className="flex gap-1 border-b border-white/[0.06] px-4 py-2"
        role="tablist"
        aria-label="Admin dashboard sections"
      >
        {NAV_ITEMS.map((item) => {
          const NavIcon = SECTION_ICON[item.id];
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              aria-label={item.description}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                isActive
                  ? "bg-white/[0.08] text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <NavIcon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* ── Content region ── */}
      <div className="flex-1 overflow-y-auto p-6" role="tabpanel" aria-label={`${activeSection} section`}>
        <div className="mx-auto max-w-4xl">
          {/* Section header */}
          <div className="mb-6 flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground capitalize">
              {activeSection}
            </h3>
          </div>

          <ContentComponent />
        </div>
      </div>
    </div>
  );
}
