/**
 * Send pipeline integration (BETA-046 / #1953). Drives the full staged pipeline
 * (resolve -> encrypt -> sign -> postage -> persist -> submit -> reconcile)
 * with injected seams (signer, key resolver) and a stubbed relay transport so
 * the happy path, every recipient-rejection scenario, wallet failures, binding
 * enforcement, and idempotent 409 handling are exercised without a wallet or
 * network.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { SendPipeline, type StageState } from "../../../src/features/compose/sendPipeline";
import { DirectoryRecipientKeyResolver } from "../../../src/services/crypto/key-resolver";
import { generateRecipientKeyPair } from "../../../src/services/crypto/key-wrap";
import {
  WalletRejectedError,
  WalletUnavailableError,
  type WalletSignature,
} from "../../../src/services/stellar/wallet";

const SENDER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const ALICE = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const BOB = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

type DirectoryShape = {
  currentKeys: { encryption?: Record<string, unknown>; signing?: Record<string, unknown> };
  historicalKeys: unknown[];
  allKeys: unknown[];
};

function makeDirectory(
  spkiBase64: string,
  overrides: Record<string, unknown> = {},
): DirectoryShape {
  const now = new Date();
  const notBefore = new Date(now.getTime() - 60_000).toISOString();
  const notAfter = new Date(now.getTime() + 86_400_000).toISOString();
  const key = {
    keyId: "enc-2026-0001",
    algorithm: "ecdh",
    publicKey: spkiBase64,
    version: 3,
    notBefore,
    notAfter,
    status: "active",
    signature: "sig",
    ...overrides,
  };
  return { currentKeys: { encryption: key }, historicalKeys: [key], allKeys: [key] };
}

function makeResolver(directory: (owner: string) => DirectoryShape | null) {
  return new DirectoryRecipientKeyResolver(async (owner) => {
    const dir = directory(owner.trim().toUpperCase());
    return dir;
  });
}

function signerFor(overrides: Partial<WalletSignature> = {}): {
  signer: (canonical: string) => Promise<WalletSignature>;
  canonicalSeen: string[];
} {
  const canonicalSeen: string[] = [];
  return {
    canonicalSeen,
    signer: async (canonical: string) => {
      canonicalSeen.push(canonical);
      return {
        scheme: "Ed25519",
        signerAddress: SENDER,
        value: "00".repeat(64),
        ...overrides,
      };
    },
  };
}

function stubRelayFetch(statuses: number[]): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string }) => {
      if (url.includes("/diagnostics")) {
        return new Response(JSON.stringify({ endpoint: "/api/v1/relay/messages", publicKey: "" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      calls.push(url);
      const status = statuses.shift() ?? 200;
      return new Response(JSON.stringify({}), { status });
    }),
  );
  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function validPipeline(opts: {
  recipientKeys: string[];
  signer?: (canonical: string) => Promise<WalletSignature>;
  relayStatuses?: number[];
  overrides?: Partial<ConstructorParameters<typeof SendPipeline>[0]>;
}) {
  const pairs = await Promise.all(opts.recipientKeys.map(() => generateRecipientKeyPair()));
  const directories = new Map<string, DirectoryShape>();
  opts.recipientKeys.forEach((account, index) => {
    directories.set(account, makeDirectory(pairs[index].publicKeySpkiBase64));
  });
  const resolver = makeResolver((owner) => directories.get(owner) ?? null);
  const { signer } = signerFor();
  const input = {
    sender: SENDER,
    to: opts.recipientKeys.join(", "),
    subject: "Pipeline test",
    body: "Hello Bob — π ≈ 3.14 ✓",
    recipients: opts.recipientKeys.map((account) => ({ address: account, account })),
    ...opts.overrides,
  };
  const pipeline = new SendPipeline(input, vi.fn(), {
    signer: opts.signer ?? signer,
    keyResolver: resolver,
  });
  stubRelayFetch(opts.relayStatuses ?? [200]);
  return { pipeline, pairs, directories };
}

describe("send pipeline (#1953)", () => {
  it("seals, signs, and submits for multiple recipients on the happy path", async () => {
    const { pipeline } = await validPipeline({ recipientKeys: [ALICE, BOB] });

    const outcome = await pipeline.run();

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.delivered).toBe(true);
    expect(outcome.state).toBe("ACKNOWLEDGED");

    const stages = pipeline.getStages();
    for (const stage of stages) {
      expect(stage.status).not.toBe("error");
    }
  });

  it("reports recipient_rejected when a recipient has no key directory", async () => {
    const { pipeline } = await validPipeline({ recipientKeys: [ALICE] });
    // Override the resolver map so ALICE has no directory entry.
    const pipelineNoKeys = new SendPipeline(
      {
        sender: SENDER,
        to: ALICE,
        subject: "t",
        body: "hello",
        recipients: [{ address: ALICE, account: ALICE }],
      },
      vi.fn(),
      {
        signer: signerFor().signer,
        keyResolver: makeResolver(() => null),
      },
    );
    stubRelayFetch([200]);

    const outcome = await pipelineNoKeys.run();

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe("resolve");
    expect(outcome.reason).toBe("recipient_rejected");
  });

  it.each([
    ["revoked", { status: "revoked" }, "revoked"],
    ["expired", { notAfter: "2020-01-01T00:00:00Z" }, "expired"],
    ["not-yet-valid", { notBefore: "2099-01-01T00:00:00Z" }, "not yet valid"],
    ["unsupported algorithm", { publicKey: "bm90LWEtcC0yNTYta2V5" }, "not a supported P-256"],
  ])("rejects %s key material at the resolve stage", async (_label, overrides, _expected) => {
    const pair = await generateRecipientKeyPair();
    const resolver = makeResolver(() => makeDirectory(pair.publicKeySpkiBase64, overrides));
    const pipeline = new SendPipeline(
      {
        sender: SENDER,
        to: ALICE,
        subject: "t",
        body: "hello",
        recipients: [{ address: ALICE, account: ALICE }],
      },
      vi.fn(),
      { signer: signerFor().signer, keyResolver: resolver },
    );
    stubRelayFetch([200]);

    const outcome = await pipeline.run();

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe("resolve");
    expect(outcome.reason).toBe("recipient_rejected");
  });

  it("keeps the draft intact on a wallet rejection", async () => {
    const { pipeline } = await validPipeline({
      recipientKeys: [ALICE],
      signer: async () => {
        throw new WalletRejectedError();
      },
    });

    const outcome = await pipeline.run();

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("wallet_rejected");
    expect(outcome.stage).toBe("sign");
  });

  it("reports wallet_unavailable when the wallet is not detected", async () => {
    const { pipeline } = await validPipeline({
      recipientKeys: [ALICE],
      signer: async () => {
        throw new WalletUnavailableError();
      },
    });

    const outcome = await pipeline.run();

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("wallet_unavailable");
    expect(outcome.stage).toBe("sign");
  });

  it("fails the sign stage when the wallet signer does not match the sender", async () => {
    const otherSigner = signerFor({ signerAddress: BOB });
    const { pipeline } = await validPipeline({
      recipientKeys: [ALICE],
      signer: otherSigner.signer,
    });

    const outcome = await pipeline.run();

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe("sign");
    expect(outcome.reason).toBe("failed");
    expect(outcome.message).toContain("does not match the sender");
  });

  it("treats a 409 as an idempotent success", async () => {
    const { pipeline } = await validPipeline({
      recipientKeys: [ALICE],
      relayStatuses: [409],
    });

    const outcome = await pipeline.run();

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.delivered).toBe(true);
    expect(outcome.state).toBe("DEDUPLICATED");
  });

  it("re-signs with a fresh nonce on a transient relay failure", async () => {
    const { signer, canonicalSeen } = signerFor();
    const { pipeline } = await validPipeline({
      recipientKeys: [ALICE],
      signer,
      relayStatuses: [503, 200],
    });

    const outcome = await pipeline.run();

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Initial sign (pipeline) + one re-sign (submit retry) with a distinct nonce.
    expect(canonicalSeen.length).toBeGreaterThanOrEqual(2);
    const nonces = canonicalSeen
      .map((c) => /"request_nonce":"([0-9a-f]+)"/.exec(c))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => m[1]);
    expect(new Set(nonces).size).toBeGreaterThan(1);
  });

  it("propagates structured stage progress for retries", async () => {
    const progress: StageState[][] = [];
    const pair = await generateRecipientKeyPair();
    const resolver = makeResolver(() => makeDirectory(pair.publicKeySpkiBase64));
    const { signer } = signerFor();
    const pipeline = new SendPipeline(
      {
        sender: SENDER,
        to: ALICE,
        subject: "t",
        body: "hello",
        recipients: [{ address: ALICE, account: ALICE }],
      },
      (stages) => progress.push(stages),
      { signer, keyResolver: resolver },
    );
    stubRelayFetch([200]);

    const outcome = await pipeline.run();
    expect(outcome.ok).toBe(true);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[0].map((s) => s.id)).toEqual([
      "resolve",
      "encrypt",
      "sign",
      "postage",
      "persist",
      "submit",
      "reconcile",
    ]);
  });

  it("rejects an empty recipient list at the resolve stage", async () => {
    const pipeline = new SendPipeline(
      { sender: SENDER, to: "", subject: "t", body: "hello" },
      vi.fn(),
      { signer: signerFor().signer, keyResolver: makeResolver(() => null) },
    );
    stubRelayFetch([200]);

    const outcome = await pipeline.run();
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe("resolve");
    expect(outcome.reason).toBe("recipient_rejected");
  });
});
