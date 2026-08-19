import { describe, expect, it } from "vitest";

import { Route } from "../../../src/routes/api/v1/postage/index";
import { getApiContext, createApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  quotePostage,
  verifyQuoteSubmission,
  type PostageQuoteResult,
  type QuoteSubmissionInput,
} from "../../../src/server/api/postage-service";
import {
  StaticPostageAssetProvider,
  type PostageAssetInfo,
} from "../../../src/server/api/postage-asset-service";
import type { ApiRepository } from "../../../src/server/api/repository";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const MSG_ID = "a".repeat(64);
const OTHER_MSG_ID = "b".repeat(64);
const PAYMENT_HASH = "c".repeat(64);

const FIXED_ASSET: PostageAssetInfo = {
  asset: `G${"D".repeat(55)}`,
  minimum: "0",
  feeBps: 100,
  expirySeconds: 604800,
  disputeSeconds: 604800,
  network: "Test SDF Network ; September 2015",
  source: "configured",
};

function buildSubmission(
  quote: PostageQuoteResult,
  overrides: Partial<QuoteSubmissionInput> = {},
): QuoteSubmissionInput & { paymentHash: string } {
  return {
    amount: quote.amount,
    messageId: MSG_ID,
    paymentHash: PAYMENT_HASH,
    recipient,
    sender,
    asset: quote.asset,
    policyVersion: quote.policyVersion,
    network: quote.network,
    issuedAt: quote.issuedAt,
    expiresAt: quote.expiresAt,
    quoteDigest: quote.digest,
    ...overrides,
  };
}

async function setupPolicy(repo: ApiRepository, minimumPostage = "100") {
  await repo.setPolicy(recipient, {
    allowUnknown: true,
    minimumPostage,
    requireVerified: false,
  });
}

// ---------------------------------------------------------------------------
// Service-level: quote binding, fee/balance guidance, deterministic failures
// ---------------------------------------------------------------------------

describe("authenticated postage quote binding (BETA-039)", () => {
  it("quotes zero postage for a trusted sender and binds all fields", async () => {
    const repo = new MemoryApiRepository();
    await setupPolicy(repo);
    await repo.setSenderRule(recipient, sender, "allow");
    const provider = new StaticPostageAssetProvider(FIXED_ASSET, {
      available: "1000000",
      sufficient: null,
    });

    const quote = await quotePostage(
      createApiContext(repo),
      { recipient, sender, messageId: MSG_ID },
      { assetProvider: provider },
    );

    expect(quote).toMatchObject({
      amount: "0",
      eligible: true,
      reason: "trusted_sender",
      trusted: true,
      messageId: MSG_ID,
      asset: FIXED_ASSET.asset,
      policyVersion: 0,
      network: FIXED_ASSET.network,
      fee: { bps: 100, amount: "0" },
    });
    expect(quote.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("exposes fee, balance guidance and retry guidance", async () => {
    const repo = new MemoryApiRepository();
    await setupPolicy(repo);
    const provider = new StaticPostageAssetProvider(FIXED_ASSET, {
      available: "1000000",
      sufficient: null,
    });

    const quote = await quotePostage(
      createApiContext(repo),
      { recipient, sender, messageId: MSG_ID },
      { assetProvider: provider },
    );

    expect(quote.amount).toBe("100");
    expect(quote.fee).toEqual({ bps: 100, amount: "1" });
    expect(quote.balance).toEqual({ available: "1000000", sufficient: true });
    expect(quote.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("marks an observed insufficient balance as ineligible", async () => {
    const repo = new MemoryApiRepository();
    await setupPolicy(repo);
    const provider = new StaticPostageAssetProvider(FIXED_ASSET, {
      available: "50",
      sufficient: null,
    });

    const quote = await quotePostage(
      createApiContext(repo),
      { recipient, sender, messageId: MSG_ID },
      { assetProvider: provider },
    );

    expect(quote).toMatchObject({
      amount: "100",
      eligible: false,
      reason: "insufficient_balance",
      balance: { available: "50", sufficient: false },
    });
  });

  it("changes the digest when the message identity changes", async () => {
    const repo = new MemoryApiRepository();
    await setupPolicy(repo);
    const provider = new StaticPostageAssetProvider(FIXED_ASSET);

    const quoteA = await quotePostage(
      createApiContext(repo),
      { recipient, sender, messageId: MSG_ID },
      { assetProvider: provider },
    );
    const quoteB = await quotePostage(
      createApiContext(repo),
      { recipient, sender, messageId: OTHER_MSG_ID },
      { assetProvider: provider },
    );

    expect(quoteA.digest).not.toBe(quoteB.digest);
  });

  it("rejects a quote submitted after expiry (clock boundary)", async () => {
    const repo = new MemoryApiRepository();
    await setupPolicy(repo);
    const provider = new StaticPostageAssetProvider(FIXED_ASSET);
    const now = new Date("2026-08-01T12:00:00.000Z");

    const quote = await quotePostage(
      createApiContext(repo),
      { recipient, sender, messageId: MSG_ID },
      { assetProvider: provider, now: () => now },
    );

    // At the exact expiry instant the quote is no longer valid.
    await expect(
      verifyQuoteSubmission(createApiContext(repo), buildSubmission(quote), {
        assetProvider: provider,
        now: () => new Date("2026-08-01T12:15:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "expired_challenge", status: 422 });
  });

  it("rejects a quote that has become policy-stale", async () => {
    const repo = new MemoryApiRepository();
    await setupPolicy(repo);
    await repo.setPolicyWriteIntent({
      owner: recipient,
      policy: {
        allowUnknown: true,
        minimumPostage: "100",
        requireReceipt: false,
        requireVerified: false,
      },
      offchainVersion: 1,
      status: "pending",
      scheduledAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z",
      failureCount: 0,
      lastError: null,
      txHash: null,
    });
    const provider = new StaticPostageAssetProvider(FIXED_ASSET);

    const quote = await quotePostage(
      createApiContext(repo),
      { recipient, sender, messageId: MSG_ID },
      { assetProvider: provider },
    );
    expect(quote.policyVersion).toBe(1);

    // The policy changes, bumping the off-chain version to 2.
    await repo.setPolicyWriteIntent({
      owner: recipient,
      policy: {
        allowUnknown: true,
        minimumPostage: "200",
        requireReceipt: false,
        requireVerified: false,
      },
      offchainVersion: 2,
      status: "pending",
      scheduledAt: "2026-08-01T12:01:00.000Z",
      updatedAt: "2026-08-01T12:01:00.000Z",
      failureCount: 0,
      lastError: null,
      txHash: null,
    });

    await expect(
      verifyQuoteSubmission(createApiContext(repo), buildSubmission(quote), {
        assetProvider: provider,
      }),
    ).rejects.toMatchObject({
      code: "invalid_quote",
      status: 422,
      details: { expectedPolicyVersion: 2, suppliedPolicyVersion: 1 },
    });
  });
});

// ---------------------------------------------------------------------------
// Route-level: the real submission journey
// ---------------------------------------------------------------------------

describe("authenticated postage quote submission route", () => {
  const handler = (Route.options as any).server?.handlers?.POST;

  async function submitWithQuote(
    quote: PostageQuoteResult,
    overrides: Record<string, unknown> = {},
  ) {
    const context = await getApiContext();
    (context.repository as any).reset();
    await setupPolicy(context.repository);

    const req = new Request("https://stealth.test/api/v1/postage", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-stealth-address": sender,
      },
      body: JSON.stringify(buildSubmission(quote, overrides)),
    });
    return handler!({ request: req });
  }

  async function issueQuote(messageId = MSG_ID) {
    const context = await getApiContext();
    (context.repository as any).reset();
    await setupPolicy(context.repository);
    return quotePostage(context, { recipient, sender, messageId });
  }

  it("accepts a valid quote bound to the message", async () => {
    const context = await getApiContext();
    (context.repository as any).reset();
    await setupPolicy(context.repository);
    const quote = await quotePostage(context, { recipient, sender, messageId: MSG_ID });

    const req = new Request("https://stealth.test/api/v1/postage", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-stealth-address": sender,
      },
      body: JSON.stringify(buildSubmission(quote)),
    });
    const res = await handler!({ request: req });
    expect(res.status).toBe(201);
  });

  it("rejects a quote reused for a different message", async () => {
    const quote = await issueQuote(MSG_ID);
    const res = await submitWithQuote(quote, { messageId: OTHER_MSG_ID });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("invalid_quote");
  });

  it("rejects a quote reused for a different recipient", async () => {
    const quote = await issueQuote(MSG_ID);
    const res = await submitWithQuote(quote, { recipient: `G${"E".repeat(55)}` });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("invalid_quote");
  });

  it("rejects a tampered amount on submission", async () => {
    const quote = await issueQuote(MSG_ID);
    const res = await submitWithQuote(quote, { amount: "999" });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("invalid_quote");
  });

  it("rejects a quote bound to the wrong testnet asset", async () => {
    const quote = await issueQuote(MSG_ID);
    const res = await submitWithQuote(quote, { asset: `G${"F".repeat(55)}` });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("invalid_quote");
  });
});
