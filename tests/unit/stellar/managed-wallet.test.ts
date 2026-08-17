import { describe, expect, it } from "vitest";
import { ManagedWalletService } from "../../../src/services/stellar/managed-wallet";
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
  const knownContract1 = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
  const knownContract2 = "CBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQWW";
  const knownContract3 = "CCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH2S";

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
      domainTag: "test",
      protocolVersion: "1.0",
    },
    environment: "beta",
  } as any;

  const actorAddress = Keypair.random().publicKey();

  function buildMockTx(contractId: string, functionName: string): string {
    const account = new Account(operatorKeypair.publicKey(), "1");
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: mockConfig.network.networkPassphrase,
    })
      .addOperation(contract.call(functionName))
      .setTimeout(30)
      .build();
    return tx.toEnvelope().toXDR("base64");
  }

  const wallet = new ManagedWalletService(mockConfig);

  it("signs a valid policy intent and returns XDR", async () => {
    const intent = { type: "policy", ownerAddress: actorAddress } as const;
    const txXdr = buildMockTx(knownContract1, "set_policy");

    const signedXdr = await wallet.signTransaction(intent, actorAddress, txXdr, "req-123");

    const parsed = new Transaction(signedXdr, mockConfig.network.networkPassphrase);
    expect(parsed.signatures.length).toBe(1);
    expect(operatorKeypair.verify(parsed.hash(), parsed.signatures[0].signature())).toBe(true);
  });

  it("rejects mismatched function for intent type", async () => {
    const intent = { type: "policy", ownerAddress: actorAddress } as const;
    const txXdr = buildMockTx(knownContract1, "submit_postage");

    await expect(wallet.signTransaction(intent, actorAddress, txXdr, "req-123")).rejects.toThrow(
      "Function submit_postage is not allowed for policy intents",
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
});
