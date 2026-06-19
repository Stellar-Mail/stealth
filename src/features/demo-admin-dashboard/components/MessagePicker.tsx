import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssignableMessage } from "../types/assignment";
import { CampaignSnapshot } from "../types/campaignSnapshot";
import { isMessageAssigned } from "../utils/assignmentHelpers";
import { getTagToken } from "../constants/displayTokens";
import { AdminSearchBar } from "../AdminSearchBar";

interface MessagePickerProps {
  pool: AssignableMessage[];
  campaign: CampaignSnapshot;
  onAssign: (msg: AssignableMessage) => void;
  onClose: () => void;
}

export function MessagePicker({ pool, campaign, onAssign, onClose }: MessagePickerProps) {
  const [query, setQuery] = useState("");

  const filtered = pool.filter((msg) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      msg.subject.toLowerCase().includes(q) ||
      msg.tags.some((t) => t.toLowerCase().includes(q)) ||
      msg.folderHint.toLowerCase().includes(q)
    );
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick messages to assign"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-white/[0.10] bg-black/90 shadow-2xl backdrop-blur-xl overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Add messages</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Assigning to <span className="text-foreground">{campaign.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close message picker"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-white/[0.06] px-5 py-3">
          <AdminSearchBar
            value={query}
            onChange={setQuery}
            resultCount={filtered.length}
            totalCount={pool.length}
            placeholder="Search by subject or tag…"
          />
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
          {filtered.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No messages available.
            </p>
          ) : (
            filtered.map((msg) => {
              const assigned = isMessageAssigned(campaign, msg.id);
              return (
                <button
                  key={msg.id}
                  type="button"
                  disabled={assigned}
                  onClick={() => !assigned && onAssign(msg)}
                  className={cn(
                    "w-full px-5 py-3 text-left transition",
                    assigned ? "cursor-default opacity-50" : "hover:bg-white/[0.03] cursor-pointer",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{msg.subject}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {msg.preview}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {msg.tags.map((tag) => {
                          const tk = getTagToken(tag);
                          return (
                            <span
                              key={tag}
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
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
                    </div>
                    {assigned ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        Assigned
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {msg.folderHint}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
