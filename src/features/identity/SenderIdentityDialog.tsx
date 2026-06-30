import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Ban,
  Check,
  CircleAlert,
  Fingerprint,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Email } from "@/components/mail/data";
import { getFolderLabel } from "@/components/mail/data";
import { SenderBadge } from "@/features/sender-conversion";
import {
  SENDER_POLICY_OPTIONS,
  getSenderPolicyOption,
  resolveSenderConversion,
  type SenderPolicyChoice,
} from "@/features/sender-conversion";
import { buildSenderIdentityProfile, type SenderIdentityTarget } from "./types";

type Phase = "profile" | "confirm" | "done";

type Props = {
  target: SenderIdentityTarget | null;
  emails: Email[];
  onConfirm: (target: SenderIdentityTarget, choice: SenderPolicyChoice) => void;
  onClose: () => void;
};

const policyIcons: Record<SenderPolicyChoice, LucideIcon> = {
  allow: BadgeCheck,
  verify: ShieldCheck,
  block: Ban,
};

export function SenderIdentityDialog({ target, emails, onConfirm, onClose }: Props) {
  const [choice, setChoice] = useState<SenderPolicyChoice | null>(null);
  const [phase, setPhase] = useState<Phase>("profile");

  useEffect(() => {
    if (target) {
      setChoice(null);
      setPhase("profile");
    }
  }, [target?.emailId]);

  const profile = useMemo(() => {
    if (!target) return null;
    return buildSenderIdentityProfile(target, emails);
  }, [emails, target]);

  const result = target && choice ? resolveSenderConversion({ from: target.sender }, choice) : null;
  const selectedOption = choice ? getSenderPolicyOption(choice) : null;

  const handleConfirm = () => {
    if (!target || !choice) return;
    onConfirm(target, choice);
    setPhase("done");
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[min(88vh,860px)] w-[min(960px,calc(100vw-1rem))] overflow-hidden border border-white/10 bg-[oklch(0.12_0.006_270)] p-0 text-foreground shadow-[0_32px_80px_oklch(0_0_0/0.5)] sm:rounded-3xl">
        {target && profile && (
          <div className="relative flex max-h-[min(88vh,860px)] flex-col overflow-hidden">
            <div className="border-b border-white/8 bg-[linear-gradient(135deg,oklch(0.17_0.006_270),oklch(0.12_0.006_270))] px-5 py-4 sm:px-6">
              <DialogHeader className="text-left">
                <DialogDescription className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  Sender profile
                </DialogDescription>
                <DialogTitle className="flex flex-wrap items-center gap-2 text-lg sm:text-xl">
                  <span className="truncate">{target.sender}</span>
                  <SenderBadge policy={target.currentPolicy} />
                </DialogTitle>
              </DialogHeader>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div
                      className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-sm font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                      style={{ background: "linear-gradient(135deg, #5b6470, #1a1a1d)" }}
                    >
                      {target.sender
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-foreground">
                          {profile.displayName}
                        </h2>
                        <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-xs">
                          {profile.statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                        {profile.address}
                      </p>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/78">
                        {profile.statusSummary}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="secondary" className="gap-1.5">
                          <Sparkles className="h-3 w-3" />
                          {profile.policyLabel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="gap-1.5 border-sky-300/25 bg-sky-300/10 text-sky-200"
                        >
                          <Fingerprint className="h-3 w-3" />
                          {profile.conversationCount} conversation
                          {profile.conversationCount === 1 ? "" : "s"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="gap-1.5 border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {profile.proofSummary}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <SummaryRow
                    label={profile.lastProofLabel}
                    detail={profile.lastProofDetail}
                    tone="sky"
                  />
                  <SummaryRow
                    label={profile.lastReceiptLabel}
                    detail={profile.lastReceiptDetail}
                    tone="amber"
                  />
                  <SummaryRow
                    label={profile.lastPostageLabel}
                    detail={profile.lastPostageDetail}
                    tone="emerald"
                  />
                  <div className="rounded-xl border border-white/8 bg-black/15 p-3 text-xs text-foreground/76">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <CircleAlert className="h-3.5 w-3.5" />
                      Trust rule
                    </div>
                    <p className="mt-2 leading-5">{profile.policySummary}</p>
                  </div>
                </section>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                      Recent conversations
                    </span>
                    <Badge variant="outline" className="ml-auto border-white/10 bg-white/[0.04] text-[10px]">
                      {profile.conversationCount}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {profile.recentConversations.length > 0 ? (
                      profile.recentConversations.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-xl border border-white/8 bg-black/10 p-3 transition hover:bg-black/18"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-medium text-foreground">
                                {item.subject}
                              </h3>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {item.preview}
                              </p>
                            </div>
                            <div className="shrink-0 text-right text-[10px] text-muted-foreground">
                              <div>{item.time}</div>
                              <div>{item.folderLabel}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "border-white/10 bg-white/[0.04] text-[10px]",
                                item.verified
                                  ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                                  : "text-muted-foreground",
                              )}
                            >
                              {item.verified ? "Verified proof" : "Proof pending"}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              Postage {item.postage}
                            </Badge>
                            <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-[10px]">
                              Receipt {item.receipt}
                            </Badge>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-muted-foreground">
                        No shared conversations have been recorded for this sender yet.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                      Policy actions
                    </span>
                    {phase === "confirm" && selectedOption && (
                      <Badge variant="outline" className="ml-auto border-white/10 bg-white/[0.04] text-[10px]">
                        Confirm {selectedOption.label.toLowerCase()}
                      </Badge>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {phase === "profile" && (
                      <motion.div
                        key="profile-phase"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-4"
                      >
                        <p className="text-sm leading-6 text-foreground/76">
                          Choose the policy you want to apply to this sender. The dialog will ask for
                          a confirmation before anything changes.
                        </p>

                        <div className="mt-4 grid gap-2">
                          {SENDER_POLICY_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const current = target.currentPolicy === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setChoice(option.value);
                                  setPhase("confirm");
                                }}
                                className={cn(
                                  "rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-white/15",
                                  current
                                    ? "border-white/16 bg-white/[0.07]"
                                    : "border-white/8 bg-black/10 hover:bg-white/[0.05]",
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <span
                                    className={cn(
                                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
                                      option.value === "block"
                                        ? "border-red-300/25 bg-red-300/10 text-red-200"
                                        : option.value === "verify"
                                          ? "border-sky-300/25 bg-sky-300/10 text-sky-200"
                                          : "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
                                    )}
                                  >
                                    <Icon className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-foreground">
                                        {option.label}
                                      </span>
                                      {current && (
                                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                                          Current
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-foreground/72">
                                      {option.summary}
                                    </p>
                                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                      {option.effect}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {phase === "confirm" && choice && selectedOption && result && (
                      <motion.div
                        key="confirm-phase"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-4"
                      >
                        <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                          <div className="flex items-start gap-3">
                            <span
                              className={cn(
                                "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
                                choice === "block"
                                  ? "border-red-300/25 bg-red-300/10 text-red-200"
                                  : choice === "verify"
                                    ? "border-sky-300/25 bg-sky-300/10 text-sky-200"
                                    : "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
                              )}
                            >
                              {(() => {
                                const Icon = policyIcons[choice];
                                return <Icon className="h-4 w-4" />;
                              })()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">
                                Confirm {selectedOption.label.toLowerCase()} for {target.sender}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-foreground/72">
                                {selectedOption.effect}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge variant="secondary">{selectedOption.badge}</Badge>
                                <Badge variant="outline" className="border-white/10 bg-white/[0.04]">
                                  {getFolderLabel(result.folder)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => {
                              setChoice(null);
                              setPhase("profile");
                            }}
                            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirm}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
                          >
                            Confirm policy
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {phase === "done" && choice && selectedOption && result && (
                      <motion.div
                        key="done-phase"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-4"
                      >
                        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4">
                          <div className="flex items-start gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                              <Check className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {result.toast.message}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-foreground/72">
                                Filed under {getFolderLabel(result.folder)} with the{" "}
                                {selectedOption.label.toLowerCase()} rule.
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge variant="secondary">{selectedOption.badge}</Badge>
                                <Badge variant="outline" className="border-white/10 bg-white/[0.04]">
                                  {profile.statusLabel}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={onClose}
                          className="mt-4 w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
                        >
                          Done
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: "sky" | "amber" | "emerald";
}) {
  const toneClasses =
    tone === "sky"
      ? "border-sky-300/25 bg-sky-300/10 text-sky-200"
      : tone === "amber"
        ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
        : "border-emerald-300/25 bg-emerald-300/10 text-emerald-200";

  return (
    <div className="rounded-xl border border-white/8 bg-black/10 p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
            toneClasses,
          )}
        >
          {label}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-foreground/76">{detail}</p>
    </div>
  );
}
