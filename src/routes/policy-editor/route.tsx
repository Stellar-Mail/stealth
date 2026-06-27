import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Surface, ActionButton, useFeedback } from "@/features/design-system";
import { Check, X, Shield, ShieldAlert, Code, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { simulateSenderAdmission } from "./simulate-sender";

export const Route = createFileRoute("/policy-editor")({
  component: PolicyEditorPage,
});

const SENDER_LABELS: Record<"trusted" | "blocked" | "verified" | "unverified", string> = {
  trusted: "Trusted sender",
  blocked: "Blocked sender",
  verified: "Verified sender",
  unverified: "Unverified sender",
};

function PolicyEditorPage() {
  const [allowUnknown, setAllowUnknown] = useState(true);
  const [requireVerified, setRequireVerified] = useState(false);
  const [minimumPostage, setMinimumPostage] = useState(0.01);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { notify } = useFeedback();

  const payload = {
    allowUnknown,
    requireVerified,
    minimumPostage: minimumPostage.toString(),
  };

  const handleSave = async () => {
    setIsSaving(true);
    setApiError(null);
    try {
      const res = await fetch("/api/v1/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Validation/Authorization failed with status ${res.status}`);
      }
      notify("Policy saved successfully!", { tone: "success" });
    } catch (e: any) {
      setApiError(e.message);
      notify("Failed to save policy", { tone: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  const verificationDisabled = !allowUnknown;
  const postageDisabled = !allowUnknown;

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 text-foreground">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Mailbox Policy Editor</h1>
          <p className="text-muted-foreground mt-2">
            Tune your inbox admission rules and preview the live impact before saving.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Surface className="p-6 space-y-8 h-fit">
            <div>
              <h2 className="text-xl font-semibold mb-1">Policy Controls</h2>
              <p className="text-xs text-muted-foreground mb-6">
                Changes preview instantly. Click Save policy to apply.
              </p>

              <div className="space-y-8">
                {/* Allow Unknown Senders toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor="toggle-allow-unknown"
                      className="font-medium text-sm cursor-pointer"
                    >
                      Allow Unknown Senders
                    </label>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                      If disabled, only explicitly trusted contacts can reach you. All others are
                      blocked.
                    </p>
                  </div>
                  <button
                    id="toggle-allow-unknown"
                    role="switch"
                    aria-checked={allowUnknown}
                    aria-label="Allow unknown senders"
                    onClick={() => setAllowUnknown(!allowUnknown)}
                    className={cn(
                      "glow-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
                      "transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "active:scale-95",
                      allowUnknown
                        ? "bg-emerald-500 hover:bg-emerald-400"
                        : "bg-white/20 hover:bg-white/30",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                        allowUnknown ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </button>
                </div>

                {/* Require Verification toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor="toggle-require-verified"
                      className={cn(
                        "font-medium text-sm",
                        verificationDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                      )}
                    >
                      Require Verification
                    </label>
                    <p
                      className={cn(
                        "text-xs text-muted-foreground mt-1 max-w-[280px]",
                        verificationDisabled && "opacity-40",
                      )}
                    >
                      {verificationDisabled
                        ? "Enable unknown senders first to configure verification."
                        : "Unknown senders must prove their cryptographic identity. Unverified mail is rejected."}
                    </p>
                  </div>
                  <button
                    id="toggle-require-verified"
                    role="switch"
                    aria-checked={requireVerified}
                    aria-label="Require verification"
                    aria-disabled={verificationDisabled}
                    onClick={() => !verificationDisabled && setRequireVerified(!requireVerified)}
                    className={cn(
                      "glow-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
                      "transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      verificationDisabled ? "opacity-40 cursor-not-allowed" : "active:scale-95",
                      requireVerified && !verificationDisabled
                        ? "bg-emerald-500 hover:bg-emerald-400"
                        : verificationDisabled
                          ? "bg-white/20"
                          : "bg-white/20 hover:bg-white/30",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                        requireVerified && !verificationDisabled
                          ? "translate-x-6"
                          : "translate-x-1",
                      )}
                    />
                  </button>
                </div>

                {/* Minimum Postage slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="minimum-postage-slider"
                      className={cn("font-medium text-sm", postageDisabled && "opacity-40")}
                    >
                      Minimum Postage
                    </label>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums transition-colors",
                        postageDisabled ? "text-muted-foreground opacity-40" : "text-emerald-400",
                      )}
                    >
                      {minimumPostage.toFixed(3)} XLM
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-xs text-muted-foreground mt-1 mb-4",
                      postageDisabled && "opacity-40",
                    )}
                  >
                    {postageDisabled
                      ? "Enable unknown senders to set a postage requirement."
                      : "Required deposit from unknown senders to discourage spam and low-effort outreach."}
                  </p>
                  <input
                    id="minimum-postage-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.005"
                    disabled={postageDisabled}
                    value={minimumPostage}
                    onChange={(e) => setMinimumPostage(parseFloat(e.target.value))}
                    aria-valuetext={`${minimumPostage.toFixed(3)} XLM`}
                    className={cn(
                      "w-full accent-emerald-500 transition-opacity",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded",
                      postageDisabled && "opacity-40 cursor-not-allowed",
                    )}
                  />
                  <div
                    className={cn(
                      "flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums",
                      postageDisabled && "opacity-40",
                    )}
                  >
                    <span>0 XLM</span>
                    <span>0.5 XLM</span>
                    <span>1 XLM</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-white/10 flex items-center justify-between gap-4">
              <p className="text-[11px] text-muted-foreground">
                Preview updates live. Save to apply.
              </p>
              <ActionButton
                onClick={handleSave}
                disabled={isSaving}
                aria-label={isSaving ? "Saving policy…" : "Save policy"}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Saving…</span>
                  </>
                ) : (
                  "Save Policy"
                )}
              </ActionButton>
            </div>
          </Surface>

          <div className="space-y-6">
            <Surface className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-sky-400" aria-hidden="true" /> Live Simulator
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Shows how the current draft policy would admit each sender type.
              </p>
              <div className="space-y-2" role="list" aria-label="Sender admission results">
                {(["trusted", "blocked", "verified", "unverified"] as const).map((type) => {
                  const result = simulateSenderAdmission(
                    { allowUnknown, requireVerified, minimumPostage },
                    type,
                  );
                  return (
                    <div
                      key={type}
                      role="listitem"
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                        result.allowed
                          ? "border-emerald-400/15 bg-emerald-400/[0.04]"
                          : "border-rose-400/15 bg-rose-400/[0.04]",
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        {result.allowed ? (
                          <Check className="w-4 h-4 text-emerald-400" aria-label="Allowed" />
                        ) : (
                          <X className="w-4 h-4 text-rose-400" aria-label="Blocked" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{SENDER_LABELS[type]}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {result.reason}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Surface>

            <Surface className="p-6 bg-black/40">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Code className="w-5 h-5 text-amber-400" aria-hidden="true" /> API Payload
              </h2>
              <pre
                className="text-xs text-emerald-300 bg-black/60 p-4 rounded-lg overflow-x-auto border border-white/5 leading-relaxed"
                aria-label="Current policy JSON payload"
              >
                {JSON.stringify(payload, null, 2)}
              </pre>

              {/* Error state */}
              {apiError && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mt-4 flex items-start gap-3 text-rose-300 text-xs bg-rose-400/10 p-3.5 rounded-lg border border-rose-400/20"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium text-rose-200 mb-0.5">Save failed</p>
                    <p className="text-rose-300/80 break-words">{apiError}</p>
                  </div>
                </div>
              )}
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
}
