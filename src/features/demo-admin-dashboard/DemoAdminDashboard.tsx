import { useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Calendar,
  FileText,
  History,
  LayoutDashboard,
  Mail,
  Paperclip,
  PieChart,
  Shield,
  Target,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CAMPAIGN_TEMPLATES } from "./fixtures/campaignFixtures";
import type {
  DashboardNavItem,
  DashboardSection,
  DemoAdminDashboardProps,
  StatCard,
  PresetId,
  PresetAccount,
  PresetMail,
  PresetAuditEvent,
  PresetAttachment,
  PresetEvent,
} from "./types";
import { TemplatePicker } from "./templates";
import { PRESET_SCENARIOS } from "./fixtures/presets";
import { AdminDataTable, type Column } from "./components/AdminDataTable";
import { CampaignMessageAssignmentPanel } from "./components/CampaignMessageAssignmentPanel";

// ─── Default Deterministic fake data ──────────────────────────────────────────

const NAV_ITEMS: DashboardNavItem[] = [
  { id: "overview", label: "Overview", description: "High-level demo system status" },
  { id: "accounts", label: "Accounts", description: "Demo Stellar accounts and balances" },
  { id: "mail", label: "Mail", description: "Demo mail fixtures and delivery states" },
  { id: "attachments", label: "Attachments", description: "Demo mail attachment fixtures" },
  { id: "events", label: "Events", description: "Demo calendar and protocol events" },
  { id: "templates", label: "Templates", description: "Pick message templates to populate drafts" },
  { id: "campaigns", label: "Campaigns", description: "Save and restore campaign draft snapshots" },
  { id: "audit", label: "Audit", description: "Demo protocol event log" },
  { id: "analytics", label: "Analytics", description: "Privacy-preserving product analytics" },
];

const OVERVIEW_STATS: StatCard[] = [
  { label: "Active Accounts", value: "12", delta: "+2" },
  { label: "Messages Sent", value: "847", delta: "+12%" },
  { label: "Pending Requests", value: "3", delta: "-1" },
  { label: "Total Postage (XLM)", value: "1,240.5", delta: "+45.2" },
];

const ACCOUNTS_FAKE: PresetAccount[] = [
  { name: "Alice Demo", address: "GABCD...1234", balance: "500.0 XLM", type: "User" },
  { name: "Bob Demo", address: "GBCDE...2345", balance: "320.0 XLM", type: "User" },
  { name: "Relay East", address: "GCDEF...3456", balance: "1,200.0 XLM", type: "Relay" },
  { name: "Relay West", address: "GDEFG...4567", balance: "980.0 XLM", type: "Relay" },
];

const MAIL_FIXTURES: PresetMail[] = [
  {
    subject: "Welcome to Stealth",
    status: "delivered",
    folder: "inbox",
    from: "Stealth Team",
    email: "welcome*stealth.demo",
    body: "Hi there,\n\nYour Stealth mailbox is set up. You decide who can reach you: trusted contacts arrive instantly, everyone else follows the policy you choose.\n\nReply any time to start a conversation.\n\n— The Stealth demo team",
    time: "9:42 AM",
    unread: true,
    starred: true,
    labels: ["onboarding", "intro"],
    avatarColor: "#5b6470",
  },
  {
    subject: "Invoice #1042",
    status: "pending",
    folder: "requests",
    from: "Vendor Demo",
    email: "billing*stealth.demo",
    body: "Please find attached your invoice #1042.\n\nAmount: 120 XLM\nStatus: pending",
    time: "9:18 AM",
    unread: true,
    starred: false,
    labels: ["invoice"],
    avatarColor: "#7a8290",
  },
  {
    subject: "Meeting notes",
    status: "delivered",
    folder: "inbox",
    from: "Bob Demo",
    email: "bob*stealth.demo",
    body: "Here are the meeting notes from today's discussion.",
    time: "8:57 AM",
    unread: false,
    starred: false,
    labels: ["notes"],
    avatarColor: "#4d5560",
  },
  {
    subject: "Newsletter #47",
    status: "held",
    folder: "spam",
    from: "Newsletter System",
    email: "digest*stealth.demo",
    body: "Your weekly newsletter is ready to view.",
    time: "Yesterday",
    unread: false,
    starred: false,
    labels: ["digest"],
    avatarColor: "#9098a4",
  },
];

const AUDIT_EVENTS_FAKE: PresetAuditEvent[] = [
  { action: "Session started", actor: "demo-user-1", timestamp: "2026-06-16T09:00:00Z" },
  {
    action: "Policy default changed to request",
    actor: "demo-user-1",
    timestamp: "2026-06-16T09:05:00Z",
  },
  {
    action: "Sender approved: alice*stealth.demo",
    actor: "demo-user-1",
    timestamp: "2026-06-16T09:10:00Z",
  },
  { action: "Postage refunded for msg_abc123", actor: "system", timestamp: "2026-06-16T09:12:00Z" },
];

const ATTACHMENTS_FAKE: PresetAttachment[] = [
  {
    id: "att-inv-1042",
    fileName: "invoice_1042.pdf",
    fileSize: "120 KB",
    fileType: "PDF Document",
    messageSubject: "Invoice #1042",
    sender: "Vendor Demo",
  },
  {
    id: "att-roundtable",
    fileName: "roundtable_agenda.pdf",
    fileSize: "85 KB",
    fileType: "PDF Document",
    messageSubject: "You're invited: Stealth demo roundtable",
    sender: "events*stealth.demo",
  },
];

const EVENTS_FAKE: PresetEvent[] = [
  {
    id: "evt-roundtable",
    title: "Stealth demo roundtable",
    date: "2026-07-09",
    time: "3:00 PM",
    location: "Demo room",
    organizer: "events*stealth.demo",
    status: "confirmed",
  },
  {
    id: "evt-sync",
    title: "Weekly Sync",
    date: "2026-06-18",
    time: "10:00 AM",
    location: "Virtual",
    organizer: "bob*stealth.demo",
    status: "confirmed",
  },
];

// ─── Section icon map ─────────────────────────────────────────────────────────

const SECTION_ICON: Record<DashboardSection, React.ElementType> = {
  overview: LayoutDashboard,
  accounts: Users,
  mail: Mail,
  attachments: Paperclip,
  events: Calendar,
  templates: FileText,
  campaigns: History,
  audit: Activity,
  analytics: PieChart,
};

// ─── Content region components ────────────────────────────────────────────────

function OverviewContent({
  activePresetId,
  setActivePresetId,
  stats,
}: {
  activePresetId: PresetId;
  setActivePresetId: (id: PresetId) => void;
  stats: StatCard[];
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Summary of the demo environment. All data is synthetic and resets on each page load.
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
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

      {/* Preset Selector */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-400" />
            Protocol Scenario Presets
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Select a preset to populate the dashboard tables with simulated ledger states, relay
            nodes, and pending proof mail flows.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              id: "none" as const,
              name: "Default System",
              desc: "Standard demo system stats and static fixtures.",
            },
            {
              id: "relay-verification" as const,
              name: "Relay Verification",
              desc: "Simulates registering and verifying a new relay node.",
            },
            {
              id: "proof-pending" as const,
              name: "Proof Pending",
              desc: "Simulates an on-chain cryptographic proof generation delay.",
            },
            {
              id: "receipt-settlement" as const,
              name: "Receipt Settlement",
              desc: "Simulates postage fees and read receipts confirming on-chain.",
            },
          ].map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setActivePresetId(preset.id);
                }}
                className={cn(
                  "rounded-xl border p-4 text-left transition flex flex-col justify-between h-36 w-full",
                  active
                    ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]",
                )}
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">{preset.name}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
                    {preset.desc}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-2 text-[10px] font-medium self-start px-2 py-0.5 rounded-full",
                    active ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-muted-foreground",
                  )}
                >
                  {active ? "Active" : "Activate"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AccountsContent({
  accounts,
  selectedAccountAddress,
  setSelectedAccountAddress,
}: {
  accounts: PresetAccount[];
  selectedAccountAddress: string | null;
  setSelectedAccountAddress: (addr: string | null) => void;
}) {
  const columns: Column<PresetAccount>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (acct) => (
        <div className="flex items-center gap-2">
          <span>{acct.name}</span>
          {acct.relayMetadata && (
            <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-medium text-indigo-400 border border-indigo-500/20">
              Inspectable
            </span>
          )}
        </div>
      ),
    },
    {
      key: "address",
      header: "Address",
      sortable: true,
      render: (acct) => (
        <span className="font-mono text-xs text-muted-foreground">{acct.address}</span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      sortable: true,
      sortValue: (acct) => parseFloat(acct.balance.replace(/[^0-9.]/g, "")),
      render: (acct) => <span className="tabular-nums">{acct.balance}</span>,
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (acct) => (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            acct.type.includes("Relay") && "bg-indigo-500/10 text-indigo-400",
            acct.type.includes("Contract") && "bg-purple-500/10 text-purple-400",
            acct.type === "User" && "bg-white/5 text-muted-foreground",
          )}
        >
          {acct.type}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (acct) => acct.relayMetadata?.status ?? "none",
      render: (acct) => {
        const status = acct.relayMetadata?.status;
        if (!status) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium uppercase text-[9px] border",
              status === "verified" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              status === "pending" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
              status === "failed" && "bg-rose-500/10 text-rose-400 border-rose-500/20",
            )}
          >
            {status}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Demo Stellar accounts used for populating the inbox UI. Rows with metadata can be clicked to
        inspect details.
      </p>
      <AdminDataTable
        data={accounts}
        columns={columns}
        onRowClick={(acct) => {
          if (acct.relayMetadata) {
            setSelectedAccountAddress(
              selectedAccountAddress === acct.address ? null : acct.address,
            );
          }
        }}
        selectedRowKey={(acct) => selectedAccountAddress === acct.address}
        defaultSortKey="name"
      />
    </div>
  );
}

function MailContent({
  mail,
  selectedMailSubject,
  setSelectedMailSubject,
}: {
  mail: PresetMail[];
  selectedMailSubject: string | null;
  setSelectedMailSubject: (subject: string | null) => void;
}) {
  const columns: Column<PresetMail>[] = [
    {
      key: "subject",
      header: "Subject",
      sortable: true,
      render: (item) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.subject}</span>
            {item.proofMetadata && (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400 border border-emerald-500/20">
                Has Proof
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            From: {item.from} ({item.email})
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (item) => (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border",
            item.status === "delivered" &&
              "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            item.status === "pending" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
            item.status === "held" && "bg-rose-500/10 text-rose-400 border-rose-500/20",
          )}
        >
          {item.status}
        </span>
      ),
    },
    {
      key: "folder",
      header: "Folder",
      sortable: true,
      render: (item) => <span className="text-muted-foreground">{item.folder}</span>,
    },
    {
      key: "time",
      header: "Time",
      sortable: true,
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Mail fixtures available for populating the demo inbox. Rows with cryptographic proofs can be
        clicked to inspect ledger details.
      </p>
      <AdminDataTable
        data={mail}
        columns={columns}
        onRowClick={(item) => {
          if (item.proofMetadata) {
            setSelectedMailSubject(selectedMailSubject === item.subject ? null : item.subject);
          }
        }}
        selectedRowKey={(item) => selectedMailSubject === item.subject}
        defaultSortKey="time"
        defaultSortDirection="desc"
      />
    </div>
  );
}

function AttachmentsContent({ attachments }: { attachments: PresetAttachment[] }) {
  const columns: Column<PresetAttachment>[] = [
    {
      key: "fileName",
      header: "File Name",
      sortable: true,
      render: (att) => (
        <div className="flex items-center gap-2 font-medium">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>{att.fileName}</span>
        </div>
      ),
    },
    {
      key: "fileSize",
      header: "Size",
      sortable: true,
    },
    {
      key: "fileType",
      header: "Type",
      sortable: true,
      render: (att) => (
        <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-white/[0.04]">
          {att.fileType}
        </span>
      ),
    },
    {
      key: "messageSubject",
      header: "Source Message",
      sortable: true,
      render: (att) => <span className="text-muted-foreground">{att.messageSubject}</span>,
    },
    {
      key: "sender",
      header: "Sender",
      sortable: true,
      render: (att) => (
        <span className="font-mono text-xs text-muted-foreground">{att.sender}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Deterministic file attachments mock list, extracted from active mail fixtures.
      </p>
      <AdminDataTable data={attachments} columns={columns} defaultSortKey="fileName" />
    </div>
  );
}

function EventsContent({ events }: { events: PresetEvent[] }) {
  const columns: Column<PresetEvent>[] = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      render: (evt) => (
        <div className="flex items-center gap-2 font-medium">
          <Calendar className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>{evt.title}</span>
        </div>
      ),
    },
    {
      key: "date",
      header: "Scheduled Time",
      sortable: true,
      sortValue: (evt) =>
        new Date(`${evt.date}T${evt.time.replace(" PM", "").replace(" AM", "")}`).getTime(),
      render: (evt) => (
        <span className="tabular-nums">
          {evt.date} · {evt.time}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      sortable: true,
      render: (evt) => <span className="text-muted-foreground">{evt.location}</span>,
    },
    {
      key: "organizer",
      header: "Organizer",
      sortable: true,
      render: (evt) => (
        <span className="font-mono text-xs text-muted-foreground">{evt.organizer}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (evt) => (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase text-[9px] border",
            evt.status === "confirmed" &&
              "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            evt.status === "tentative" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
            evt.status === "cancelled" && "bg-rose-500/10 text-rose-400 border-rose-500/20",
          )}
        >
          {evt.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Stellar node registration and verification events.
      </p>
      <AdminDataTable data={events} columns={columns} defaultSortKey="date" />
    </div>
  );
}

function AuditContent({ auditEvents }: { auditEvents: PresetAuditEvent[] }) {
  const columns: Column<PresetAuditEvent>[] = [
    {
      key: "action",
      header: "Action",
      sortable: true,
      render: (evt) => (
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium">{evt.action}</span>
        </div>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      sortable: true,
      render: (evt) => <span className="font-mono text-xs text-muted-foreground">{evt.actor}</span>,
    },
    {
      key: "timestamp",
      header: "Timestamp",
      sortable: true,
      sortValue: (evt) => new Date(evt.timestamp).getTime(),
      render: (evt) => (
        <span className="text-muted-foreground tabular-nums">
          {new Date(evt.timestamp).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Recent demo protocol events. No real user data or message body content is recorded.
      </p>
      <AdminDataTable
        data={auditEvents}
        columns={columns}
        defaultSortKey="timestamp"
        defaultSortDirection="desc"
      />
    </div>
  );
}

function TemplatesContent() {
  return <TemplatePicker />;
}

// ─── Dashboard Shell ──────────────────────────────────────────────────────────

export function DemoAdminDashboard({ className }: DemoAdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const [activePresetId, setActivePresetId] = useState<PresetId>("none");
  const [selectedAccountAddress, setSelectedAccountAddress] = useState<string | null>(null);
  const [selectedMailSubject, setSelectedMailSubject] = useState<string | null>(null);

  const activePreset = PRESET_SCENARIOS.find((p) => p.id === activePresetId);

  const stats = activePreset ? activePreset.stats : OVERVIEW_STATS;
  const accounts = activePreset ? activePreset.accounts : ACCOUNTS_FAKE;
  const mail = activePreset ? activePreset.mail : MAIL_FIXTURES;
  const attachments = activePreset ? activePreset.attachments : ATTACHMENTS_FAKE;
  const events = activePreset ? activePreset.events : EVENTS_FAKE;
  const auditEvents = activePreset ? activePreset.auditEvents : AUDIT_EVENTS_FAKE;

  const selectedAccount = accounts.find((a) => a.address === selectedAccountAddress);
  const selectedMail = mail.find((m) => m.subject === selectedMailSubject);

  const handleSectionChange = (section: DashboardSection) => {
    setActiveSection(section);
    setSelectedAccountAddress(null);
    setSelectedMailSubject(null);
  };

  const Icon = SECTION_ICON[activeSection];

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-black/60 backdrop-blur-xl",
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
        <div className="flex items-center gap-2">
          {activePresetId !== "none" && (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-500/20">
              Preset: {activePreset?.name}
            </span>
          )}
          <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-foreground">
            Demo
          </span>
        </div>
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
              onClick={() => handleSectionChange(item.id)}
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
      <div
        className="flex-1 overflow-y-auto p-6"
        role="tabpanel"
        aria-label={`${activeSection} section`}
      >
        <div className="mx-auto max-w-4xl">
          {/* Section header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground capitalize">{activeSection}</h3>
            </div>
            {activePresetId !== "none" && (
              <span className="text-xs text-amber-400 font-medium">
                Simulated {activePreset?.name} flow active
              </span>
            )}
          </div>

          {activeSection === "overview" && (
            <OverviewContent
              activePresetId={activePresetId}
              setActivePresetId={(id) => {
                setActivePresetId(id);
                setSelectedAccountAddress(null);
                setSelectedMailSubject(null);
              }}
              stats={stats}
            />
          )}

          {activeSection === "accounts" && (
            <AccountsContent
              accounts={accounts}
              selectedAccountAddress={selectedAccountAddress}
              setSelectedAccountAddress={setSelectedAccountAddress}
            />
          )}

          {activeSection === "mail" && (
            <MailContent
              mail={mail}
              selectedMailSubject={selectedMailSubject}
              setSelectedMailSubject={setSelectedMailSubject}
            />
          )}

          {activeSection === "attachments" && <AttachmentsContent attachments={attachments} />}

          {activeSection === "events" && <EventsContent events={events} />}

          {activeSection === "templates" && <TemplatesContent />}

          {activeSection === "campaigns" && <CampaignMessageAssignmentPanel />}

          {activeSection === "audit" && <AuditContent auditEvents={auditEvents} />}
        </div>
      </div>

      {/* ── Slide-out Inspection Panel (Drawer for Account/Relay Metadata) ── */}
      {selectedAccount && selectedAccount.relayMetadata && (
        <div className="absolute inset-y-0 right-0 z-40 w-96 border-l border-white/[0.08] bg-black/95 p-6 shadow-2xl backdrop-blur-xl transition-all flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Relay Node Inspector</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedAccount.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccountAddress(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <h5 className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold">
                Relay Registry Metadata
              </h5>
              <div className="space-y-3 rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 text-xs leading-normal">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Node Address:</span>
                  <span className="font-mono text-foreground">
                    {selectedAccount.relayMetadata.nodeUri}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stellar Account:</span>
                  <span className="font-mono text-foreground text-[10px]">
                    {selectedAccount.address}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Routing Latency:</span>
                  <span className="text-foreground font-medium">
                    {selectedAccount.relayMetadata.latency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signature Scheme:</span>
                  <span className="text-foreground font-medium">
                    {selectedAccount.relayMetadata.signatureScheme}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Owner Account:</span>
                  <span className="font-mono text-foreground break-all text-[10px] block mt-0.5">
                    {selectedAccount.relayMetadata.owner}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Verification Status:</span>
                  <span
                    className={cn(
                      "font-semibold uppercase text-[9px] px-1.5 py-0.5 rounded",
                      selectedAccount.relayMetadata.status === "verified" &&
                        "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                      selectedAccount.relayMetadata.status === "pending" &&
                        "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                    )}
                  >
                    {selectedAccount.relayMetadata.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedAccountAddress(null)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.02] py-2 text-xs font-semibold text-foreground hover:bg-white/5 transition"
          >
            Close Inspector
          </button>
        </div>
      )}

      {/* ── Slide-out Inspection Panel (Drawer for Cryptographic Ledger Proof) ── */}
      {selectedMail && selectedMail.proofMetadata && (
        <div className="absolute inset-y-0 right-0 z-40 w-96 border-l border-white/[0.08] bg-black/95 p-6 shadow-2xl backdrop-blur-xl transition-all flex flex-col justify-between">
          <div className="space-y-6 overflow-y-auto flex-1 pr-1">
            <div className="flex items-start justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Ledger Proof Inspector</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedMail.subject}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMailSubject(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <h5 className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                Cryptographic Details
              </h5>
              <div className="space-y-3 rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 text-xs leading-normal">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Message Hash:</span>
                  <span className="font-mono text-foreground break-all text-[10px] block mt-0.5">
                    {selectedMail.proofMetadata.messageHash}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    Payment Preimage Hash:
                  </span>
                  <span className="font-mono text-foreground break-all text-[10px] block mt-0.5">
                    {selectedMail.proofMetadata.paymentHash}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Soroban Contract:</span>
                  <span className="font-mono text-foreground break-all text-[10px] block mt-0.5">
                    {selectedMail.proofMetadata.contractAddress}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Relay Latency:</span>
                  <span className="text-foreground font-medium">
                    {selectedMail.proofMetadata.latency}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    Cryptographic Signature:
                  </span>
                  <span className="font-mono text-foreground break-all text-[10px] block mt-0.5">
                    {selectedMail.proofMetadata.signature}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Postage State:</span>
                  <span
                    className={cn(
                      "font-semibold uppercase text-[9px] px-1.5 py-0.5 rounded",
                      selectedMail.proofMetadata.postageStatus === "settled" &&
                        "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                      selectedMail.proofMetadata.postageStatus === "pending" &&
                        "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                    )}
                  >
                    {selectedMail.proofMetadata.postageStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMailSubject(null)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.02] py-2 text-xs font-semibold text-foreground hover:bg-white/5 transition mt-4"
          >
            Close Inspector
          </button>
        </div>
      )}
    </div>
  );
}
