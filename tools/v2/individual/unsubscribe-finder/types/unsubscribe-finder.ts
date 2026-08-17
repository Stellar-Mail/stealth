export const UNSUBSCRIBE_FINDER_TOOL = "unsubscribe-finder" as const;
export const UNSUBSCRIBE_FINDER_VERSION = 1 as const;

export const UNSUBSCRIBE_FINDER_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  EMPTY_SOURCE_MESSAGES: "EMPTY_SOURCE_MESSAGES",
  INVALID_SOURCE_MESSAGE: "INVALID_SOURCE_MESSAGE",
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
} as const;

export const UNSUBSCRIBE_FINDER_REVIEW_NOTES = [
  "The fixture uses synthetic example.test messages only.",
  "Unsafe and body-link-only candidates are intentionally not offered as actions.",
  "Live unsubscribe execution must remain out of scope until a future safety issue defines it.",
] as const;

export type UnsubscribeFinderTool = typeof UNSUBSCRIBE_FINDER_TOOL;
export type UnsubscribeFinderVersion = typeof UNSUBSCRIBE_FINDER_VERSION;
export type UnsubscribeFinderErrorCode =
  (typeof UNSUBSCRIBE_FINDER_ERROR_CODES)[keyof typeof UNSUBSCRIBE_FINDER_ERROR_CODES];

export type UnsubscribeFinderCandidateMethod = "header" | "body-link" | "none";
export type UnsubscribeFinderCandidateStatus = "detected" | "needs-review" | "unsafe" | "ignored";

export interface UnsubscribeFinderSourceMessage {
  id: string;
  type: "email";
  from: string;
  subject: string;
  receivedAt: string;
  hasListUnsubscribeHeader: boolean;
  bodyContainsUnsubscribeLink: boolean;
  isTransactional: boolean;
  linkHost: string | null;
}

export interface UnsubscribeFinderRequest {
  tool: UnsubscribeFinderTool;
  version: UnsubscribeFinderVersion;
  sourceMessages: UnsubscribeFinderSourceMessage[];
}

export interface UnsubscribeFinderCandidate {
  id: string;
  sender: string;
  method: UnsubscribeFinderCandidateMethod;
  status: UnsubscribeFinderCandidateStatus;
  confidence: number;
  safeToOffer: boolean;
  sourceMessageId: string;
  reason: string;
}

export interface UnsubscribeFinderSummary {
  totalMessages: number;
  detected: number;
  needsReview: number;
  unsafe: number;
  ignored: number;
}

export interface UnsubscribeFinderSuccess {
  status: "ok";
  tool: UnsubscribeFinderTool;
  version: UnsubscribeFinderVersion;
  candidates: UnsubscribeFinderCandidate[];
  summary: UnsubscribeFinderSummary;
  reviewNotes: string[];
}

export interface UnsubscribeFinderError {
  code: UnsubscribeFinderErrorCode;
  message: string;
  sourceMessageId?: string;
  invalidFields?: string[];
}

export interface UnsubscribeFinderFailure {
  status: "error";
  tool: UnsubscribeFinderTool;
  version: UnsubscribeFinderVersion;
  error: UnsubscribeFinderError;
}

export type UnsubscribeFinderResponse = UnsubscribeFinderSuccess | UnsubscribeFinderFailure;

export interface UnsubscribeFinderService {
  analyze(request: UnsubscribeFinderRequest): UnsubscribeFinderResponse;
}
