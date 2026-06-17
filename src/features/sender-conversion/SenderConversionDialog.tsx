import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, FolderInput, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFolderLabel } from "@/components/mail/data";
import { SenderBadge } from "./SenderBadge";
import {
  SENDER_POLICY_OPTIONS,
  getSenderPolicyOption,
  resolveSenderConversion,
  type SenderConversionTarget,
  type SenderPolicyChoice,
} from "./types";

type Phase = "choose" | "done";

type Props = {
  /** Non-null while the flow is open. */
  target: SenderConversionTarget | null;
  /** Apply the chosen policy. Returns nothing; the route owns the mutation. */
  onConfirm: (target: SenderConversionTarget, choice: SenderPolicyChoice) => void;
  /** Close without changing any policy. */
  onClose: () => void;
};

/**
 * Guided per-sender conversion flow.
 *
 * Phase 1 ("choose"): explains how Allow / Verify / Block differ and requires
 * an explicit selection — nothing is pre-selected, so the dialog can never
 * auto-allow a sender. Cancel (button, backdrop, or Esc) closes with no change.
 *
 * Phase 2 ("done"): confirms the new sender badge and folder placement. The
 * underlying mutation already ran on confirm, so every other open surface is
 * already in sync by the time this is shown.
 */
export function SenderConversionDialog({ target, onConfirm, onClose }: Props) {
  const [choice, setChoice] = useState<SenderPolicyChoice | null>(null);
  const [phase, setPhase] = useState<Phase>("choose");

  // Reset whenever a different sender (or a fresh open) drives the dialog so a
  // previous selection never leaks into the next conversion.
  useEffect(() => {
    if (target) {
      setChoice(null);
      setPhase("choose");
    }
  }, [target?.emailId, target]);

  // Esc cancels — same no-op semantics as the Cancel button.
  useEffect(() => {
    if (!target) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [target, onClose]);

  const handleConfirm = () => {
    if (!target || !choice) return;
    onConfirm(target, choice);
    setPhase("done");
  };

  const result = target && choice ? resolveSenderConversion({ from: target.sender }, choice) : null;

  return (
    <AnimatePresence>
      {target && (
        <>
          <motion.div
            key="sender-conversion-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            key="sender-conversion-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Convert sender"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-strong fixed left-1/2 top-1/2 z-50 w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 px-6 pt-5">
              <div className="min-w-0 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {phase === "choose" ? "Convert sender" : "Sender updated"}
                </p>
                <h2 className="truncate text-base font-semibold text-foreground">
                  {target.sender}
                </h2>
                <p className="truncate text-xs text-muted-foreground">{target.address}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Cancel"
                className="glow-ring shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {phase === "choose" ? (
                <motion.div
                  key="choose"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                  className="px-6 pb-6 pt-4"
                >
                  <p className="mb-3 text-xs leading-5 text-muted-foreground">
                    This sender isn't in your trusted list yet. Choose how their mail should be
                    handled from now on — you can change this later.
                  </p>

                  <div className="grid gap-2">
                    {SENDER_POLICY_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const selected = choice === option.value;
                      const current = target.currentPolicy === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setChoice(option.value)}
                          aria-pressed={selected}
                          className={cn(
                            "relative rounded-xl border p-3 text-left transition",
                            selected
                              ? "border-emerald-400/30 bg-emerald-400/[0.07]"
                              : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={cn(
                                "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border",
                                selected
                                  ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                                  : "border-white/10 bg-white/[0.04] text-muted-foreground",
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  {option.label}
                                </span>
                                {current && (
                                  <span className="rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-xs leading-5 text-foreground/70">
                                {option.summary}
                              </p>
                              <p className="text-[11px] leading-4 text-muted-foreground">
                                {option.effect}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={!choice}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                        choice
                          ? "bg-foreground text-background hover:opacity-90"
                          : "cursor-not-allowed bg-white/[0.06] text-muted-foreground",
                      )}
                    >
                      {choice ? getSenderPolicyOption(choice).label : "Choose an action"}
                      {choice && <ArrowRight className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                  className="px-6 pb-6 pt-4"
                >
                  <div className="mb-4 flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
                      <Check className="h-4 w-4" />
                    </span>
                    <p className="text-sm text-foreground/90">
                      {result?.toast.message ?? "Sender updated"}.
                    </p>
                  </div>

                  <dl className="space-y-2 rounded-xl border border-white/10 bg-black/15 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Sender badge
                      </dt>
                      <dd>
                        <SenderBadge policy={choice ?? undefined} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2">
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Filed under
                      </dt>
                      <dd className="flex items-center gap-1.5 text-xs text-foreground">
                        <FolderInput className="h-3.5 w-3.5 text-muted-foreground" />
                        {result ? getFolderLabel(result.folder) : ""}
                      </dd>
                    </div>
                  </dl>

                  <button
                    onClick={onClose}
                    className="mt-5 w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
