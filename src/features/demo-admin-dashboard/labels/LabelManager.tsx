import { useMemo, useState } from "react";
import { Plus, Tag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { addLabel, countLabelUsage, removeLabel, unusedLabels } from "./labelNormalization";
import { demoLabels, labeledDemoMessages } from "./labelFixtures";
import type { DemoLabel, LabeledDemoMessage } from "./types";

const LABEL_COLORS: Record<string, string> = {
  amber: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  emerald: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  sky: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  violet: "bg-violet-400/10 text-violet-300 ring-violet-400/30",
  rose: "bg-rose-400/10 text-rose-300 ring-rose-400/30",
};

const FALLBACK_LABEL_COLOR = "bg-white/[0.06] text-foreground/80 ring-white/15";

function labelClasses(color?: string): string {
  const mapped = color ? LABEL_COLORS[color] : undefined;
  return mapped ?? FALLBACK_LABEL_COLOR;
}

interface LabelManagerProps {
  /** Override the labels; defaults to the bundled demo labels. */
  labels?: DemoLabel[];
  /** Override the messages; defaults to the bundled labeled demo messages. */
  messages?: LabeledDemoMessage[];
  /** Notified after any label or message change. */
  onChange?: (labels: DemoLabel[], messages: LabeledDemoMessage[]) => void;
  className?: string;
}

/**
 * Admin control for managing the labels applied to demo messages. Create new
 * labels, apply or remove them per message, review usage counts, and clean up
 * labels that no message uses.
 */
export function LabelManager({
  labels: initialLabels = demoLabels,
  messages: initialMessages = labeledDemoMessages,
  onChange,
  className,
}: LabelManagerProps) {
  const [labels, setLabels] = useState<DemoLabel[]>(initialLabels);
  const [messages, setMessages] = useState<LabeledDemoMessage[]>(initialMessages);
  const [selectedId, setSelectedId] = useState<string | null>(initialMessages[0]?.id ?? null);
  const [newLabelName, setNewLabelName] = useState("");

  const usage = useMemo(() => countLabelUsage(labels, messages), [labels, messages]);
  const unused = useMemo(() => unusedLabels(labels, messages), [labels, messages]);

  const addNewLabel = () => {
    const next = addLabel(labels, newLabelName);
    if (next === labels) return;
    setLabels(next);
    setNewLabelName("");
    onChange?.(next, messages);
  };

  const deleteLabel = (id: string) => {
    const result = removeLabel(labels, messages, id);
    setLabels(result.labels);
    setMessages(result.messages);
    onChange?.(result.labels, result.messages);
  };

  const toggleLabel = (messageId: string, labelId: string) => {
    const next = messages.map((message) => {
      if (message.id !== messageId) return message;
      const has = message.labelIds.includes(labelId);
      return {
        ...message,
        labelIds: has
          ? message.labelIds.filter((id) => id !== labelId)
          : [...message.labelIds, labelId],
      };
    });
    setMessages(next);
    onChange?.(labels, next);
  };

  return (
    <div className={cn("flex flex-col gap-5 text-sm text-foreground", className)}>
      <p className="text-xs text-foreground/60">
        Create, apply, and clean up labels across demo messages. All data is synthetic.
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="new-label" className="text-xs font-medium text-foreground/70">
          New label
        </label>
        <div className="flex gap-2">
          <input
            id="new-label"
            value={newLabelName}
            onChange={(event) => setNewLabelName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addNewLabel();
            }}
            placeholder="e.g. Follow up"
            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-white/25"
          />
          <button
            type="button"
            onClick={addNewLabel}
            disabled={!newLabelName.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-2 text-sm text-foreground transition hover:bg-emerald-400/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Labels</h3>
        <ul className="flex flex-col gap-1.5">
          {usage.map(({ label, count }) => (
            <li
              key={label.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn("rounded-md px-2 py-0.5 text-xs ring-1", labelClasses(label.color))}
                >
                  {label.name}
                </span>
                <span className="text-xs text-foreground/50">
                  {count === 0 ? "Unused" : `${count} message${count === 1 ? "" : "s"}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => deleteLabel(label.id)}
                aria-label={`Delete ${label.name}`}
                className="rounded-md p-1 text-foreground/40 transition hover:bg-white/[0.06] hover:text-rose-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {unused.length > 0 && (
          <p className="text-xs text-foreground/50">
            {unused.length} unused label{unused.length === 1 ? "" : "s"} ready to clean up.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
          Messages
        </h3>
        <div className="flex flex-col gap-1.5">
          {messages.map((message) => {
            const active = message.id === selectedId;
            return (
              <div
                key={message.id}
                className={cn(
                  "rounded-lg border px-3 py-2 transition",
                  active
                    ? "border-white/15 bg-white/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02]",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(message.id)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <Tag className="h-4 w-4 shrink-0 text-foreground/40" />
                  <span className="flex-1 truncate text-sm text-foreground">{message.subject}</span>
                  <span className="text-xs text-foreground/40">{message.labelIds.length}</span>
                </button>
                {active && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {labels.map((label) => {
                      const checked = message.labelIds.includes(label.id);
                      return (
                        <button
                          key={label.id}
                          type="button"
                          onClick={() => toggleLabel(message.id, label.id)}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs ring-1 transition",
                            checked
                              ? labelClasses(label.color)
                              : "bg-transparent text-foreground/50 ring-white/10 hover:bg-white/[0.04]",
                          )}
                        >
                          {label.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
