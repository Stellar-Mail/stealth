import { Info } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { OnboardingDraft } from "../types";

type Props = {
  draft: OnboardingDraft;
  onUpdate: (patch: Partial<OnboardingDraft>) => void;
  onAdvance: () => void;
  onRetreat: () => void;
};

const PRESETS: Array<{ label: string; value: string; hint: string }> = [
  { label: "Free", value: "0", hint: "Anyone can reach you at no cost" },
  { label: "0.001 XLM", value: "0.001", hint: "Light friction for mass senders" },
  { label: "0.01 XLM", value: "0.01", hint: "Meaningful cost per message" },
];

const XLM_PATTERN = /^\d*\.?\d{0,7}$/;

/**
 * Step 5: Minimum postage
 *
 * XLM amount is stored as a decimal string in the draft and converted to
 * stroops only when the policy is submitted to the API.
 */
export function MinimumPostageStep({ draft, onUpdate, onAdvance, onRetreat }: Props) {
  const [custom, setCustom] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  function handlePreset(value: string) {
    setCustom(false);
    setInputError(null);
    onUpdate({ minimumPostage: value });
  }

  function handleCustomChange(raw: string) {
    if (!XLM_PATTERN.test(raw)) return;
    const num = parseFloat(raw);
    if (raw !== "" && (isNaN(num) || num < 0)) {
      setInputError("Enter a non-negative number.");
    } else {
      setInputError(null);
    }
    onUpdate({ minimumPostage: raw });
  }

  const canAdvance = !inputError && draft.minimumPostage !== "";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Set minimum postage</h2>
        <p className="text-sm text-muted-foreground">
          Require senders to attach XLM to prove their message is worth your attention. Postage is
          refundable when you approve a sender.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset) => {
          const isSelected = !custom && draft.minimumPostage === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handlePreset(preset.value)}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
                "active:scale-[0.99]",
                isSelected
                  ? "border-emerald-400/30 bg-emerald-400/[0.06] ring-1 ring-emerald-400/30"
                  : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
              )}
            >
              <span className="block text-sm font-medium text-foreground">{preset.label}</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">{preset.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setCustom(true)}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Enter custom amount
        </button>
        {custom && (
          <div className="space-y-1">
            <div
              className={cn(
                "flex items-center rounded-xl border bg-white/[0.04] px-3 transition",
                inputError ? "border-red-400/40" : "border-white/10 focus-within:border-white/20",
              )}
            >
              <input
                autoFocus
                value={draft.minimumPostage}
                onChange={(e) => handleCustomChange(e.target.value)}
                inputMode="decimal"
                placeholder="0.0001"
                className="w-full bg-transparent py-2.5 text-sm text-foreground outline-none"
              />
              <span className="shrink-0 text-xs text-muted-foreground">XLM</span>
            </div>
            {inputError && <p className="text-xs text-red-400">{inputError}</p>}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          You can change the minimum at any time from Settings. The policy update takes effect
          immediately for new messages.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetreat}
          className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onAdvance}
          disabled={!canAdvance}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.99]",
            canAdvance
              ? "bg-foreground text-background hover:opacity-90"
              : "cursor-not-allowed bg-white/10 text-muted-foreground",
          )}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
