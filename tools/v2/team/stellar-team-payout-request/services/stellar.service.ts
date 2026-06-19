/**
 * Stellar Service
 *
 * Minimal Stellar network abstraction for the payout request tool.
 * Works against testnet by default. Do not wire into the main app's
 * Stellar core or wallet integration.
 *
 * NOTE: This service uses plain fetch rather than importing the full
 * stellar-sdk at the tool layer so the tool remains self-contained.
 * A future integration issue may swap this for the shared Stellar client.
 */

import type { StellarAccount, TransactionResult, TransactionStatus } from "../types";
import { StellarNetworkError } from "../types";

export type StellarNetwork = "testnet" | "public";

interface ServiceConfig {
  network: StellarNetwork;
  horizonUrl: string;
  networkPassphrase: string;
  /** Base fee in stroops per operation */
  baseFee: number;
}

const DEFAULTS: Record<StellarNetwork, Omit<ServiceConfig, "network">> = {
  testnet: {
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    baseFee: 100,
  },
  public: {
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    baseFee: 100,
  },
};

class StellarService {
  private config: ServiceConfig;

  constructor(network: StellarNetwork = "testnet") {
    this.config = { network, ...DEFAULTS[network] };
  }

  configure(overrides: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...overrides };
  }

  /** Validate that a string is a syntactically valid Stellar public key (G...) */
  isValidAccountId(accountId: string): boolean {
    return /^G[A-Z2-7]{55}$/.test(accountId);
  }

  /**
   * Fetch account details from Horizon.
   * Throws StellarNetworkError if the account does not exist or network fails.
   */
  async getAccount(accountId: string): Promise<StellarAccount> {
    const url = `${this.config.horizonUrl}/accounts/${encodeURIComponent(accountId)}`;
    const res = await fetch(url);

    if (res.status === 404) {
      throw new StellarNetworkError(
        "destination_not_found",
        `Account ${accountId} does not exist on ${this.config.network}`,
      );
    }
    if (!res.ok) {
      throw new StellarNetworkError(
        "horizon_error",
        `Horizon returned ${res.status} for account ${accountId}`,
      );
    }

    const data = (await res.json()) as {
      id: string;
      sequence: string;
      subentry_count: number;
      balances: Array<{ balance: string; asset_type: string }>;
    };

    const xlmBalance = data.balances.find((b) => b.asset_type === "native")?.balance ?? "0.0000000";

    return {
      id: data.id,
      balance: xlmBalance,
      sequenceNumber: data.sequence,
      subentryCount: data.subentry_count,
    };
  }

  /**
   * Estimate the transaction fee for N operations.
   * Returns fee in stroops as a string.
   */
  estimateFee(operationCount = 1): string {
    return String(this.config.baseFee * operationCount);
  }

  /**
   * Fetch transaction status from Horizon.
   */
  async getTransactionStatus(txId: string): Promise<TransactionStatus> {
    const url = `${this.config.horizonUrl}/transactions/${encodeURIComponent(txId)}`;
    const res = await fetch(url);

    if (res.status === 404) {
      return { status: "pending", confirmations: 0 };
    }
    if (!res.ok) {
      throw new StellarNetworkError("horizon_error", `Horizon returned ${res.status} for tx`);
    }

    const data = (await res.json()) as {
      successful: boolean;
      ledger: number;
    };

    return {
      status: data.successful ? "confirmed" : "failed",
      confirmations: data.ledger > 0 ? 1 : 0,
    };
  }

  /**
   * Submit a pre-built transaction envelope XDR to Horizon.
   * In V2 this is a stub — real signing happens outside the tool boundary.
   */
  async submitTransactionEnvelope(envelopeXdr: string): Promise<TransactionResult> {
    const url = `${this.config.horizonUrl}/transactions`;
    const body = new URLSearchParams({ tx: envelopeXdr });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = (await res.json()) as {
      id?: string;
      ledger?: number;
      created_at?: string;
      successful?: boolean;
      extras?: { result_codes?: { transaction?: string } };
    };

    if (!res.ok || data.successful === false) {
      const code = data.extras?.result_codes?.transaction ?? "tx_failed";
      throw new StellarNetworkError(code, `Transaction submission failed: ${code}`);
    }

    return {
      id: data.id ?? "",
      status: "success",
      ledger: data.ledger ?? 0,
      timestamp: data.created_at ?? new Date().toISOString(),
    };
  }

  get networkConfig(): Readonly<ServiceConfig> {
    return this.config;
  }
}

export const stellarService = new StellarService();
