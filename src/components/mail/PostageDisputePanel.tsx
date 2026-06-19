import {
  AlertTriangle,
  ChevronDown,
  Clock,
  FileSearch,
  Flag,
  Gavel,
  History,
  Info,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * PostageDisputePanel — placeholder UI for the future postage dispute and appeal flow.
 *
 * All actions are disabled. Copy explains that production dispute logic depends on
 * contract escrow/dispute states that are not yet implemented.
 *
 * Design intent: this panel can be wired to live contract states (Disputed, Refunded,
 * Reclaimed, etc.) once the escrow and dispute roadmap items ship, without redesigning
 * the layout.
 *
 * PostageStatus values from the Soroban contract:
 *   Pending | Expired | Disputed | Settled | Refunded | Reclaimed
 */
export type PostageDisputeStatus =
  | "pending"
  | "expired"
  | "disputed"
  | "settled"
  | "refunded"
  | "reclaimed";

interface PostageDisputePanelProps {
  postageStatus: PostageDisputeStatus;
  /** XLM amount string, e.g. "1.0" */
  amountXlm?: string;
}

const ROADMAP_NOTICE =
  "Dispute and appeal logic requires on-chain escrow contract support. " +
  "These controls are shown as a design placeholder and cannot submit " +
  "real actions until the escrow dispute roadmap ships.";

const RESOLUTION_HISTORY: { label: string; ts: string; note: string }[] = [
  { label: "Postage submitted", ts: "—", note: "Contract state recorded" },
  { label: "Dispute window opens", ts: "—", note: "Pending contract activation" },
  { label: "Appeal deadline", ts: "—", note: "Pending contract activation" },
  { label: "Final resolution", ts: "—", note: "Pending contract activation" },
];

function DisabledAction({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.01] p-2.5 opacity-50 cursor-not-allowed select-none"
      aria-disabled="true"
      title="Not available — contract support required"
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground/80">{label}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function PostageDisputePanel({ postageStatus, amountXlm }: PostageDisputePanelProps) {
  const [open, setOpen] = useState(false);

  const isDisputable = postageStatus === "expired" || postageStatus === "pending";

  return (
    <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.03]">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Flag className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-amber-400/80">
            Dispute &amp; Appeal
          </span>
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400/90">
            Roadmap
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-amber-500/[0.12] px-3 pb-3 pt-2.5">
              {/* Roadmap notice */}
              <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/70" />
                <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                  {ROADMAP_NOTICE}
                </p>
              </div>

              {/* Current postage state pill */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Current state:</span>
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                    postageStatus === "settled" &&
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                    postageStatus === "disputed" &&
                      "border-amber-500/30 bg-amber-500/10 text-amber-400",
                    postageStatus === "refunded" && "border-red-500/30 bg-red-500/10 text-red-400",
                    postageStatus === "expired" &&
                      "border-orange-500/30 bg-orange-500/10 text-orange-400",
                    (postageStatus === "pending" || postageStatus === "reclaimed") &&
                      "border-white/10 bg-white/[0.04] text-muted-foreground",
                  )}
                >
                  {postageStatus}
                </span>
                {amountXlm && (
                  <span className="ml-auto text-[10px] font-semibold text-foreground/70">
                    {amountXlm} XLM
                  </span>
                )}
              </div>

              {/* Disabled actions */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                  Available actions
                </p>
                <DisabledAction
                  icon={AlertTriangle}
                  label="Open Dispute"
                  description={
                    isDisputable
                      ? "Challenge this postage settlement once the dispute contract window is active."
                      : "Disputes can only be opened on expired or pending postage."
                  }
                />
                <DisabledAction
                  icon={Gavel}
                  label="File Appeal"
                  description="Appeal a resolved dispute decision. Requires a settled dispute record on-chain."
                />
                <DisabledAction
                  icon={FileSearch}
                  label="Submit Evidence"
                  description="Attach a relay diagnostic bundle or message hash to a dispute. Not yet supported."
                />
              </div>

              {/* Resolution history placeholder */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <History className="h-3 w-3 text-muted-foreground/60" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                    Resolution history
                  </p>
                </div>
                <div className="space-y-1.5 opacity-50">
                  {RESOLUTION_HISTORY.map((entry) => (
                    <div
                      key={entry.label}
                      className="flex items-center justify-between gap-2 rounded border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="text-[10px] text-foreground/70">{entry.label}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground/70">{entry.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
