/** Shared loading state types for all demo-admin-dashboard flows. */

export type LoadingStatus = "idle" | "loading" | "success" | "error";

export interface FlowLoadingState {
  status: LoadingStatus;
  /** 0–100, used for flows with deterministic steps */
  progress?: number;
  /** Human-readable label shown below a progress bar or spinner */
  label?: string;
  error?: string;
}

export interface ImportLoadingState extends FlowLoadingState {
  /** Total records expected from the source fixture */
  totalRecords?: number;
  /** Records processed so far */
  processedRecords?: number;
}

export interface ValidationLoadingState extends FlowLoadingState {
  /** Number of records being validated */
  totalRecords?: number;
  passCount?: number;
  failCount?: number;
}

export interface PreviewLoadingState extends FlowLoadingState {
  /** Which preview section is rendering */
  section?: "inbox" | "thread" | "calendar" | "contacts";
}

export interface PublishLoadingState extends FlowLoadingState {
  /** Fake transaction ID for UI display only — no real Stellar tx */
  mockTxId?: string;
}
