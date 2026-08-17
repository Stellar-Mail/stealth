import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Check, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getDemoNow } from "./referenceNow";
import { SNOOZE_PRESETS } from "./snoozePresets";
import {
  formatRemindAt,
  metadataFromCustom,
  metadataFromPreset,
  validateCustomSnooze,
} from "./snoozeValidation";
import { snoozedDemoMessages } from "./snoozeFixtures";
import type { SnoozeChoice, SnoozedDemoMessage } from "./types";

interface SnoozeMetadataEditorProps {
  /** Override the message source; defaults to the bundled snoozed demo messages. */
  messages?: SnoozedDemoMessage[];
  /** Notified when a message's snooze metadata is applied. */
  onChange?: (messageId: string, message: SnoozedDemoMessage) => void;
  className?: string;
}

const now = getDemoNow();

/**
 * Admin control for editing the reminder metadata on demo messages in the
 * snoozed folder. Pick a preset or a custom date/time, preview when the message
 * returns, and apply the change to the local dataset.
 */
export function SnoozeMetadataEditor({
  messages = snoozedDemoMessages,
  onChange,
  className,
}: SnoozeMetadataEditorProps) {
  const [dataset, setDataset] = useState<SnoozedDemoMessage[]>(messages);
  const [selectedId, setSelectedId] = useState<string | null>(messages[0]?.id ?? null);
  const [choice, setChoice] = useState<SnoozeChoice | null>(messages[0]?.snooze.choice ?? null);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");

  const selected = dataset.find((message) => message.id === selectedId) ?? null;

  const selectMessage = (message: SnoozedDemoMessage) => {
    setSelectedId(message.id);
    setChoice(message.snooze.choice);
    if (message.snooze.choice === "custom") {
      const remindAt = new Date(message.snooze.remindAt);
      setCustomDate(format(remindAt, "yyyy-MM-dd"));
      setCustomTime(format(remindAt, "HH:mm"));
    } else {
      setCustomDate("");
      setCustomTime("");
    }
  };

  // Resolve the pending edit into a remindAt + validity for the live preview.
  const pending = useMemo(() => {
    if (choice === "custom") {
      const validation = validateCustomSnooze(customDate, customTime, now);
      return validation.ok
        ? { remindAt: validation.remindAt, error: null as string | null }
        : { remindAt: null as Date | null, error: validation.error };
    }
    if (choice) {
      const preset = SNOOZE_PRESETS.find((item) => item.id === choice);
      if (preset) return { remindAt: preset.resolve(now), error: null as string | null };
    }
    return { remindAt: null as Date | null, error: null as string | null };
  }, [choice, customDate, customTime]);

  const apply = () => {
    if (!selected || !choice || !pending.remindAt) return;
    const metadata =
      choice === "custom"
        ? metadataFromCustom(pending.remindAt, now)
        : metadataFromPreset(choice, now);
    const updated: SnoozedDemoMessage = { ...selected, snooze: metadata };
    setDataset((current) =>
      current.map((message) => (message.id === selected.id ? updated : message)),
    );
    onChange?.(updated.id, updated);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-muted-foreground">
        Edit the reminder metadata for demo messages in the snoozed folder. All data is synthetic.
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* ── Snoozed messages ── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <p className="border-b border-white/[0.06] px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Snoozed messages
          </p>
          <ul
            className="max-h-80 overflow-y-auto p-1.5"
            role="listbox"
            aria-label="Snoozed messages"
          >
            {dataset.map((message) => {
              const active = selected?.id === message.id;
              return (
                <li key={message.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => selectMessage(message)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                      active ? "bg-white/[0.07] ring-1 ring-white/10" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {message.subject}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatRemindAt(new Date(message.snooze.remindAt), now)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Editor ── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          {selected ? (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">{selected.subject}</h4>
                <p className="text-xs text-muted-foreground">
                  {selected.from} · {selected.email}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SNOOZE_PRESETS.map((preset) => {
                  const isActive = choice === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setChoice(preset.id)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-left text-xs transition",
                        isActive
                          ? "border-emerald-400/30 bg-emerald-400/[0.08] text-foreground"
                          : "border-white/[0.08] bg-white/[0.02] text-foreground/80 hover:bg-white/[0.05]",
                      )}
                    >
                      <span className="block font-medium">{preset.label}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {format(preset.resolve(now), "EEE h:mm a")}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                aria-pressed={choice === "custom"}
                onClick={() => setChoice("custom")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                  choice === "custom"
                    ? "border-emerald-400/30 bg-emerald-400/[0.08]"
                    : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
                )}
              >
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">Custom date &amp; time</span>
              </button>

              {choice === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Date
                    </span>
                    <input
                      type="date"
                      value={customDate}
                      min={format(now, "yyyy-MM-dd")}
                      onChange={(event) => setCustomDate(event.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-white/25 [color-scheme:dark]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Time
                    </span>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(event) => setCustomTime(event.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-white/25 [color-scheme:dark]"
                    />
                  </label>
                </div>
              )}

              {/* Live preview / validation */}
              <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3 text-xs">
                {pending.error ? (
                  <p className="flex items-center gap-2 text-red-200">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {pending.error}
                  </p>
                ) : pending.remindAt ? (
                  <p className="flex items-center gap-2 text-foreground">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    {formatRemindAt(pending.remindAt, now)}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Choose when this message should return.</p>
                )}
              </div>

              <button
                type="button"
                onClick={apply}
                disabled={!pending.remindAt}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-xs font-semibold transition",
                  pending.remindAt
                    ? "bg-foreground text-background hover:opacity-90"
                    : "cursor-not-allowed bg-white/[0.04] text-muted-foreground",
                )}
              >
                Apply reminder
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a message to edit its reminder.</p>
          )}
        </div>
      </div>
    </div>
  );
}
