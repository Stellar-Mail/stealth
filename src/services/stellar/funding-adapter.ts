import type { FundingErrorClass } from "../../server/api/domain";
import { DEFAULT_TESTNET_FRIENDBOT_URL } from "./funding-config";

export interface FundAccountResult {
  funded: boolean;
  transactionId?: string;
}

export interface StellarFundingAdapter {
  fundAccount(publicKey: string): Promise<FundAccountResult>;
}

export class FundingError extends Error {
  readonly errorClass: FundingErrorClass;
  readonly code: string;
  readonly httpStatus?: number;
  readonly alreadyFunded: boolean;

  constructor(
    message: string,
    options: {
      errorClass: FundingErrorClass;
      code: string;
      httpStatus?: number;
      alreadyFunded?: boolean;
    },
  ) {
    super(message);
    this.name = "FundingError";
    this.errorClass = options.errorClass;
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.alreadyFunded = options.alreadyFunded === true;
  }
}

export class FriendbotFundingAdapter implements StellarFundingAdapter {
  constructor(
    private readonly friendbotUrl: string = DEFAULT_TESTNET_FRIENDBOT_URL,
    private readonly timeoutMs = 8_000,
  ) {}

  async fundAccount(publicKey: string): Promise<FundAccountResult> {
    const url = `${this.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        throw new FundingError("Funding request timed out", {
          errorClass: "transient",
          code: "timeout",
        });
      }
      throw new FundingError("Funding provider is unreachable", {
        errorClass: "transient",
        code: "network_error",
      });
    }

    const payload = (await response.json().catch(() => ({}))) as {
      hash?: string;
      detail?: string;
      title?: string;
      extras?: { result_codes?: { operations?: string[] } };
    };
    const bodyText = `${payload.detail ?? ""} ${payload.title ?? ""} ${JSON.stringify(payload.extras ?? {})}`;

    if (
      /already (exists|funded|created)/i.test(bodyText) ||
      payload.extras?.result_codes?.operations?.includes("op_already_exists")
    ) {
      return {
        funded: true,
        transactionId: typeof payload.hash === "string" ? payload.hash : undefined,
      };
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new FundingError(`Friendbot funding failed with status ${response.status}`, {
          errorClass: "transient",
          code: "rate_limited",
          httpStatus: response.status,
        });
      }
      if (response.status >= 500 || response.status === 408) {
        throw new FundingError(`Friendbot funding failed with status ${response.status}`, {
          errorClass: "transient",
          code: "dependency_unavailable",
          httpStatus: response.status,
        });
      }
      throw new FundingError(`Friendbot funding failed with status ${response.status}`, {
        errorClass: "permanent",
        code: "invalid_account",
        httpStatus: response.status,
      });
    }

    return {
      funded: true,
      transactionId: typeof payload.hash === "string" ? payload.hash : undefined,
    };
  }
}

export type FakeFundingFailure =
  | "timeout"
  | "rate_limited"
  | "invalid"
  | "exhausted"
  | "already_funded"
  | "generic";

/** Deterministic in-memory funding adapter for unit/integration tests. */
export class FakeFundingAdapter implements StellarFundingAdapter {
  readonly fundedAccounts = new Set<string>();
  readonly failures = new Set<string>();
  readonly callCounts = new Map<string, number>();
  readonly failureMode = new Map<string, FakeFundingFailure>();
  readonly remainingFailures = new Map<string, number>();
  globalMode?: FakeFundingFailure;

  failAll(mode: FakeFundingFailure): void {
    this.globalMode = mode;
  }

  async fundAccount(publicKey: string): Promise<FundAccountResult> {
    this.callCounts.set(publicKey, (this.callCounts.get(publicKey) ?? 0) + 1);

    const remaining = this.remainingFailures.get(publicKey) ?? 0;
    const mode = remaining > 0 ? this.failureMode.get(publicKey) : (this.globalMode ?? undefined);
    if (remaining > 0) {
      this.remainingFailures.set(publicKey, remaining - 1);
      if (remaining - 1 <= 0) {
        this.remainingFailures.delete(publicKey);
        this.failureMode.delete(publicKey);
      }
    }

    if (mode === "already_funded") {
      this.fundedAccounts.add(publicKey);
      throw new FundingError("Account already exists", {
        errorClass: "permanent",
        code: "already_funded",
        alreadyFunded: true,
      });
    }
    if (mode === "timeout") {
      throw new FundingError("Funding request timed out", {
        errorClass: "transient",
        code: "timeout",
      });
    }
    if (mode === "rate_limited") {
      throw new FundingError("Friendbot funding failed with status 429", {
        errorClass: "transient",
        code: "rate_limited",
        httpStatus: 429,
      });
    }
    if (mode === "invalid") {
      throw new FundingError("Invalid public key", {
        errorClass: "permanent",
        code: "invalid_account",
        httpStatus: 400,
      });
    }
    if (mode === "exhausted") {
      throw new FundingError("Funding source exhausted", {
        errorClass: "permanent",
        code: "funding_source_exhausted",
      });
    }
    if (mode === "generic" || this.failures.has(publicKey)) {
      throw new Error("Simulated funding failure");
    }

    if (this.fundedAccounts.has(publicKey)) {
      return { funded: true, transactionId: `fake-tx-${publicKey.slice(0, 8)}` };
    }

    this.fundedAccounts.add(publicKey);
    return { funded: true, transactionId: `fake-tx-${publicKey.slice(0, 8)}` };
  }

  failNext(publicKey: string, mode: FakeFundingFailure, times = 1): void {
    this.failureMode.set(publicKey, mode);
    this.remainingFailures.set(publicKey, times);
  }
}

export function createFundingAdapter(
  options: {
    friendbotUrl?: string;
    useFake?: boolean;
  } = {},
): StellarFundingAdapter {
  if (options.useFake) {
    return new FakeFundingAdapter();
  }
  return new FriendbotFundingAdapter(options.friendbotUrl ?? DEFAULT_TESTNET_FRIENDBOT_URL);
}
