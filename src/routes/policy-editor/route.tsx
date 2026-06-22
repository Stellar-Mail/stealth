import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Surface, ActionButton, useFeedback } from "@/features/design-system";
import { Check, X, Shield, ShieldAlert, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { simulateSenderAdmission } from "./simulate-sender";

export const Route = createFileRoute("/policy-editor")({
  component: PolicyEditorPage,
});

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

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 text-foreground">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Mailbox Policy Editor</h1>
          <p className="text-muted-foreground mt-2">
            Tune your inbox admission rules and preview the live impact.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Surface className="p-6 space-y-8 h-fit">
            <div>
              <h2 className="text-xl font-semibold mb-6">Policy Controls</h2>

              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-sm">Allow Unknown Senders</label>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                      If disabled, only explicitly trusted contacts can reach you. All others are
                      blocked.
                    </p>
                  </div>
                  <button
                    onClick={() => setAllowUnknown(!allowUnknown)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                      allowUnknown ? "bg-emerald-500" : "bg-white/20",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        allowUnknown ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-medium text-sm">Require Verification</label>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                      Unknown senders must prove their cryptographic identity. Unverified mail is
                      rejected.
                    </p>
                  </div>
                  <button
                    onClick={() => setRequireVerified(!requireVerified)}
                    disabled={!allowUnknown}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                      requireVerified && allowUnknown ? "bg-emerald-500" : "bg-white/20",
                      !allowUnknown && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        requireVerified && allowUnknown ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </button>
                </div>

                <div>
                  <label className="font-medium text-sm flex justify-between">
                    Minimum Postage
                    <span className="text-accent">{minimumPostage.toFixed(3)} XLM</span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Required deposit from unknown senders to discourage spam.
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.005"
                    disabled={!allowUnknown}
                    value={minimumPostage}
                    onChange={(e) => setMinimumPostage(parseFloat(e.target.value))}
                    className={cn(
                      "w-full accent-primary",
                      !allowUnknown && "opacity-50 cursor-not-allowed",
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 flex justify-end">
              <ActionButton onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Policy"}
              </ActionButton>
            </div>
          </Surface>

          <div className="space-y-6">
            <Surface className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-sky-400" /> Live Simulator
              </h2>
              <div className="space-y-3">
                {(["trusted", "blocked", "verified", "unverified"] as const).map((type) => {
                  const result = simulateSenderAdmission(
                    { allowUnknown, requireVerified, minimumPostage },
                    type,
                  );
                  return (
                    <div
                      key={type}
                      className="flex items-start gap-4 p-3 rounded-lg border border-white/5 bg-white/[0.02]"
                    >
                      <div className="mt-0.5">
                        {result.allowed ? (
                          <Check className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <X className="w-5 h-5 text-rose-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{type} Sender</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{result.reason}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Surface>

            <Surface className="p-6 bg-black/40">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Code className="w-5 h-5 text-amber-400" /> API Payload
              </h2>
              <pre className="text-xs text-emerald-300 bg-black/60 p-4 rounded-lg overflow-x-auto border border-white/5">
                {JSON.stringify(payload, null, 2)}
              </pre>
              {apiError && (
                <div className="mt-4 flex items-start gap-2 text-rose-400 text-xs bg-rose-400/10 p-3 rounded-lg border border-rose-400/20">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <p>{apiError}</p>
                </div>
              )}
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
}
