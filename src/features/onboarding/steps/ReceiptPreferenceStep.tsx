import { FileCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnboardingDraft } from "../types";

type Props = {
  draft: OnboardingDraft;
  onUpdate: (patch: Partial<OnboardingDraft>) => void;
  onAdvance: () => void;
  onRetreat: () => void;
};

/**
 * Step 6: Receipt preference
 *
 * Controls whether the client automatically marks messages as read and emits
 * a cryptographic read-receipt back to the sender on the Stellar ledger.
 */
export function ReceiptPreferenceStep({ draft, onUpdate, onAdvance, onRetreat }: Props) {
  const { receiptOnDelivery } = draft;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Delivery receipts</h2>
        <p className="text-sm text-muted-foreground">
          When enabled, a cryptographic proof is written to the Stellar ledger each time you read a
          message. Only the original sender can verify this proof.
        </p>
      </div>

      <div className="grid gap-2">
        {[
          {
            value: true,
            label: "Send read receipts",
            description:
              "Senders receive an on-chain confirmation when you read their message. Enables trust signals for verified contacts.",
            icon: FileCheck,
          },
          {
            value: false,
            label: "No receipts",
            description:
              "Your reading activity stays private. Senders get no delivery confirmation.",
            icon: null,
          },
        ].map(({ value, label, description, icon: Icon }) => {
          const isSelected = receiptOnDelivery === value;
          return (
            <button
              key={String(value)}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onUpdate({ receiptOnDelivery: value })}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
                "active:scale-[0.99]",
                isSelected
                  ? "border-emerald-400/30 bg-emerald-400/[0.06] ring-1 ring-emerald-400/30"
                  : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
              )}
            >
              {Icon ? (
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isSelected ? "text-emerald-400" : "text-muted-foreground",
                  )}
                />
              ) : (
                <span className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="space-y-1">
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Receipts are opt-in per-message in conversations. This setting controls the default.
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
          className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 active:scale-[0.99]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
