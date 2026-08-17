import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CampaignSnapshot } from "../types/campaignSnapshot";
import { AssignableMessage } from "../types/assignment";
import { messagePool, defaultAssignmentState } from "../fixtures/assignmentFixtures";
import { getAssignedMessages, assignMessage, unassignMessage } from "../utils/assignmentHelpers";
import { CAMPAIGN_STATUS_TOKENS, TAG_COLOR_TOKENS, getTagToken } from "../constants/displayTokens";
import { saveAssignments, loadAssignments } from "../persistence/localStorageAdapter";
import { AdminDataTable, type Column } from "./AdminDataTable";
import { MessagePicker } from "./MessagePicker";

interface CampaignMessageAssignmentPanelProps {
  className?: string;
}

export function CampaignMessageAssignmentPanel({ className }: CampaignMessageAssignmentPanelProps) {
  const [campaigns, setCampaigns] = useState<CampaignSnapshot[]>(() => {
    const saved = loadAssignments();
    return saved?.campaigns ?? defaultAssignmentState.campaigns;
  });
  const [pool] = useState<AssignableMessage[]>(messagePool);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) ?? null;

  useEffect(() => {
    saveAssignments({ campaigns, pool });
  }, [campaigns, pool]);

  function handleAssign(msg: AssignableMessage) {
    if (!selectedCampaign) return;
    const updated = assignMessage(selectedCampaign, msg);
    setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setPickerOpen(false);
  }

  function handleUnassign(messageId: string) {
    if (!selectedCampaign) return;
    const updated = unassignMessage(selectedCampaign, messageId);
    setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  // Campaign list columns
  const campaignColumns: Column<CampaignSnapshot>[] = [
    {
      key: "name",
      header: "Campaign",
      sortable: true,
      render: (c) => (
        <div>
          <p className="font-medium text-foreground">{c.name}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{c.targetAudience}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (c) => c.status ?? "draft",
      render: (c) => {
        const tk = CAMPAIGN_STATUS_TOKENS[c.status ?? "draft"];
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
              tk.bg,
              tk.text,
              tk.border,
            )}
          >
            {tk.label}
          </span>
        );
      },
    },
    {
      key: "drafts",
      header: "Messages",
      sortable: true,
      sortValue: (c) => c.drafts.length,
      render: (c) => <span className="tabular-nums text-muted-foreground">{c.drafts.length}</span>,
    },
    {
      key: "tags",
      header: "Tags",
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.tags.slice(0, 2).map((tag) => {
            const tk = TAG_COLOR_TOKENS[tag.toLowerCase()] ?? {
              bg: TAG_COLOR_TOKENS.default.bg,
              text: TAG_COLOR_TOKENS.default.text,
              border: TAG_COLOR_TOKENS.default.border,
              label: tag,
            };
            return (
              <span
                key={tag}
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
                  tk.bg,
                  tk.text,
                  tk.border,
                )}
              >
                {tk.label}
              </span>
            );
          })}
          {c.tags.length > 2 && (
            <span className="text-[9px] text-muted-foreground">+{c.tags.length - 2}</span>
          )}
        </div>
      ),
    },
  ];

  // Assigned message columns
  const assignedMessages = selectedCampaign ? getAssignedMessages(selectedCampaign, pool) : [];

  const messageColumns: Column<AssignableMessage>[] = [
    {
      key: "subject",
      header: "Subject",
      sortable: true,
      render: (msg) => (
        <div>
          <p className="font-medium text-foreground">{msg.subject}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{msg.preview}</p>
        </div>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      render: (msg) => (
        <div className="flex flex-wrap gap-1">
          {msg.tags.map((tag) => {
            const tk = getTagToken(tag);
            return (
              <span
                key={tag}
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
                  tk.bg,
                  tk.text,
                  tk.border,
                )}
              >
                {tk.label}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      key: "remove",
      header: "",
      render: (msg) => (
        <button
          type="button"
          aria-label={`Remove ${msg.subject}`}
          onClick={(e) => {
            e.stopPropagation();
            handleUnassign(msg.id);
          }}
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <section aria-label="Campaign message assignments" className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Campaign Message Assignments</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a campaign to view and manage its assigned messages.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Left: Campaign list (~40%) */}
        <div className="md:w-[40%] space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-1">
            Campaigns
          </p>
          <AdminDataTable
            data={campaigns}
            columns={campaignColumns}
            onRowClick={(c) => setSelectedCampaignId(selectedCampaignId === c.id ? null : c.id)}
            selectedRowKey={(c) => c.id === selectedCampaignId}
            defaultSortKey="name"
            emptyMessage="No campaigns found."
          />
        </div>

        {/* Right: Assigned messages (~60%) */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {selectedCampaign ? `Messages — ${selectedCampaign.name}` : "Messages"}
            </p>
            {selectedCampaign && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Add messages
              </button>
            )}
          </div>

          {!selectedCampaign ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.01] text-sm text-muted-foreground">
              Select a campaign to view its messages.
            </div>
          ) : (
            <AdminDataTable
              data={assignedMessages}
              columns={messageColumns}
              defaultSortKey="subject"
              emptyMessage="No messages assigned yet — click Add messages."
            />
          )}
        </div>
      </div>

      {pickerOpen && selectedCampaign && (
        <MessagePicker
          pool={pool}
          campaign={selectedCampaign}
          onAssign={handleAssign}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </section>
  );
}
