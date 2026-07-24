import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  onAdvance: () => void;
  onRetreat: () => void;
};

const ACKNOWLEDGMENTS = [
  "I have backed up my wallet seed phrase in a safe location.",
  "I understand that losing my seed phrase means permanent loss of access to my mailbox.",
] as const;

/**
 * Step 2: Recovery Acknowledgment
 *
 * Forces the user to consciously confirm they have secured their recovery phrase
 * before continuing. Both checkboxes must be checked to unlock "Continue".
 */
export function RecoveryStep({ onAdvance, onRetreat }: Props) {
  const [checked, setChecked] = useState<boolean[]>([false, false]);

  const allChecked = checked.every(Boolean);

  function toggle(index: number) {
    setChecked((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Secure your recovery</h2>
        <p className="text-sm text-muted-foreground">
          Your wallet holds the only key to your Stealth mailbox. Anyone who obtains your seed
          phrase can impersonate you.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p className="text-xs text-amber-200">
          Stealth has no account recovery system. If you lose your seed phrase, your mailbox address
          and all associated mail history become permanently inaccessible.
        </p>
      </div>

      <div className="space-y-3">
        {ACKNOWLEDGMENTS.map((label, index) => (
          <button
            key={index}
            type="button"
            aria-pressed={checked[index]}
            onClick={() => toggle(index)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
              "active:scale-[0.99]",
              checked[index]
                ? "border-emerald-400/30 bg-emerald-400/[0.06] ring-1 ring-emerald-400/30"
                : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                checked[index]
                  ? "border-emerald-400/40 bg-emerald-400/20"
                  : "border-white/20 bg-white/[0.04]",
              )}
            >
              {checked[index] && (
                <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-emerald-300">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              )}
            </span>
            <span className="text-sm text-foreground">{label}</span>
          </button>
        ))}
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
          disabled={!allChecked}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.99]",
            allChecked
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
