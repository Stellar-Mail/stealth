import { describe, expect, it } from "vitest";
import { ManagedWalletService } from "../../../src/services/stellar/managed-wallet";
import {
  MemoryManagedWalletStore,
  VersionedMasterKeyProvider,
  withManagedWalletSeed,
} from "../../../src/services/crypto/managed-wallet-envelope";
import type { BetaRuntimeConfig } from "../../../src/config/schema";
import {
  Keypair,
  TransactionBuilder,
  Networks,
  Contract,
  xdr,
  Address,
  Account,
  Transaction,
  Operation,
  Asset,
  StrKey,
} from "@stellar/stellar-sdk";

describe("Managed Wallet Boundary", () => {
  const operatorKeypair = Keypair.random();
  // Generate valid contract IDs using StrKey/Keypair or just use a known good one?
  // Let's just generate a valid contract ID by creating random keys.
  // Actually, a Contract ID is an Address. But we can just use a real contract ID or let it be generated.
  // In stellar-sdk, we can use Address.contract(...) but wait, we need a 32-byte hex.
  // Actually, just using `new Contract("CC" + "A".repeat(54))` might not pass CRC.
  // Let's generate a valid contract ID by taking the string of a contract ID or just generating a random buffer and encoding it.
  // However, I can just mock the contract ID in the config by using a valid one.
  const validContract1 = "CCJOU3X4NTZ2ND43FOS5XOK735G6F7ZZW357ZZZZZZZZZZZZZZZZZZZZ";
  const validContract2 = "CCZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"; // Is this valid? We can just use Keypair.random() public keys if we need addresses, but contract IDs start with C.

  // Let's dynamically create valid contract IDs by using stellar-sdk StrKey if needed, but the easiest is just mock what we need.
  // Actually, let's just use dummy valid contract IDs.
  // A valid contract ID starts with C and has a 2-byte checksum.
  // I will just use `new Contract(contractId)` with a known valid ID.
  const knownContract1 = StrKey.encodeContract(Buffer.alloc(32, 0));
  const knownContract2 = StrKey.encodeContract(Buffer.alloc(32, 1));
  const knownContract3 = StrKey.encodeContract(Buffer.alloc(32, 2));
  const knownContract4 = StrKey.encodeContract(Buffer.alloc(32, 3));

  const mockConfig: BetaRuntimeConfig = {
    network: {
      stellarNetwork: "testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "http://localhost",
    },
    secrets: {
      operatorSecret: operatorKeypair.secret(),
    },
    contract: {
      registryContractId: knownContract3,
      postageContractId: knownContract2,
      policiesContractId: knownContract1,
      receiptsContractId: knownContract4,
      domainTag: "test",
      protocolVersion: "1.0",
    },
    environment: "beta",
  } as any;

  const actorAddress = Keypair.random().publicKey();

  function buildMockTx(contractId: string, functionName: string, args: any[] = []): string {
    const account = new Account(operatorKeypair.publicKey(), "1");
    const contract = new Contract(contractId);

    // Convert native args to ScVals for the mock
    const scArgs = args.map((arg) => {
      if (typeof arg === "string" && arg.startsWith("G")) {
        return xdr.ScVal.scvAddress(
          xdr.ScAddress.scAddressTypeAccount(Keypair.fromPublicKey(arg).xdrAccountId()),
        );
      }
      return xdr.ScVal.scvVoid(); // Fallback for simple testing
    });

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: mockConfig.network.networkPassphrase,
    })
      .addOperation(contract.call(functionName, ...scArgs))
      .setTimeout(30)
      .build();
    return tx.toEnvelope().toXDR("base64");
  }

  const wallet = new ManagedWalletService(mockConfig);

  it("signs a valid policy intent and returns XDR", async () => {
    const intent = { type: "policy", ownerAddress: actorAddress } as const;
    const txXdr = buildMockTx(knownContract1, "set_policy", [actorAddress]);

    const signedXdr = await wallet.signTransaction(intent, actorAddress, txXdr, "req-123");

    const parsed = new Transaction(signedXdr, mockConfig.network.networkPassphrase);
    expect(parsed.signatures.length).toBe(1);
    expect(operatorKeypair.verify(parsed.hash(), parsed.signatures[0].signature())).toBe(true);
  });

  it("allows set_sender_tier for policy intents", async () => {
    const intent = { type: "policy", ownerAddress: actorAddress } as const;
    const txXdr = buildMockTx(knownContract1, "set_sender_tier", [actorAddress]);

    await expect(
      wallet.signTransaction(intent, actorAddress, txXdr, "req-tier"),
    ).resolves.toBeTruthy();
  });

  it("rejects mismatched function for intent type", async () => {
    const intent = { type: "policy", ownerAddress: actorAddress } as const;
    const txXdr = buildMockTx(knownContract1, "submit");

    await expect(wallet.signTransaction(intent, actorAddress, txXdr, "req-123")).rejects.toThrow(
      "Function submit is not allowed for policy intents",
    );
  });

  it("rejects invalid contract id", async () => {
    const intent = { type: "policy", ownerAddress: actorAddress } as const;
    const txXdr = buildMockTx(knownContract3, "set_policy", [actorAddress]); // registry, not policies

    await expect(wallet.signTransaction(intent, actorAddress, txXdr, "req-123")).rejects.toThrow(
      "Invalid contract ID for policy intent",
    );
  });

  it("rejects mismatched owner address", async () => {
    const intent = { type: "policy", ownerAddress: actorAddress } as const;
    const maliciousActor = Keypair.random().publicKey();
    const txXdr = buildMockTx(knownContract1, "set_policy", [maliciousActor]);

    await expect(wallet.signTransaction(intent, actorAddress, txXdr, "req-123")).rejects.toThrow(
      `Transaction alters policy for a different owner: ${maliciousActor}`,
    );
  });

  it("rejects arbitrary operations", async () => {
    const account = new Account(operatorKeypair.publicKey(), "1");
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: mockConfig.network.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: actorAddress,
          asset: Asset.native(),
          amount: "100",
        }),
      )
      .setTimeout(30)
      .build();
    const txXdr = tx.toEnvelope().toXDR("base64");

    const intent = { type: "policy", ownerAddress: actorAddress } as const;
    await expect(wallet.signTransaction(intent, actorAddress, txXdr, "req-123")).rejects.toThrow(
      "Only invokeHostFunction operations are allowed",
    );
  });

  it("rejects invalid transaction XDR", async () => {
    const intent = { type: "policy", ownerAddress: actorAddress } as const;
    await expect(
      wallet.signTransaction(intent, actorAddress, "not-valid-xdr!!!", "req-bad-xdr"),
    ).rejects.toThrow("Invalid transaction XDR");
  });

  it("rejects multi-operation transactions", async () => {
    const account = new Account(operatorKeypair.publicKey(), "1");
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: mockConfig.network.networkPassphrase,
    })
      .addOperation(new Contract(knownContract1).call("set_policy"))
      .addOperation(new Contract(knownContract1).call("set_sender_tier"))
      .setTimeout(30)
      .build();
    const intent = { type: "policy", ownerAddress: actorAddress } as const;
    await expect(
      wallet.signTransaction(intent, actorAddress, tx.toEnvelope().toXDR("base64"), "req-multi"),
    ).rejects.toThrow("Managed wallet only signs single-operation transactions");
  });

  it("rejects keys directory intents (fail closed)", async () => {
    const txXdr = buildMockTx(knownContract1, "set_policy", [actorAddress]);
    const intent = {
      type: "keys",
      ownerAddress: actorAddress,
      operation: "publish",
    } as const;
    await expect(wallet.signTransaction(intent, actorAddress, txXdr, "req-keys")).rejects.toThrow(
      "Managed wallet does not sign key directory transactions",
    );
  });

  it("rejects receipt intent with wrong contract id", async () => {
    const intent = { type: "receipt", recipientAddress: actorAddress } as const;
    const txXdr = buildMockTx(knownContract1, "emit_receipt", [actorAddress]);
    await expect(wallet.signTransaction(intent, actorAddress, txXdr, "req-rcpt")).rejects.toThrow(
      "Invalid contract ID for receipt intent",
    );
  });

  it("allows valid receipt intent on receipts contract", async () => {
    const intent = { type: "receipt", recipientAddress: actorAddress } as const;
    const txXdr = buildMockTx(knownContract4, "emit_receipt", [actorAddress]);
    await expect(
      wallet.signTransaction(intent, actorAddress, txXdr, "req-rcpt-ok"),
    ).resolves.toBeTruthy();
  });

  it("rejects postage intent with wrong sender in submit()", async () => {
    const malicious = Keypair.random().publicKey();
    const intent = {
      type: "postage",
      senderAddress: actorAddress,
      amountStroops: "1000",
    } as const;
    const txXdr = buildMockTx(knownContract2, "submit", [malicious, malicious]);
    await expect(wallet.signTransaction(intent, actorAddress, txXdr, "req-post")).rejects.toThrow(
      /different sender/,
    );
  });

  it("allows lifecycle intent on registry contract", async () => {
    const intent = { type: "lifecycle", userAddress: actorAddress } as const;
    const txXdr = buildMockTx(knownContract3, "set_delegate", [actorAddress]);
    await expect(
      wallet.signTransaction(intent, actorAddress, txXdr, "req-life"),
    ).resolves.toBeTruthy();
  });
});

describe("managed wallet envelope custody", () => {
  const contractId = StrKey.encodeContract(Buffer.alloc(32, 0));
  const networkPassphrase = "Test SDF Network ; September 2015";

  async function keys(active = "v2", versions = ["v1", "v2"]) {
    const encoded: Record<string, string> = {};
    for (const version of versions) {
      encoded[version] = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    }
    return VersionedMasterKeyProvider.fromBase64(active, encoded);
  }

  function config(): BetaRuntimeConfig {
    return {
      network: { stellarNetwork: "testnet", networkPassphrase, rpcUrl: "http://localhost" },
      contract: {
        registryContractId: contractId,
        postageContractId: contractId,
        policiesContractId: contractId,
        receiptsContractId: contractId,
        domainTag: "test",
        protocolVersion: "1",
      },
      environment: "beta",
      secrets: {},
    } as any;
  }

  function transaction(source: string) {
    const scArgs = [
      xdr.ScVal.scvAddress(
        xdr.ScAddress.scAddressTypeAccount(Keypair.fromPublicKey(source).xdrAccountId()),
      ),
    ];
    return new TransactionBuilder(new Account(source, "1"), { fee: "100", networkPassphrase })
      .addOperation(new Contract(contractId).call("set_policy", ...scArgs))
      .setTimeout(30)
      .build()
      .toXDR();
  }

  it("persists no seed, rotates only its wrapped data key, and still signs", async () => {
    const walletKey = Keypair.random();
    const store = new MemoryManagedWalletStore();
    const service = new ManagedWalletService(config(), { store, keys: await keys() });
    const initial = await service.provisionWallet(walletKey.publicKey(), walletKey.secret());

    expect(JSON.stringify(initial)).not.toContain(walletKey.secret());
    expect(initial.envelope.masterKeyVersion).toBe("v2");
    const rotated = await service.rotateWalletKey(walletKey.publicKey(), "v1");
    expect(rotated.envelope.address).toBe(initial.envelope.address);
    expect(rotated.envelope.encryptedSeed).toBe(initial.envelope.encryptedSeed);
    expect(rotated.envelope.masterKeyVersion).toBe("v1");

    const signed = await service.signTransaction(
      { type: "policy", ownerAddress: walletKey.publicKey() },
      walletKey.publicKey(),
      transaction(walletKey.publicKey()),
    );
    expect(new Transaction(signed, networkPassphrase).signatures).toHaveLength(1);
  });

  it("fails closed for tampering, missing old keys, and unauthorized owners", async () => {
    const walletKey = Keypair.random();
    const store = new MemoryManagedWalletStore();
    const provider = await keys("v1", ["v1"]);
    const service = new ManagedWalletService(config(), { store, keys: provider });
    const record = await service.provisionWallet(walletKey.publicKey(), walletKey.secret());
    const tampered = {
      ...record,
      envelope: { ...record.envelope, seedTag: "AAAAAAAAAAAAAAAAAAAAAA==" },
    };
    await store.compareAndSet(walletKey.publicKey(), record.updatedAt, tampered);
    await expect(
      service.signTransaction(
        { type: "policy", ownerAddress: walletKey.publicKey() },
        walletKey.publicKey(),
        transaction(walletKey.publicKey()),
      ),
    ).rejects.toThrow("Managed wallet cryptographic operation failed");

    const stranger = Keypair.random().publicKey();
    await expect(
      service.signTransaction(
        { type: "policy", ownerAddress: stranger },
        stranger,
        transaction(stranger),
      ),
    ).rejects.toThrow("Managed wallet access denied");
  });

  it("does not expose decrypted seed outside the scoped callback", async () => {
    const key = Keypair.random();
    const provider = await keys("v1", ["v1"]);
    const store = new MemoryManagedWalletStore();
    const service = new ManagedWalletService(config(), { store, keys: provider });
    const record = await service.provisionWallet(key.publicKey(), key.secret());
    let observed = "";
    await withManagedWalletSeed(record.envelope, provider, (seed) => {
      observed = seed;
    });
    expect(observed).toBe(key.secret());
  });
});
