import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, FileText, Mail, ShieldCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { inboxSeedDataset } from "../fixtures/inboxSeedDataset";
import { getSeedDatasetPreview } from "../utils/seedDatasetPreview";
import type { DemoDataset } from "../types/dataset";
import {
  formatLocalInboxPreviewSubtitle,
  getLocalInboxPreviewReader,
  getLocalInboxPreviewRows,
} from "../utils/localInboxPreview";

export interface DemoInboxPreviewProps {
  dataset?: DemoDataset;
  selectedId?: string | null;
  onSelectMessage?: (id: string) => void;
  className?: string;
}

export function DemoInboxPreview({
  dataset = inboxSeedDataset,
  selectedId,
  onSelectMessage,
  className,
}: DemoInboxPreviewProps) {
  const rows = useMemo(() => getLocalInboxPreviewRows(dataset), [dataset]);
  const summary = useMemo(() => getSeedDatasetPreview(dataset), [dataset]);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const activeId = selectedId ?? localSelectedId;
  const reader = getLocalInboxPreviewReader(dataset, activeId);

  const selectMessage = (id: string) => {
    setLocalSelectedId(id);
    onSelectMessage?.(id);
  };

  return (
    <section
      className={cn(
        "grid gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]",
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">{summary.name}</h3>
            <p className="text-xs text-muted-foreground">{summary.totalMessages} local messages</p>
          </div>
          <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-xs text-muted-foreground">
            {summary.uniqueSenders} senders
          </span>
        </header>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Metric label="Unread" value={summary.stats.unread} />
          <Metric label="Proofs" value={summary.stats.withProof} />
          <Metric label="Files" value={summary.stats.withAttachments} />
          <Metric label="Events" value={summary.stats.withCalendarEvent} />
        </div>

        <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto pr-1">
          {rows.map((row) => {
            const selected = row.id === reader?.row.id;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => selectMessage(row.id)}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border px-3 py-3 text-left transition-colors",
                  selected
                    ? "border-sky-500/40 bg-sky-500/10"
                    : "border-white/[0.06] hover:bg-white/[0.04]",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{row.subject}</span>
                  {row.isStarred ? <Star className="h-4 w-4 shrink-0 text-amber-300" /> : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">{row.senderName}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{row.snippet}</span>
                <span className="flex flex-wrap gap-1">
                  {row.labels.slice(0, 3).map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[0.7rem] text-muted-foreground"
                    >
                      {label}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <article className="flex min-w-0 flex-col gap-4 rounded-xl border border-white/[0.06] bg-black/[0.08] p-4">
        {reader ? (
          <>
            <header className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-base font-semibold">{reader.row.subject}</h4>
                  <p className="text-sm text-muted-foreground">
                    {reader.row.senderName} &lt;{reader.row.senderAddress}&gt;
                  </p>
                </div>
                <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-xs text-muted-foreground">
                  {formatLocalInboxPreviewSubtitle(reader.row)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">To {reader.recipients.join(", ")}</p>
            </header>

            <p className="whitespace-pre-line text-sm leading-6 text-foreground">{reader.body}</p>

            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <ReaderFlag
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Proof"
                value={reader.proofStatus}
              />
              <ReaderFlag
                icon={<FileText className="h-4 w-4" />}
                label="Attachments"
                value={reader.attachmentNames.length.toString()}
              />
              <ReaderFlag
                icon={<CalendarDays className="h-4 w-4" />}
                label="Calendar"
                value={reader.calendarTitle ?? "none"}
              />
              <ReaderFlag
                icon={<Mail className="h-4 w-4" />}
                label="Thread"
                value={reader.row.threadId}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No local inbox messages available.</p>
        )}
      </article>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function ReaderFlag({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-muted-foreground">{label}</span>
        <span className="block truncate text-foreground">{value}</span>
      </span>
    </div>
  );
}
