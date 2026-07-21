import {
  UNSUBSCRIBE_FINDER_ERROR_CODES,
  UNSUBSCRIBE_FINDER_REVIEW_NOTES,
  UNSUBSCRIBE_FINDER_TOOL,
  UNSUBSCRIBE_FINDER_VERSION,
} from "../types/index.ts";
import type {
  UnsubscribeFinderCandidate,
  UnsubscribeFinderError,
  UnsubscribeFinderFailure,
  UnsubscribeFinderRequest,
  UnsubscribeFinderResponse,
  UnsubscribeFinderService,
  UnsubscribeFinderSourceMessage,
  UnsubscribeFinderSummary,
} from "../types/index.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createFailure(error: UnsubscribeFinderError): UnsubscribeFinderFailure {
  return {
    status: "error",
    tool: UNSUBSCRIBE_FINDER_TOOL,
    version: UNSUBSCRIBE_FINDER_VERSION,
    error,
  };
}

function normalizeSender(from: string): string {
  const trimmed = from.trim().toLowerCase();
  const angleAddressMatch = trimmed.match(/<([^>]+)>$/);
  const address = angleAddressMatch ? angleAddressMatch[1] : trimmed;
  return address.replace("@", ".");
}

function normalizeHost(host: string | null): string | null {
  return host ? host.trim().toLowerCase() : null;
}

function buildCandidateId(messageId: string): string {
  return messageId.startsWith("message-")
    ? `candidate-${messageId.slice("message-".length)}`
    : `candidate-${messageId}`;
}

function validateSourceMessage(
  value: unknown,
):
  | { valid: true; message: UnsubscribeFinderSourceMessage }
  | { valid: false; invalidFields: string[] } {
  if (!isRecord(value)) {
    return { valid: false, invalidFields: ["id", "type", "from", "subject", "receivedAt"] };
  }

  const invalidFields: string[] = [];

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    invalidFields.push("id");
  }
  if (value.type !== "email") {
    invalidFields.push("type");
  }
  if (typeof value.from !== "string" || value.from.trim().length === 0) {
    invalidFields.push("from");
  }
  if (typeof value.subject !== "string") {
    invalidFields.push("subject");
  }
  if (typeof value.receivedAt !== "string") {
    invalidFields.push("receivedAt");
  }
  if (typeof value.hasListUnsubscribeHeader !== "boolean") {
    invalidFields.push("hasListUnsubscribeHeader");
  }
  if (typeof value.bodyContainsUnsubscribeLink !== "boolean") {
    invalidFields.push("bodyContainsUnsubscribeLink");
  }
  if (typeof value.isTransactional !== "boolean") {
    invalidFields.push("isTransactional");
  }
  if (!(typeof value.linkHost === "string" || value.linkHost === null)) {
    invalidFields.push("linkHost");
  }

  if (invalidFields.length > 0) {
    return { valid: false, invalidFields };
  }

  const id = value.id as string;
  const type = value.type as "email";
  const from = value.from as string;
  const subject = value.subject as string;
  const receivedAt = value.receivedAt as string;
  const hasListUnsubscribeHeader = value.hasListUnsubscribeHeader as boolean;
  const bodyContainsUnsubscribeLink = value.bodyContainsUnsubscribeLink as boolean;
  const isTransactional = value.isTransactional as boolean;
  const linkHost = value.linkHost as string | null;

  return {
    valid: true,
    message: {
      id,
      type,
      from,
      subject,
      receivedAt,
      hasListUnsubscribeHeader,
      bodyContainsUnsubscribeLink,
      isTransactional,
      linkHost,
    },
  };
}

function classifyMessage(message: UnsubscribeFinderSourceMessage): UnsubscribeFinderCandidate {
  const sender = normalizeSender(message.from);
  const senderHost = normalizeHost(message.linkHost);

  if (message.isTransactional) {
    return {
      id: buildCandidateId(message.id),
      sender,
      method: "none",
      status: "ignored",
      confidence: 0,
      safeToOffer: false,
      sourceMessageId: message.id,
      reason: message.subject.toLowerCase().includes("receipt")
        ? "Transactional receipt has no unsubscribe signal."
        : "Transactional message has no unsubscribe signal.",
    };
  }

  if (message.hasListUnsubscribeHeader) {
    return {
      id: buildCandidateId(message.id),
      sender,
      method: "header",
      status: "detected",
      confidence: 0.96,
      safeToOffer: true,
      sourceMessageId: message.id,
      reason: "List-Unsubscribe header is available on a non-transactional newsletter.",
    };
  }

  if (message.bodyContainsUnsubscribeLink) {
    const status = senderHost !== null && senderHost === sender ? "needs-review" : "unsafe";

    return {
      id: buildCandidateId(message.id),
      sender,
      method: "body-link",
      status,
      confidence: status === "needs-review" ? 0.74 : 0.2,
      safeToOffer: false,
      sourceMessageId: message.id,
      reason:
        status === "needs-review"
          ? "Body-only unsubscribe link should be reviewed before action."
          : "Suspicious sender context and unknown link host make the action unsafe.",
    };
  }

  return {
    id: buildCandidateId(message.id),
    sender,
    method: "none",
    status: "ignored",
    confidence: 0,
    safeToOffer: false,
    sourceMessageId: message.id,
    reason: "No unsubscribe signal was detected.",
  };
}

function summarizeCandidates(candidates: UnsubscribeFinderCandidate[]): UnsubscribeFinderSummary {
  return candidates.reduce(
    (summary, candidate) => {
      summary.totalMessages += 1;
      if (candidate.status === "detected") {
        summary.detected += 1;
      }
      if (candidate.status === "needs-review") {
        summary.needsReview += 1;
      }
      if (candidate.status === "unsafe") {
        summary.unsafe += 1;
      }
      if (candidate.status === "ignored") {
        summary.ignored += 1;
      }
      return summary;
    },
    {
      totalMessages: 0,
      detected: 0,
      needsReview: 0,
      unsafe: 0,
      ignored: 0,
    },
  );
}

export function analyzeUnsubscribeCandidates(
  request: UnsubscribeFinderRequest,
): UnsubscribeFinderResponse {
  if (!isRecord(request)) {
    return createFailure({
      code: UNSUBSCRIBE_FINDER_ERROR_CODES.INVALID_REQUEST,
      message: "The unsubscribe-finder request must be an object.",
    });
  }

  if (request.tool !== UNSUBSCRIBE_FINDER_TOOL) {
    return createFailure({
      code: UNSUBSCRIBE_FINDER_ERROR_CODES.INVALID_REQUEST,
      message: "The unsubscribe-finder request must set tool to unsubscribe-finder.",
    });
  }

  if (request.version !== UNSUBSCRIBE_FINDER_VERSION) {
    return createFailure({
      code: UNSUBSCRIBE_FINDER_ERROR_CODES.UNSUPPORTED_VERSION,
      message: `Unsupported unsubscribe-finder version ${String(request.version)}.`,
    });
  }

  if (!Array.isArray(request.sourceMessages)) {
    return createFailure({
      code: UNSUBSCRIBE_FINDER_ERROR_CODES.INVALID_REQUEST,
      message: "The unsubscribe-finder request must include a sourceMessages array.",
    });
  }

  if (request.sourceMessages.length === 0) {
    return createFailure({
      code: UNSUBSCRIBE_FINDER_ERROR_CODES.EMPTY_SOURCE_MESSAGES,
      message: "At least one source message is required.",
    });
  }

  for (const value of request.sourceMessages) {
    const validation = validateSourceMessage(value);
    if (!validation.valid) {
      const sourceMessageId =
        isRecord(value) && typeof value.id === "string" ? value.id : undefined;
      return createFailure({
        code: UNSUBSCRIBE_FINDER_ERROR_CODES.INVALID_SOURCE_MESSAGE,
        message:
          "Each source message must include string fields for id, type, from, subject, and receivedAt.",
        sourceMessageId,
        invalidFields: validation.invalidFields,
      });
    }
  }

  const candidates = request.sourceMessages.map((message) => classifyMessage(message));

  return {
    status: "ok",
    tool: UNSUBSCRIBE_FINDER_TOOL,
    version: UNSUBSCRIBE_FINDER_VERSION,
    candidates,
    summary: summarizeCandidates(candidates),
    reviewNotes: [...UNSUBSCRIBE_FINDER_REVIEW_NOTES],
  };
}

export function createUnsubscribeFinderService(): UnsubscribeFinderService {
  return {
    analyze: analyzeUnsubscribeCandidates,
  };
}
