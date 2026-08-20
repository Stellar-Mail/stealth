import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Surface, ActionButton, useFeedback } from "@/features/design-system";
import { Check, X, Shield, ShieldAlert, Code, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { simulateSenderAdmission } from "./-simulate-sender";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sharedTypedApi, queryKeys } from "@/lib/api";
import { isApiClientError } from "@/lib/api/errors";
import { RefreshCw } from "lucide-react";
import type { MailboxPolicyWrite, MailboxPolicy } from "@/lib/api/types";

export const Route = createFileRoute("/policy-editor")({
  component: PolicyEditorPageWrapper,
});

const SENDER_LABELS: Record<"trusted" | "blocked" | "verified" | "unverified", string> = {
  trusted: "Trusted sender",
  blocked: "Blocked sender",
  verified: "Verified sender",
  unverified: "Unverified sender",
};

function PolicyEditorPageWrapper() {
  const { data: profileData } = useQuery({
    queryKey: queryKeys.account.profile,
    queryFn: ({ signal }) => sharedTypedApi.account.getProfile(signal),
  });

  if (!profileData) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 text-foreground animate-pulse text-muted-foreground text-sm">
        Loading profile...
      </div>
    );
  }

  return <PolicyEditorPage address={profileData.account.address} />;
}

function PolicyEditorPage({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const { notify } = useFeedback();

  const {
    data: reconciliation,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.policies.reconciliation(address),
    queryFn: ({ signal }) => sharedTypedApi.policies.getReconciliation(address, undefined, signal),
  });

  const livePolicy = reconciliation?.offchain.policy ?? {
    allowUnknown: true,
    requireVerified: false,
    minimumPostage: "0.01",
  };

  const [draftPolicy, setDraftPolicy] = useState<MailboxPolicyWrite | null>(null);

  // Sync draft to server state initially and when server state updates
  // (unless user is currently editing and has diverged, though we're simplifying here)
  useEffect(() => {
    if (reconciliation?.offchain.policy) {
      setDraftPolicy({
        ...reconciliation.offchain.policy,
        minimumPostage: reconciliation.offchain.policy.minimumPostage,
      });
    } else {
      setDraftPolicy({ allowUnknown: true, requireVerified: false, minimumPostage: "0.01" });
    }
  }, [reconciliation?.offchain.policy]);

  const currentForm = draftPolicy ?? livePolicy;

  const mutation = useMutation({
    mutationFn: (policy: MailboxPolicyWrite) => sharedTypedApi.policies.update(address, policy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.reconciliation(address) });
      queryClient.invalidateQueries({ queryKey: queryKeys.policies.policy(address) });
      notify("Policy saved successfully!", { tone: "success" });
    },
    onError: (e: any) => {
      notify("Failed to save policy", { tone: "danger" });
    },
  });

  const handleSave = async () => {
    if (!draftPolicy) return;
    mutation.mutate({
      ...draftPolicy,
      version: reconciliation?.offchain.version ?? undefined,
    });
  };

  const updateDraft = (updates: Partial<MailboxPolicyWrite>) => {
    setDraftPolicy((prev) => (prev ? { ...prev, ...updates } : { ...livePolicy, ...updates }));
  };

  const verificationDisabled = !currentForm.allowUnknown;
  const postageDisabled = !currentForm.allowUnknown;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 text-foreground animate-pulse text-muted-foreground text-sm">
        Loading policy...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-12 text-foreground">
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          Could not load policy.{" "}
          <button onClick={() => refetch()} className="underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 text-foreground">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Mailbox Policy Editor</h1>
          <p className="text-muted-foreground mt-2">
            Tune your inbox admission rules and preview the live impact before saving.
          </p>
        </div>

        {mutation.isError && isApiClientError(mutation.error) && mutation.error.status === 409 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm flex items-start gap-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="text-amber-200">
              <p className="font-medium">Policy updated elsewhere</p>
              <p className="mt-0.5 text-xs opacity-80">
                These settings were modified from another session or tab.
              </p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-2"
              >
                Reload latest changes
              </button>
            </div>
          </div>
        )}

        {reconciliation?.state === "pending_write" && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm flex items-start gap-3">
            <RefreshCw className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5 animate-spin" />
            <div className="text-emerald-200">
              <p className="font-medium">Changes pending on chain</p>
              <p className="mt-0.5 text-xs opacity-80">Your policy is confirming on the network.</p>
            </div>
          </div>
        )}

        {reconciliation?.state === "failed" && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm flex items-start gap-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="text-rose-200">
              <p className="font-medium">Policy write failed</p>
              <p className="mt-0.5 text-xs opacity-80">
                {reconciliation.offchain.intentError || "An error occurred writing to the network."}
              </p>
              <button
                onClick={() =>
                  mutation.mutate({
                    ...livePolicy,
                    version: reconciliation.offchain.version ?? undefined,
                  })
                }
                className="mt-2 text-xs font-medium text-rose-300 hover:text-rose-200 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

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
                    aria-checked={currentForm.allowUnknown}
                    aria-label="Allow unknown senders"
                    onClick={() => updateDraft({ allowUnknown: !currentForm.allowUnknown })}
                    className={cn(
                      "glow-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
                      "transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "active:scale-95",
                      currentForm.allowUnknown
                        ? "bg-emerald-500 hover:bg-emerald-400"
                        : "bg-white/20 hover:bg-white/30",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                        currentForm.allowUnknown ? "translate-x-6" : "translate-x-1",
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
                    aria-checked={currentForm.requireVerified}
                    aria-label="Require verification"
                    aria-disabled={verificationDisabled}
                    onClick={() =>
                      !verificationDisabled &&
                      updateDraft({ requireVerified: !currentForm.requireVerified })
                    }
                    className={cn(
                      "glow-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
                      "transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      verificationDisabled ? "opacity-40 cursor-not-allowed" : "active:scale-95",
                      currentForm.requireVerified && !verificationDisabled
                        ? "bg-emerald-500 hover:bg-emerald-400"
                        : verificationDisabled
                          ? "bg-white/20"
                          : "bg-white/20 hover:bg-white/30",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                        currentForm.requireVerified && !verificationDisabled
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
                      {Number(currentForm.minimumPostage).toFixed(3)} XLM
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
                    value={Number(currentForm.minimumPostage)}
                    onChange={(e) => updateDraft({ minimumPostage: e.target.value })}
                    aria-valuetext={`${Number(currentForm.minimumPostage).toFixed(3)} XLM`}
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
                disabled={mutation.isPending}
                aria-label={mutation.isPending ? "Saving policy…" : "Save policy"}
              >
                {mutation.isPending ? (
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
                    {
                      allowUnknown: currentForm.allowUnknown,
                      requireVerified: currentForm.requireVerified,
                      minimumPostage: Number(currentForm.minimumPostage),
                    },
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
                {JSON.stringify(currentForm, null, 2)}
              </pre>

              {/* Error state */}
              {mutation.isError &&
                !(isApiClientError(mutation.error) && mutation.error.status === 409) && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="mt-4 flex items-start gap-3 text-rose-300 text-xs bg-rose-400/10 p-3.5 rounded-lg border border-rose-400/20"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-medium text-rose-200 mb-0.5">Save failed</p>
                      <p className="text-rose-300/80 break-words">{mutation.error?.message}</p>
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
