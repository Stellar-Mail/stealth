import React, { useState } from "react";
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Mail,
  Shield,
  Users,
  Upload,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibilityInfo } from "./components/AccessibilityInfo";

import type {
  DashboardNavItem,
  DashboardSection,
  DemoAdminDashboardProps,
  StatCard,
} from "./types";
import { validateAndNormalizeDemoData, serializeDemoData } from "./utils/demoDataIo";
import { defaultDemoDashboardData } from "./fixtures/demoDataFixtures";
import type { DemoAccount, DemoMail, DemoAuditEvent, DemoDashboardData } from "./types/demoData";

// ─── Nav items mapping ────────────────────────────────────────────────────────

const NAV_ITEMS: DashboardNavItem[] = [
  { id: "overview", label: "Overview", description: "High-level demo system status" },
  { id: "accounts", label: "Accounts", description: "Demo Stellar accounts and balances" },
  { id: "mail", label: "Mail", description: "Demo mail fixtures and delivery states" },
  { id: "audit", label: "Audit", description: "Demo protocol event log" },
];

// ─── Section icon map ─────────────────────────────────────────────────────────

// ─── Section icon map ─────────────────────────────────────────────────────────

const SECTION_ICON: Record<DashboardSection, React.ElementType> = {
  overview: LayoutDashboard,
  accounts: Users,
  mail: Mail,
  audit: Activity,
};

// Keyboard navigation handler for the tablist


// ─── Content region components ────────────────────────────────────────────────

function OverviewContent({ stats }: { stats: StatCard[] }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Summary of the demo environment. All data is synthetic and updates dynamically on imports.
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
    </div>
  );
}

function AccountsContent({ accounts }: { accounts: DemoAccount[] }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Demo Stellar accounts used for populating the inbox UI.
      </p>
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Accounts table</caption>
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                Address
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                Balance
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No accounts found. Import data to populate.
                </td>
              </tr>
            ) : (
              accounts.map((acct, idx) => (
                <tr
                  key={`${acct.address}-${idx}`}
                  className="border-b border-white/[0.04] last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{acct.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {acct.address}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">{acct.balance}</td>
                  <td className="px-4 py-3 text-muted-foreground">{acct.type}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MailContent({ mail }: { mail: DemoMail[] }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Mail fixtures available for populating the demo inbox.
      </p>
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Mail fixtures table</caption>
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                Subject
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                Folder
              </th>
            </tr>
          </thead>
          <tbody>
            {mail.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  No mail fixtures found. Import data to populate.
                </td>
              </tr>
            ) : (
              mail.map((m, i) => (
                <tr key={i} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{m.subject}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        m.status === "delivered" && "bg-emerald-500/10 text-emerald-400",
                        m.status === "pending" && "bg-amber-500/10 text-amber-400",
                        m.status === "held" && "bg-rose-500/10 text-rose-400",
                      )}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.folder}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditContent({ audit }: { audit: DemoAuditEvent[] }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Recent demo protocol events. No real user data or message body content is recorded.
      </p>
      <div className="space-y-2">
        {audit.length === 0 ? (
          <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-8 text-center text-muted-foreground">
            No audit events found. Import data to populate.
          </div>
        ) : (
          audit.map((evt, i) => (
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
          ))
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Shell ──────────────────────────────────────────────────────────

export function DemoAdminDashboard({ className }: DemoAdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const [data, setData] = useState<DemoDashboardData>(defaultDemoDashboardData);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Keyboard navigation handler for the tablist
  function handleNavKeyDown(event: React.KeyboardEvent) {
    const tabs = NAV_ITEMS.map((item) => item.id);
    const currentIndex = tabs.indexOf(activeSection);
    if (event.key === "ArrowRight") {
      const nextIndex = (currentIndex + 1) % tabs.length;
      setActiveSection(tabs[nextIndex]);
    } else if (event.key === "ArrowLeft") {
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      setActiveSection(tabs[prevIndex]);
    }
  }

  const Icon = SECTION_ICON[activeSection];

  // Dynamic calculations for Overview section
  const activeAccountsCount = data.accounts.length;
  const messagesCount = data.mail.length;
  const pendingCount = data.mail.filter((m) => m.status === "pending").length;
  const totalBalance = data.accounts.reduce((sum, acc) => {
    const val = parseFloat(acc.balance.replace(/[^\d.]/g, ""));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const overviewStats: StatCard[] = [
    { label: "Active Accounts", value: activeAccountsCount.toString(), delta: "+2" },
    { label: "Messages Sent", value: messagesCount.toString(), delta: "+12%" },
    { label: "Pending Requests", value: pendingCount.toString(), delta: "-1" },
    {
      label: "Total Balance (XLM)",
      value: totalBalance.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      delta: "+45.2",
    },
  ];

  const handleExport = () => {
    try {
      const jsonStr = serializeDemoData(data);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "demo-dashboard-data.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMsg("Demo data exported successfully.");
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(`Failed to export data: ${err.message}`);
      setSuccessMsg(null);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== "string") {
          throw new Error("Failed to read file content as text");
        }
        const parsedData = validateAndNormalizeDemoData(text);
        setData(parsedData);
        setSuccessMsg("Demo data imported and normalized successfully.");
        setErrorMsg(null);
      } catch (err: any) {
        setErrorMsg(`Import failed: ${err.message}`);
        setSuccessMsg(null);
      } finally {
        // Reset file input value so same file can be selected again
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read file.");
      setSuccessMsg(null);
      event.target.value = "";
    };
    reader.readAsText(file);
  };

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

        <div className="flex items-center gap-2">
          {/* Hidden Import file input */}
          <input
            type="file"
            id="demo-data-import-input"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />

          <button
            onClick={() => document.getElementById("demo-data-import-input")?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/[0.06] hover:text-foreground transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            title="Import demo data from a JSON file"
            aria-label="Import demo data"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/[0.06] hover:text-foreground transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            title="Export current demo data as a JSON file"
            aria-label="Export demo data"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            onClick={() => setShowAccessibility((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/[0.06] hover:text-foreground transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            title="Toggle accessibility guide"
            aria-label="Accessibility guide"
            aria-expanded={showAccessibility}
          >
            <Shield className="h-3.5 w-3.5" />
            Accessibility
          </button>

          <span
            className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400"
            aria-live="polite"
          >
            Demo
          </span>
        </div>
      </div>

      {/* ── Navigation slots ── */}
      <nav
        className="flex gap-1 border-b border-white/[0.06] px-4 py-2"
        role="tablist"
        aria-label="Admin dashboard sections"
        onKeyDown={handleNavKeyDown}
      >
        {NAV_ITEMS.map((item) => {
          const NavIcon = SECTION_ICON[item.id];
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              id={`tab-${item.id}`}
              role="tab"
              aria-selected={isActive}
              aria-label={item.description}
              aria-controls={`panel-${item.id}`}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
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
      {showAccessibility && <AccessibilityInfo />}

      {/* ── Content region ── */}
      <div
        className="flex-1 overflow-y-auto p-6"
        role="tabpanel"
        id={`panel-${activeSection}`}
        aria-labelledby={`tab-${activeSection}`}
        aria-label={`${activeSection} section`}
      >
        <div className="mx-auto max-w-4xl">
          {/* Error and Success Alert Banners */}
          {errorMsg && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between"
            >
              <span>{errorMsg}</span>
              <button
                onClick={() => setErrorMsg(null)}
                className="text-red-400 hover:text-red-300 font-bold ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
          {successMsg && (
            <div
              role="status"
              aria-live="polite"
              className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400 flex items-center justify-between animate-fade-in"
            >
              <span>{successMsg}</span>
              <button
                onClick={() => setSuccessMsg(null)}
                className="text-emerald-400 hover:text-emerald-300 font-bold ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Section header */}
          <div className="mb-6 flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground capitalize">{activeSection}</h3>
          </div>

          {activeSection === "overview" && <OverviewContent stats={overviewStats} />}
          {activeSection === "accounts" && <AccountsContent accounts={data.accounts} />}
          {activeSection === "mail" && <MailContent mail={data.mail} />}
          {activeSection === "audit" && <AuditContent audit={data.audit} />}
        </div>
      </div>
    </div>
  );
}
