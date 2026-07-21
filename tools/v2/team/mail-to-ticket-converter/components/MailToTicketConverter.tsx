import { useState } from "react";
import type { IMailToTicketService } from "../types";
import { useMailToTicket } from "../hooks/useMailToTicket";
import { EmailList } from "./EmailList";
import { TicketList } from "./TicketList";
import { MetricsPanel } from "./MetricsPanel";

type Tab = "emails" | "tickets" | "metrics";

interface MailToTicketConverterProps {
  service?: IMailToTicketService;
}

export function MailToTicketConverter({ service }: MailToTicketConverterProps) {
  const { emails, tickets, teamMembers, metrics, load, convertEmail, updateStatus, assignTicket } =
    useMailToTicket(service);

  const [activeTab, setActiveTab] = useState<Tab>("emails");

  const tabs: { key: Tab; label: string }[] = [
    { key: "emails", label: "Inbox" },
    { key: "tickets", label: "Tickets" },
    { key: "metrics", label: "Metrics" },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[--text-primary]">Mail-to-Ticket Converter</h1>
      </div>

      <nav
        className="flex gap-1 border-b border-[--border-subtle]"
        role="tablist"
        aria-label="Tool sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`panel-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors
              ${
                activeTab === tab.key
                  ? "bg-[--surface-primary] text-[--accent] border border-b-0 border-[--border-subtle]"
                  : "text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--surface-secondary]"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div
        id="panel-emails"
        role="tabpanel"
        aria-labelledby="tab-emails"
        hidden={activeTab !== "emails"}
      >
        {activeTab === "emails" && (
          <EmailList
            emails={emails}
            teamMembers={teamMembers}
            onConvert={convertEmail}
            onRetry={load}
          />
        )}
      </div>

      <div
        id="panel-tickets"
        role="tabpanel"
        aria-labelledby="tab-tickets"
        hidden={activeTab !== "tickets"}
      >
        {activeTab === "tickets" && (
          <TicketList
            tickets={tickets}
            teamMembers={teamMembers}
            onUpdateStatus={updateStatus}
            onAssign={assignTicket}
            onRetry={load}
          />
        )}
      </div>

      <div
        id="panel-metrics"
        role="tabpanel"
        aria-labelledby="tab-metrics"
        hidden={activeTab !== "metrics"}
      >
        {activeTab === "metrics" && <MetricsPanel metrics={metrics} onRetry={load} />}
      </div>
    </div>
  );
}
