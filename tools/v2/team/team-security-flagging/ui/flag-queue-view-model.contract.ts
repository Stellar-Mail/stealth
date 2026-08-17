import type {
  SecurityFlag,
  SecurityFlagCategory,
  SecurityFlagSeverity,
  SecurityFlagStatus,
} from "../types";

/** Loading lifecycle phase fed into the view-model. */
export type FlagQueuePhase = "loading" | "loaded" | "error";

export type FlagQueueError = {
  code?: string;
  message: string;
};

export type FlagQueueInput = {
  phase: FlagQueuePhase;
  flags?: readonly SecurityFlag[];
  error?: FlagQueueError;
  selectedFlagId?: string;
};

export type AriaLivePoliteness = "off" | "polite" | "assertive";

export type QueueRegion = {
  role: string;
  ariaLabel: string;
  ariaLive: AriaLivePoliteness;
  ariaBusy: boolean;
};

export type KeyboardShortcut = {
  keys: readonly string[];
  action: string;
  description: string;
};

export type SeverityPresentation = {
  label: string;
  srLabel: string;
  order: number;
  tone: string;
};

export type StatusPresentation = {
  label: string;
  description: string;
  isTerminal: boolean;
};

export type FlagRowView = {
  id: string;
  rowId: string;
  tabIndex: 0 | -1;
  selected: boolean;
  ariaLabel: string;
  subject: string;
  senderEmail: string;
  severity: SeverityPresentation & { value: SecurityFlagSeverity };
  status: StatusPresentation & { value: SecurityFlagStatus };
  category: { value: SecurityFlagCategory; label: string };
};

export type QueueSummary = {
  total: number;
  bySeverity: Record<SecurityFlagSeverity, number>;
  byStatus: Record<SecurityFlagStatus, number>;
};

type QueueViewBase = {
  region: QueueRegion;
  heading: string;
  announcement: string;
  focusTargetId: string;
  keyboardShortcuts: readonly KeyboardShortcut[];
};

export type FlagQueueLoadingView = QueueViewBase & { state: "loading" };

export type FlagQueueErrorView = QueueViewBase & {
  state: "error";
  error: FlagQueueError & { retryActionId: string };
};

export type FlagQueueEmptyView = QueueViewBase & {
  state: "empty";
  guidance: string;
};

export type FlagQueueSuccessView = QueueViewBase & {
  state: "success";
  items: readonly FlagRowView[];
  summary: QueueSummary;
};

export type FlagQueueView =
  | FlagQueueLoadingView
  | FlagQueueErrorView
  | FlagQueueEmptyView
  | FlagQueueSuccessView;
