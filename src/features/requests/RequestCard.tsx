import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BadgeCheck, Check, Eye, RefreshCw, RotateCcw, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Email } from "@/components/mail/data";
import { motionPresets } from "@/lib/motion-presets";
import type { CardStatus, TriageAction } from "./types";

interface RequestCardProps {
  email: Email;
  status: CardStatus;
  simulateFailure: boolean;
  onTriggerAction: (emailId: string, action: TriageAction) => void;
  onUndoAction: (emailId: string) => void;
  onFinalizeAction: (emailId: string, action: TriageAction) => void;
  onInspect: (email: Email) => void;
}

export function RequestCard({
  email,
  status,
  simulateFailure,
  onTriggerAction,
  onUndoAction,
  onFinalizeAction,
  onInspect,
}: Readonly<RequestCardProps>) {
  const [timeLeft, setTimeLeft] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const duration = 3000; // 3 seconds undo window

  const getActionFromStatus = (status: CardStatus): TriageAction | null => {
    if (status.includes("approve")) return "approve";
    if (status.includes("block")) return "block";
    if (status.includes("refund")) return "refund";
    return null;
  };

  const currentAction = getActionFromStatus(status);

  // Timer effect for the success undo countdown
  useEffect(() => {
    const isSuccessState = status.startsWith("success-");

    if (isSuccessState && currentAction) {
      setTimeLeft(100);
      startTimeRef.current = Date.now();

      const updateProgress = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const remainingPercentage = Math.max(0, 100 - (elapsed / duration) * 100);

        setTimeLeft(remainingPercentage);

        if (elapsed < duration) {
          timerRef.current = setTimeout(updateProgress, 30);
        } else {
          // Finalize the action
          onFinalizeAction(email.id, currentAction);
        }
      };

      timerRef.current = setTimeout(updateProgress, 30);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [status, email.id, currentAction]);

  // Handle formatting for native Stellar postage amounts (1 XLM = 10,000,000 Stroops)
  const formatPostage = (stroops?: string) => {
    if (!stroops) return "0.0 XLM";
    try {
      const val = BigInt(stroops);
      const xlm = Number(val) / 10_000_000;
      return `${xlm.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 4,
      })} XLM`;
    } catch {
      return `${stroops} stroops`;
    }
  };

  return (
    <motion.div
      {...motionPresets.entrance.slideUp()}
      exit={motionPresets.remove.collapse()}
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-4 transition-all duration-300",
        "focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/15",
        status.startsWith("success-") && "border-emerald-500/20 bg-emerald-500/2",
        status === "failure" && "border-rose-500/20 bg-rose-500/2",
        status.startsWith("pending-") && "border-white/5 opacity-80",
      )}
    >
      <AnimatePresence mode="wait">
        {/* IDLE / NORMAL STATE */}
        {status === "idle" && (
          <motion.div
            key="idle-view"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              {/* Sender Metadata info */}
              <div className="flex items-start gap-3">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                  <img
                    src={`https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email.from)}&backgroundColor=1a1a1d`}
                    alt={email.from}
                    className="h-full w-full object-cover"
                  />
                  {email.unread && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[oklch(0.9_0.005_270)] ring-2 ring-[oklch(0.18_0.005_270)]" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground/90">
                      {email.from}
                    </h3>
                    {email.verifiedSender ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                        <BadgeCheck className="h-3 w-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
                        <ShieldAlert className="h-3 w-3" />
                        Unknown
                      </span>
                    )}
                  </div>
                  <p className="truncate font-mono text-[10px] text-muted-foreground/80 mt-0.5">
                    {email.email}
                  </p>
                </div>
              </div>

              {/* Postage Amount info */}
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Postage Paid
                </p>
                <p className="text-xs font-semibold tabular-nums text-foreground mt-0.5">
                  {formatPostage(email.postageAmount)}
                </p>
              </div>
            </div>

            {/* Message Preview */}
            <div className="rounded-lg bg-black/15 p-2.5 text-xs border border-white/4 transition hover:bg-black/25">
              <div className="font-semibold text-foreground/80 truncate">{email.subject}</div>
              <p className="text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {email.preview}
              </p>
            </div>

            {/* Action CTAs */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-3 mt-1">
              <button
                onClick={() => onInspect(email)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                <Eye className="h-3.5 w-3.5" />
                Inspect Context
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onTriggerAction(email.id, "block")}
                  className="rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  Block
                </button>
                <button
                  onClick={() => onTriggerAction(email.id, "refund")}
                  className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/10 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  Refund
                </button>
                <button
                  onClick={() => onTriggerAction(email.id, "approve")}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  Approve
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* PENDING ACTIONS (SPINNER) */}
        {status.startsWith("pending-") && (
          <motion.div
            key="pending-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-[140px] flex-col items-center justify-center gap-2.5"
          >
            <RefreshCw className="h-5 w-5 motion-safe:animate-spin text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">
              {status === "pending-approve" && "Approving sender and settling postage..."}
              {status === "pending-block" && "Blocking sender and registering rule..."}
              {status === "pending-refund" && "Refunding postage amount..."}
            </p>
          </motion.div>
        )}

        {/* SUCCESS STATE WITH UNDO COUNTDOWN */}
        {status.startsWith("success-") && (
          <motion.div
            key="success-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex h-[140px] flex-col justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                <Check className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-foreground/90">
                  {status === "success-approve" && "Sender Approved"}
                  {status === "success-block" && "Sender Blocked"}
                  {status === "success-refund" && "Postage Refunded"}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {status === "success-approve" && `Messages from ${email.from} will go to Inbox.`}
                  {status === "success-block" && `${email.from} blocked. Mail moved to Spam.`}
                  {status === "success-refund" && `Postage returned to ${email.from}.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-white/6 pt-3 pb-1">
              <span className="text-[10px] text-muted-foreground italic">
                Finalizing in {Math.ceil((timeLeft / 100) * 3)}s...
              </span>
              <button
                onClick={() => onUndoAction(email.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                <RotateCcw className="h-3 w-3" />
                Undo
              </button>
            </div>

            {/* Shrinking progress bar */}
            <div className="absolute -bottom-4 -left-4 -right-4 h-1 bg-white/4">
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: `${timeLeft}%` }}
                transition={{ duration: 0.03, ease: "linear" }}
                className="h-full bg-emerald-500/40"
              />
            </div>
          </motion.div>
        )}

        {/* FAILURE STATE */}
        {status === "failure" && (
          <motion.div
            key="failure-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-[140px] flex-col justify-between"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25 shrink-0">
                <X className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-foreground/90">Action Failed</h4>
                <p className="text-[11px] text-rose-400/90 mt-0.5 leading-normal">
                  Could not resolve the transaction on the Stellar network. Please try again.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/6 pt-3">
              <button
                onClick={() => onUndoAction(email.id)}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Re-run previous trigger
                  if (currentAction) {
                    onTriggerAction(email.id, currentAction);
                  } else {
                    onUndoAction(email.id);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          </motion.div>
        )}

        {/* UNDOING STATE */}
        {status === "undoing" && (
          <motion.div
            key="undoing-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-[140px] flex-col items-center justify-center gap-2.5"
          >
            <RefreshCw className="h-5 w-5 motion-safe:animate-spin text-amber-400" />
            <p className="text-xs font-medium text-amber-400">Reverting policy changes...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
