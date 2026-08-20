import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Globe,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useCallback, useId, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { sharedTypedApi as api, cacheInvalidations, queryKeys } from "@/lib/api";
import type { ActiveSession } from "@/lib/api";
import { cn } from "@/lib/utils";

import { ExternalWalletSettings } from "./external-wallet-linking";
import { ManagedWalletStatus } from "./ManagedWalletStatus";
import { RecoveryCodesSection } from "./recovery-codes";

function getDeviceIcon(summary: string) {
  const s = summary.toLowerCase();
  if (s.includes("ios") || s.includes("android") || s.includes("phone")) {
    return Smartphone;
  }
  if (s.includes("ipad") || s.includes("tablet")) {
    return Tablet;
  }
  if (
    s.includes("macos") ||
    s.includes("windows") ||
    s.includes("linux") ||
    s.includes("chromeos")
  ) {
    return Laptop;
  }
  return Globe;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export function AccountSecuritySection({
  ownerAddress,
  onSignedOut,
}: {
  ownerAddress?: string;
  onSignedOut?: () => void;
}) {
  const queryClient = useQueryClient();
  const alertTitleId = useId();
  const alertDescId = useId();

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "destructive" | "default";
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "destructive",
    action: async () => {},
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Active Sessions Query
  const sessionsQuery = useQuery({
    queryKey: queryKeys.auth.sessions,
    queryFn: async ({ signal }) => {
      const response = await api.auth.listSessions(signal);
      return response.sessions;
    },
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  // Revoke Single Session Mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return api.auth.revokeSession(sessionId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      if (result.selfRevoked) {
        if (onSignedOut) {
          onSignedOut();
        } else {
          window.location.reload();
        }
      } else {
        setActionSuccess("Session revoked successfully.");
        setTimeout(() => setActionSuccess(null), 4000);
      }
    },
    onError: (err: any) => {
      setActionError(err?.message ?? "Failed to revoke session. Please try again.");
      setTimeout(() => setActionError(null), 5000);
    },
  });

  // Revoke Other Sessions Mutation
  const revokeOthersMutation = useMutation({
    mutationFn: async () => {
      return api.auth.revokeOtherSessions();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
      setActionSuccess(
        result.revokedCount === 1
          ? "1 other active session was revoked."
          : `${result.revokedCount} other active sessions were revoked.`,
      );
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err?.message ?? "Failed to revoke other sessions. Please try again.");
      setTimeout(() => setActionError(null), 5000);
    },
  });

  const handleRevokeSingle = useCallback(
    (session: ActiveSession) => {
      setActionError(null);
      if (session.isCurrent) {
        setConfirmDialog({
          isOpen: true,
          title: "Sign out of this device?",
          description:
            "This will end your current session and sign you out immediately on this browser.",
          confirmLabel: "Sign out",
          variant: "destructive",
          action: async () => {
            await revokeSessionMutation.mutateAsync(session.sessionId);
          },
        });
      } else {
        setConfirmDialog({
          isOpen: true,
          title: "Revoke session?",
          description: `This will sign out the session on ${session.deviceSummary} (${session.approximateRegion}). Any unsaved work on that device will end.`,
          confirmLabel: "Revoke session",
          variant: "destructive",
          action: async () => {
            await revokeSessionMutation.mutateAsync(session.sessionId);
          },
        });
      }
    },
    [revokeSessionMutation],
  );

  const handleRevokeOthers = useCallback(() => {
    setActionError(null);
    setConfirmDialog({
      isOpen: true,
      title: "Revoke all other sessions?",
      description:
        "This will sign out every other active session across all your other devices. Your current session will remain active.",
      confirmLabel: "Revoke all others",
      variant: "destructive",
      action: async () => {
        await revokeOthersMutation.mutateAsync();
      },
    });
  }, [revokeOthersMutation]);

  const sessions = sessionsQuery.data ?? [];
  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-8" data-testid="account-security-section">
      {/* Notifications / Alerts */}
      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 animate-in fade-in"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 animate-in fade-in"
        >
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* 1. Active Sessions & Devices */}
      <section className="space-y-4" aria-labelledby="active-sessions-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="active-sessions-heading" className="text-sm font-medium text-foreground">
              Active sessions & devices
            </h3>
            <p className="text-xs text-muted-foreground">
              Devices and browsers currently authenticated to your account.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={otherSessionsCount === 0 || revokeOthersMutation.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              otherSessionsCount > 0
                ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-[0.98]"
                : "border-white/5 bg-white/[0.02] text-muted-foreground opacity-50 cursor-not-allowed",
            )}
            aria-label="Revoke all other sessions"
          >
            {revokeOthersMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Revoke other sessions {otherSessionsCount > 0 && `(${otherSessionsCount})`}</span>
          </button>
        </div>

        {/* Sessions list */}
        {sessionsQuery.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading active sessions">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-lg border border-white/5 bg-white/[0.02]"
              />
            ))}
          </div>
        ) : sessionsQuery.isError ? (
          <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-400">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              <span>Failed to load active sessions.</span>
            </div>
            <button
              onClick={() => sessionsQuery.refetch()}
              className="rounded border border-red-500/30 px-2 py-1 hover:bg-red-500/10"
            >
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center text-xs text-muted-foreground">
            No active sessions found.
          </div>
        ) : (
          <div className="space-y-2" data-testid="active-sessions-list">
            {sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session.deviceSummary);
              const isRevoking =
                revokeSessionMutation.isPending &&
                revokeSessionMutation.variables === session.sessionId;

              return (
                <div
                  key={session.sessionId}
                  data-testid={`session-row-${session.sessionId}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition",
                    session.isCurrent
                      ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                      : "border-white/5 bg-white/[0.02] hover:border-white/10",
                  )}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                        session.isCurrent
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-white/10 bg-white/[0.04] text-muted-foreground",
                      )}
                    >
                      <DeviceIcon className="h-4 w-4" aria-hidden="true" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">
                          {session.deviceSummary}
                        </span>
                        {session.isCurrent && (
                          <span
                            data-testid="current-session-badge"
                            className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                          >
                            Current session
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>{session.approximateRegion}</span>
                        <span>•</span>
                        <span>Active {formatDate(session.lastActiveAt)}</span>
                        <span>•</span>
                        <span>Created {formatDate(session.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRevokeSingle(session)}
                    disabled={isRevoking}
                    className={cn(
                      "ml-3 shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
                      session.isCurrent
                        ? "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                        : "text-red-400 hover:bg-red-500/10 hover:text-red-300",
                    )}
                    aria-label={`Revoke session on ${session.deviceSummary}`}
                  >
                    {isRevoking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : session.isCurrent ? (
                      "Sign out"
                    ) : (
                      "Revoke"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Recovery Readiness & Code Regeneration */}
      <section className="space-y-3" aria-labelledby="recovery-codes-heading">
        <RecoveryCodesSection />
      </section>

      {/* 3. Linked Wallets Review */}
      <section className="space-y-4" aria-labelledby="linked-wallets-heading">
        <div className="border-t border-white/5 pt-6">
          <h3 id="linked-wallets-heading" className="text-sm font-medium text-foreground mb-1">
            Linked Wallets & Account Custody
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Review linked external wallets and managed on-chain escrow custody.
          </p>

          <div className="space-y-6">
            <ManagedWalletStatus />
            <ExternalWalletSettings ownerAddress={ownerAddress} />
          </div>
        </div>
      </section>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          }
        }}
      >
        <AlertDialogContent aria-labelledby={alertTitleId} aria-describedby={alertDescId}>
          <AlertDialogHeader>
            <AlertDialogTitle id={alertTitleId}>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription id={alertDescId}>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                confirmDialog.variant === "destructive" &&
                  "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
              )}
              onClick={async (e) => {
                e.preventDefault();
                const act = confirmDialog.action;
                setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                await act();
              }}
            >
              {confirmDialog.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
