import {
  AlertTriangle,
  ChevronDown,
  Clock,
  FileSearch,
  Flag,
  Gavel,
  History,
  Info,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { useId, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePostageStatus } from "@/features/ledger/usePostageStatus";
import { usePostageActions } from "@/features/ledger/usePostageActions";
import {
  permittedActions,
  formatPostageTimeline,
  describeStatus,
  explorerTxLink,
} from "@/features/ledger/postage-utils";
import { xlmFromStroops } from "@/features/compose/RecipientPolicyBanner";
import type { PostageAction } from "@/features/ledger/postage-types";
import { PostageConfirmDialog } from "./PostageConfirmDialog";
import { PostageBalanceBadge } from "./PostageBalanceBadge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/mail/useSession";

interface PostageDisputePanelProps {
  messageId: string;
}

export function PostageDisputePanel({ messageId }: PostageDisputePanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const prefersReducedMotion = useReducedMotion();
  const accordionTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: "easeInOut" as const };
  const chevronTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.2 };

  const { uiState } = usePostageStatus(messageId);
  const actions = usePostageActions(messageId);
  const { data: sessionData } = useSession();
  const actorAddress = sessionData?.user?.address;

  const [confirmAction, setConfirmAction] = useState<PostageAction | null>(null);

  if (
    uiState.status === "loading" ||
    uiState.status === "not_found" ||
    uiState.status === "error"
  ) {
    return null; // Or skeleton/error state
  }

  const postage = uiState.data;
  const permissions = actorAddress ? permittedActions(postage.status, actorAddress, postage) : null;
  const timeline = formatPostageTimeline(postage);

  const handleConfirm = () => {
    if (!confirmAction) return;
    const actionMutation = actions[confirmAction];
    actionMutation.mutate(
      { signal: undefined },
      {
        onSuccess: () => setConfirmAction(null),
      },
    );
  };

  const isPending = confirmAction ? actions[confirmAction].isPending : false;

  return (
    <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/3">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Hide escrow and dispute details" : "Show escrow and dispute details"}
      >
        <div className="flex items-center gap-2">
          <Flag className="h-3.5 w-3.5 text-amber-400/80 shrink-0" aria-hidden="true" />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-amber-400/80">
            Escrow &amp; Dispute
          </span>
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400/90">
            {postage.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <PostageBalanceBadge />
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={chevronTransition}>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={accordionTransition}
            className="overflow-hidden"
            role="region"
            aria-label="Postage escrow details"
          >
            <div className="space-y-4 border-t border-amber-500/12 px-3 pb-3 pt-3">
              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <span className="text-muted-foreground block mb-1">Amount</span>
                  <span className="font-semibold">{xlmFromStroops(postage.amount)} XLM</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Recipient</span>
                  <span className="font-mono text-muted-foreground break-all">
                    {postage.recipient}
                  </span>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative pl-3 mt-4 space-y-4 before:absolute before:inset-y-0 before:left-3.5 before:w-px before:bg-white/10">
                {timeline.map((event, index) => (
                  <div key={event.id} className="relative flex gap-3 text-[11px]">
                    <div className="absolute -left-1.25 mt-1 h-2.5 w-2.5 rounded-full bg-background border-2 border-muted-foreground z-10 flex items-center justify-center">
                      {event.status === "completed" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                      {event.status === "current" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground/90">{event.label}</div>
                      {event.description && (
                        <div className="text-muted-foreground mt-0.5">{event.description}</div>
                      )}
                      {event.timestamp && (
                        <div className="text-muted-foreground/70 mt-0.5 text-[9px]">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      )}
                      {event.txHash && (
                        <a
                          href={explorerTxLink(event.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 mt-1 text-blue-400 hover:underline"
                        >
                          View Transaction <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              {permissions && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                  {permissions.canSettle && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-500 border-emerald-500/20"
                      onClick={() => setConfirmAction("settle")}
                    >
                      Settle
                    </Button>
                  )}
                  {permissions.canRefund && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-500 border-red-500/20"
                      onClick={() => setConfirmAction("refund")}
                    >
                      Refund
                    </Button>
                  )}
                  {permissions.canDispute && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-500 border-amber-500/20"
                      onClick={() => setConfirmAction("dispute")}
                    >
                      Dispute
                    </Button>
                  )}
                  {permissions.canExpire && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setConfirmAction("expire")}
                    >
                      Expire
                    </Button>
                  )}
                  {permissions.canReclaim && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-500 border-blue-500/20"
                      onClick={() => setConfirmAction("reclaim")}
                    >
                      Reclaim
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PostageConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        action={confirmAction}
        amount={postage.amount}
        onConfirm={handleConfirm}
        isPending={isPending}
      />
    </div>
  );
}
