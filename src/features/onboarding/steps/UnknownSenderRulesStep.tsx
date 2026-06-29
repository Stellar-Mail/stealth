import { cn } from "@/lib/utils";
import type { UnknownSenderPolicy } from "@/features/preferences";
import type { OnboardingDraft } from "../types";

type Props = {
  draft: OnboardingDraft;
  onUpdate: (patch: Partial<OnboardingDraft>) => void;
  onAdvance: () => void;
  onRetreat: () => void;
};

const POLICIES: Array<{
  value: UnknownSenderPolicy;
  label: string;
  description: string;
  badge: string;
}> = [
  {
    value: "request",
    label: "Request approval",
    description:
      "Hold messages from unknown senders for review. You decide who reaches your inbox.",
    badge: "Recommended",
  },
  {
    value: "verified",
    label: "Verified senders only",
    description:
      "Accept messages only from cryptographically verified identities who also pay postage.",
    badge: "Strict",
  },
  {
    value: "block",
    label: "Trusted contacts only",
    description: "Reject every sender not on your allow-list. Maximum privacy, zero noise.",
    badge: "Maximum",
  },
];

/**
 * Step 4: Unknown-sender rules
 *
 * Privacy-preserving default is "request" (hold for review).
 * Mirrors the options in SettingsModal InboxSettings so both paths stay in sync.
 */
export function UnknownSenderRulesStep({ draft, onUpdate, onAdvance, onRetreat }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Who can mail you?</h2>
        <p className="text-sm text-muted-foreground">
          Choose how messages from senders you have never interacted with are handled.
        </p>
      </div>

      <div className="grid gap-2">
        {POLICIES.map((policy) => {
          const isSelected = draft.unknownSenderRule === policy.value;
          return (
            <button
              key={policy.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onUpdate({ unknownSenderRule: policy.value })}
              className={cn(
                "relative rounded-xl border p-4 text-left transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
                "active:scale-[0.99]",
                isSelected
                  ? "border-emerald-400/30 bg-emerald-400/[0.06] ring-1 ring-emerald-400/30"
                  : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">{policy.label}</span>
                  <span className="block text-xs text-muted-foreground">{policy.description}</span>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    isSelected
                      ? "bg-emerald-400/20 text-emerald-300"
                      : "bg-white/[0.06] text-muted-foreground",
                  )}
                >
                  {policy.badge}
                </span>
              </div>
            </button>
          );
        })}
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
          className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.99]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
