import React from "react";
import { useWalletStatus } from "@/features/settings/useWalletStatus";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletIcon, AlertCircleIcon, RefreshCwIcon } from "lucide-react";

export function PostageBalanceBadge() {
  const { ui } = useWalletStatus();

  if (ui.kind === "loading") {
    return <Skeleton className="h-6 w-24" />;
  }

  if (ui.kind === "failed" || ui.kind === "unavailable") {
    return (
      <Badge variant="outline" className="text-muted-foreground gap-1">
        <AlertCircleIcon className="w-3 h-3" />
        Balance unavailable
      </Badge>
    );
  }

  // Active, Stale, Pending
  const isStale = ui.kind === "stale";
  const balance = ui.status.balanceXlm ?? "0";

  return (
    <Badge variant="secondary" className={`gap-1 ${isStale ? "opacity-70" : ""}`}>
      <WalletIcon className="w-3 h-3 text-muted-foreground" />
      <span>{balance} XLM</span>
      {isStale && <RefreshCwIcon className="w-3 h-3 text-amber-500 ml-1" aria-label="Stale" />}
    </Badge>
  );
}
