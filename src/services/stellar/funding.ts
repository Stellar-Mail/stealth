import type { ApiRepository } from "../../server/api/repository";
import type {
  FundingErrorClass,
  FundingOperation,
  PublicFundingOperation,
} from "../../server/api/domain";
import { toPublicFundingOperation } from "../../server/api/domain";
import { FundingError, type StellarFundingAdapter } from "./funding-adapter";
import { enforceCapability } from "@/server/api/beta-controls/guard";

export { FundingError };

export const MAX_FUNDING_ATTEMPTS = 5;
export const FUNDING_BACKOFF_BASE_MS = 1_000;
export const FUNDING_BACKOFF_CAP_MS = 16_000;

export type FundingClassification = {
  errorClass: FundingErrorClass;
  code: string;
  message: string;
  alreadyFunded: boolean;
};

export function fundingOperationIdForUser(userId: string): string {
  return `fund:${userId}`;
}

export function redactFundingMessage(message: string): string {
  return message
    .replace(/S[A-Z0-9]{55,}/g, "[redacted-secret]")
    .replace(/secret[^=\s]*=\S+/gi, "secret=[redacted]")
    .slice(0, 300);
}

export function computeFundingBackoffMs(attempt: number): number {
  const exponential = FUNDING_BACKOFF_BASE_MS * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(FUNDING_BACKOFF_CAP_MS, exponential);
}

export function classifyFundingFailure(error: unknown): FundingClassification {
  if (error instanceof FundingError) {
    return {
      errorClass: error.errorClass,
      code: error.code,
      message: redactFundingMessage(error.message),
      alreadyFunded: error.alreadyFunded,
    };
  }

  const name = error instanceof Error ? error.name : "";
  const raw = error instanceof Error ? error.message : "Funding failed";
  const message = redactFundingMessage(raw);

  if (name === "AbortError" || name === "TimeoutError" || /time\s*out|timed\s+out/i.test(raw)) {
    return {
      errorClass: "transient",
      code: "timeout",
      message: "Funding request timed out",
      alreadyFunded: false,
    };
  }

  if (/already (exists|funded|created)|op_already_exists/i.test(raw)) {
    return {
      errorClass: "permanent",
      code: "already_funded",
      message: "Account is already funded",
      alreadyFunded: true,
    };
  }

  if (/invalid (account|address|public key)/i.test(raw)) {
    return {
      errorClass: "permanent",
      code: "invalid_account",
      message: "Account address is invalid",
      alreadyFunded: false,
    };
  }

  if (/insufficient|exhausted|funding source/i.test(raw)) {
    return {
      errorClass: "permanent",
      code: "funding_source_exhausted",
      message: "Funding source is exhausted",
      alreadyFunded: false,
    };
  }

  const statusMatch = raw.match(/status (\d{3})/i);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;
  if (status === 429) {
    return {
      errorClass: "transient",
      code: "rate_limited",
      message: "Funding provider rate-limited the request",
      alreadyFunded: false,
    };
  }
  if (
    status === 408 ||
    status === 425 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return {
      errorClass: "transient",
      code: "dependency_unavailable",
      message: "Funding provider is temporarily unavailable",
      alreadyFunded: false,
    };
  }
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 402 ||
    status === 422
  ) {
    return {
      errorClass: "permanent",
      code: "invalid_account",
      message: "Funding provider rejected the account",
      alreadyFunded: false,
    };
  }

  if (/network|fetch failed|ECONNRESET|ENOTFOUND|ECONNREFUSED/i.test(raw)) {
    return {
      errorClass: "transient",
      code: "network_error",
      message: "Funding dependency is unavailable",
      alreadyFunded: false,
    };
  }

  return {
    errorClass: "transient",
    code: "funding_failed",
    message,
    alreadyFunded: false,
  };
}

function newOperation(userId: string, address: string, now: Date): FundingOperation {
  const nowIso = now.toISOString();
  return {
    operationId: fundingOperationIdForUser(userId),
    userId,
    address,
    status: "pending",
    attempt: 0,
    maxAttempts: MAX_FUNDING_ATTEMPTS,
    nextRetryAt: null,
    lastErrorClass: null,
    lastError: null,
    transactionId: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function isDue(operation: FundingOperation, now: Date): boolean {
  if (operation.status === "pending") return true;
  if (operation.status !== "retrying") return false;
  if (!operation.nextRetryAt) return true;
  return now.getTime() >= new Date(operation.nextRetryAt).getTime();
}

/**
 * Execute (or resume) the durable funding operation for one account.
 *
 * Idempotent across worker restarts: the operation ID is derived from `userId`,
 * succeeded operations are never re-funded, and duplicate callbacks that report
 * an already-funded account are treated as success.
 */
export async function runFundingOperation(options: {
  repository: ApiRepository;
  adapter: StellarFundingAdapter;
  userId: string;
  address: string;
  now?: Date;
}): Promise<FundingOperation> {
  const now = options.now ?? new Date();
  const created = await options.repository.createFundingOperationIfAbsent(
    newOperation(options.userId, options.address, now),
  );
  const current = created.operation;

  if (current.status === "succeeded" || current.status === "failed") {
    return current;
  }

  if (!isDue(current, now)) {
    return current;
  }

  try {
    // BETA-095: operator kill switch for funding. Fails closed. This is the
    // path actually invoked by managed-wallet provisioning (via
    // ensureManagedWalletFunded), so the gate must live here rather than on
    // the unused fundManagedWalletAccount helper.
    await enforceCapability("funding");
    const result = await options.adapter.fundAccount(options.address);
    const succeeded: FundingOperation = {
      ...current,
      status: "succeeded",
      attempt: current.attempt + 1,
      nextRetryAt: null,
      lastErrorClass: null,
      lastError: null,
      transactionId: result.transactionId ?? current.transactionId,
      updatedAt: now.toISOString(),
    };
    return options.repository.setFundingOperation(succeeded);
  } catch (error) {
    const classified = classifyFundingFailure(error);
    if (classified.alreadyFunded) {
      const succeeded: FundingOperation = {
        ...current,
        status: "succeeded",
        attempt: current.attempt + 1,
        nextRetryAt: null,
        lastErrorClass: null,
        lastError: null,
        transactionId: current.transactionId,
        updatedAt: now.toISOString(),
      };
      return options.repository.setFundingOperation(succeeded);
    }

    const attempt = current.attempt + 1;
    const exhausted = classified.errorClass === "permanent" || attempt >= current.maxAttempts;
    const failed: FundingOperation = {
      ...current,
      status: exhausted ? "failed" : "retrying",
      attempt,
      nextRetryAt: exhausted
        ? null
        : new Date(now.getTime() + computeFundingBackoffMs(attempt)).toISOString(),
      lastErrorClass: classified.errorClass,
      lastError: classified.message,
      updatedAt: now.toISOString(),
    };
    return options.repository.setFundingOperation(failed);
  }
}

export interface FundingQueueQuery {
  status?: FundingOperation["status"];
  limit?: number;
}

export async function listPublicFundingQueue(
  repository: ApiRepository,
  query: FundingQueueQuery = {},
): Promise<PublicFundingOperation[]> {
  const operations = await repository.listFundingOperations({
    status: query.status,
    limit: query.limit ?? 50,
  });
  return operations.map(toPublicFundingOperation);
}
