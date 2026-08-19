import { AlertTriangle, RefreshCw, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import { useWalletStatus, type WalletStatusUiState } from "./useWalletStatus";

function activationLabel(kind: WalletStatusUiState["kind"]): string {
  switch (kind) {
    case "pending":
      return "Activation pending";
    case "active":
      return "Active";
    case "stale":
      return "May be out of date";
    case "unavailable":
      return "Network unavailable";
    case "failed":
      return "Activation failed";
    default:
      return "Loading";
  }
}

export function ManagedWalletStatus() {
  const { ui, refetch, isFetching } = useWalletStatus();
  const status = "status" in ui ? ui.status : undefined;

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Managed testnet wallet</p>
            <p className="text-xs text-muted-foreground">
              Public address and balance only — custody keys stay on the server.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-lg border border-white/10 p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
          aria-label="Refresh wallet status"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            ui.kind === "active" && "bg-emerald-500/15 text-emerald-300",
            ui.kind === "pending" && "bg-amber-500/15 text-amber-300",
            ui.kind === "stale" && "bg-amber-500/15 text-amber-300",
            (ui.kind === "unavailable" || ui.kind === "failed") && "bg-red-500/15 text-red-300",
            ui.kind === "loading" && "bg-white/10 text-muted-foreground",
          )}
        >
          {activationLabel(ui.kind)}
        </span>
        {ui.kind === "stale" || ui.kind === "unavailable" ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
        ) : null}
      </div>

      {ui.kind === "loading" ? (
        <p className="text-xs text-muted-foreground">Loading wallet status…</p>
      ) : (
        <dl className="grid gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Public address</dt>
            <dd className="mt-0.5 break-all font-mono text-foreground">
              {status?.address ?? "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Testnet balance</dt>
            <dd className="mt-0.5 text-foreground">
              {status?.balanceXlm == null ? "Unknown" : `${status.balanceXlm} XLM`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Network</dt>
            <dd className="mt-0.5 text-foreground">{status?.network ?? "testnet"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last sync</dt>
            <dd className="mt-0.5 text-foreground">{status?.lastSyncedAt ?? "Never"}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
