import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle,
  Eye,
  FileText,
  HelpCircle,
  Inbox,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Email } from "@/components/mail/data";
import { motionPresets } from "@/lib/motion-presets";
import { RequestCard } from "./RequestCard";
import type { CardStatus, RequestCardState, TriageAction } from "./types";

interface RequestsTriageBoardProps {
  emails: Email[];
  onUpdateEmail: (id: string, patch: Partial<Email>) => void;
  onShowToast: (message: string, options?: { tone: "success" | "neutral" | "danger" }) => void;
}

export function RequestsTriageBoard({
  emails,
  onUpdateEmail,
  onShowToast,
}: RequestsTriageBoardProps) {
  const [cardStates, setCardStates] = useState<Record<string, RequestCardState>>({});
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [inspectEmail, setInspectEmail] = useState<Email | null>(null);

  // Get active requests in the folder
  const requests = emails.filter((email) => email.folder === "requests");

  const getCardStatus = (emailId: string): CardStatus => {
    return cardStates[emailId]?.status ?? "idle";
  };

  const setCardStatus = (emailId: string, status: CardStatus) => {
    setCardStates((prev) => ({
      ...prev,
      [emailId]: { ...prev[emailId], emailId, status },
    }));
  };

  // Triggering the action (approve/block/refund) -> starts the pending state
  const handleTriggerAction = (emailId: string, action: TriageAction) => {
    const pendingStatus: CardStatus = `pending-${action}` as CardStatus;
    setCardStatus(emailId, pendingStatus);

    // Simulate API delay (800ms)
    setTimeout(() => {
      if (simulateFailure) {
        setCardStatus(emailId, "failure");
        onShowToast(`Stellar transaction failed for ${action}`, { tone: "danger" });
      } else {
        const successStatus: CardStatus = `success-${action}` as CardStatus;
        setCardStatus(emailId, successStatus);
        onShowToast(`Optimistic ${action} registered. Reviewing details...`, {
          tone: "neutral",
        });
      }
    }, 800);
  };

  // Undo triggers a loading revert state, then goes back to idle
  const handleUndoAction = (emailId: string) => {
    setCardStatus(emailId, "undoing");
    setTimeout(() => {
      setCardStatus(emailId, "idle");
      onShowToast("Changes reverted successfully", { tone: "success" });
    }, 600);
  };

  // Finalizing triggers the actual folder state transition
  const handleFinalizeAction = (emailId: string, action: TriageAction) => {
    const email = emails.find((e) => e.id === emailId);
    if (!email) return;

    // Apply cleaner label updates
    const cleanLabels = (labels?: string[], toAdd?: string) => {
      const filterOut = ["Request", "Paid", "Pending"];
      const current = labels ? labels.filter((l) => !filterOut.includes(l)) : [];
      return toAdd ? [...current, toAdd] : current;
    };

    if (action === "approve") {
      onUpdateEmail(emailId, {
        folder: "inbox",
        senderPolicy: "allow",
        labels: cleanLabels(email.labels, "Trusted"),
      });
      onShowToast(`${email.from} added to Trusted Contacts. Mail moved to Inbox.`, {
        tone: "success",
      });
    } else if (action === "block") {
      onUpdateEmail(emailId, {
        folder: "spam",
        senderPolicy: "block",
        labels: cleanLabels(email.labels, "Blocked"),
      });
      onShowToast(`${email.from} blocked. Mail moved to Spam.`, { tone: "danger" });
    } else if (action === "refund") {
      onUpdateEmail(emailId, {
        folder: "spam",
        labels: cleanLabels(email.labels, "Refunded"),
      });
      onShowToast(`Postage refunded for message from ${email.from}.`, { tone: "success" });
    }

    // Clean up local card state
    setCardStates((prev) => {
      const next = { ...prev };
      delete next[emailId];
      return next;
    });
  };

  return (
    <div className="mail-list-atmosphere relative m-3 flex h-[calc(100vh-3.5rem-1.5rem)] flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
      {/* Triage Board Header */}
      <div className="relative z-10 flex flex-col justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-4 py-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[oklch(0.85_0.005_270)]" />
            <h2 className="text-sm font-semibold tracking-normal text-foreground">
              Request Triage Board
            </h2>
            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {requests.length} pending
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Approve, block, or refund postage for unknown and paid senders from a unified interface.
          </p>
        </div>

        {/* QA Control panel */}
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none hover:text-foreground transition">
            <input
              type="checkbox"
              checked={simulateFailure}
              onChange={(e) => setSimulateFailure(e.target.checked)}
              className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 focus:outline-none"
            />
            Simulate network failure
          </label>
        </div>
      </div>

      {/* Main Cards Area */}
      <div className="scrollbar-thin relative z-10 flex-1 overflow-y-auto p-4 md:p-6">
        <AnimatePresence mode="popLayout">
          {requests.length === 0 ? (
            <motion.div
              key="empty-state"
              {...motionPresets.entrance.scaleIn(0.98)}
              className="flex h-[300px] flex-col items-center justify-center text-center p-6"
            >
              <div className="mb-4 rounded-full bg-emerald-500/10 p-3 text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">All caught up!</h3>
              <p className="max-w-[280px] text-xs text-muted-foreground mt-1 leading-normal">
                There are no pending sender requests awaiting review. Your inbox policy is working
                perfectly.
              </p>
            </motion.div>
          ) : (
            <motion.div key="cards-grid" className="grid grid-cols-1 gap-4 lg:grid-cols-2" layout>
              {requests.map((email) => (
                <motion.div key={email.id} layout>
                  <RequestCard
                    email={email}
                    status={getCardStatus(email.id)}
                    simulateFailure={simulateFailure}
                    onTriggerAction={handleTriggerAction}
                    onUndoAction={handleUndoAction}
                    onFinalizeAction={handleFinalizeAction}
                    onInspect={setInspectEmail}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CONTEXT INSPECTOR MODAL */}
      <AnimatePresence>
        {inspectEmail && (
          <>
            {/* Backdrop */}
            <motion.div
              {...motionPresets.patterns.modal.backdrop}
              onClick={() => setInspectEmail(null)}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md"
            />

            {/* Panel */}
            <motion.div
              {...motionPresets.patterns.modal.content}
              role="dialog"
              aria-modal="true"
              aria-label="Inspect sender request context"
              className="glass-strong fixed left-1/2 top-1/2 z-[101] w-[min(540px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10"
            >
              <div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-4">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Sender Inspection
                  </span>
                  <h3 className="text-sm font-bold text-foreground mt-0.5 truncate max-w-[360px]">
                    {inspectEmail.from}
                  </h3>
                </div>
                <button
                  onClick={() => setInspectEmail(null)}
                  className="rounded-lg p-1 text-muted-foreground transition hover:bg-white/5 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-white/10"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-4">
                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium block">Stellar ID</span>
                    <span className="font-mono text-[10px] break-all block mt-0.5 text-foreground/90">
                      {inspectEmail.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">Verification</span>
                    {inspectEmail.verifiedSender ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium mt-0.5">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Verified cryptographic key
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-medium mt-0.5">
                        <HelpCircle className="h-3.5 w-3.5" />
                        Self-declared identity (Unverified)
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">
                      Postage Attached
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {inspectEmail.postageAmount
                        ? `${Number(inspectEmail.postageAmount) / 10_000_000} XLM`
                        : "0.0 XLM"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">Security Status</span>
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 mt-0.5">
                      Quarantined (Requests folder)
                    </span>
                  </div>
                </div>

                {/* Email Body */}
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground block">
                    Message Preview
                  </span>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                    <div className="border-b border-white/[0.06] pb-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Subject
                      </span>
                      <h4 className="text-xs font-bold text-foreground mt-0.5">
                        {inspectEmail.subject}
                      </h4>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">
                        Body Content
                      </span>
                      <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                        {inspectEmail.body}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Attachments if any */}
                {inspectEmail.attachments && inspectEmail.attachments.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Attachments ({inspectEmail.attachments.length})
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {inspectEmail.attachments.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.01] p-2 text-[11px]"
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground/90">{file.name}</p>
                            <p className="text-[9px] text-muted-foreground">{file.size}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Inspector CTAs */}
              <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-6 py-4">
                <button
                  onClick={() => setInspectEmail(null)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/10"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
