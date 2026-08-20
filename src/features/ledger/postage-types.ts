import type { PostageStatus } from "@/lib/api";

export type PostageAction = "settle" | "refund" | "dispute" | "expire" | "reclaim";

export interface PostageActionPermission {
  canSettle: boolean;
  canRefund: boolean;
  canDispute: boolean;
  canExpire: boolean;
  canReclaim: boolean;
}

export interface PostageTimelineEvent {
  id: string;
  label: string;
  timestamp: string | null;
  status: "completed" | "current" | "upcoming";
  description?: string;
  txHash?: string;
}

export type ExplorerNetwork = "testnet" | "public";

export interface ExplorerLinkOptions {
  network?: ExplorerNetwork;
}
