import { describe, expect, it } from "vitest";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  createDeliveryReceipt,
  getReceipt,
  markReceiptRead,
} from "../../../src/server/api/receipt-service";
import { StaticReceiptsContractProvider } from "../../../src/server/api/receipt-contract-service";
import { RelayService } from "../../../src/services/relay/relay-service";
import { MemoryRelayPersistence } from "../../../src/services/relay/memory-persistence";
import type { RelayWorker, RelayWorkerStatus } from "../../../src/services/relay/worker";

class MockRelayWorker implements RelayWorker {
  private status: RelayWorkerStatus = "idle";
  async start() {
    this.status = "running";
  }
  async stop() {
    this.status = "stopped";
  }
  getStatus() {
    return this.status;
  }
}

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const messageId = "e".repeat(64);

describe("BETA-044 :: Delivery & Read Receipt Soroban Testnet Workflow Integration", () => {
  it("executes complete lifecycle: ingestion -> delivery publication -> read publication -> on-chain reconciliation", async () => {
    const repository = new MemoryApiRepository();
    const contractProvider = new StaticReceiptsContractProvider();

    // 1. Relay submission with verified recipient ingestion hook
    const persistence = new MemoryRelayPersistence();
    const worker = new MockRelayWorker();
    const relayService = new RelayService(persistence, worker, {
      serviceName: "stealth-relay-test",
      version: "1.0.0",
      apiVersion: "v1",
      protocolVersion: "v1",
      timeoutMs: 1000,
      network: {
        horizonUrl: "https://horizon-testnet.stellar.org",
        sorobanRpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; July 2015",
      },
      onIngestedReceipt: async ({ messageId, sender, recipient, payload }) => {
        await createDeliveryReceipt(
          repository,
          { messageId, sender, recipient, payload },
          new Date("2026-08-18T12:00:00.000Z"),
          contractProvider,
        );
      },
    });

    const submitResult = await relayService.submit({
      messageId,
      sender,
      recipient,
      recipientDomain: "stealth.test",
      payload: "encrypted-envelope-payload",
    });

    expect(submitResult.accepted).toBe(true);

    // 2. Sender queries delivery status and verifies confirmed chain state
    const deliveryReceipt = await getReceipt(repository, messageId, contractProvider);
    expect(deliveryReceipt).toMatchObject({
      messageId,
      sender,
      recipient,
      readAt: null,
      chainStatus: "confirmed",
    });
    expect(deliveryReceipt.payloadHash).toHaveLength(64);
    expect(deliveryReceipt.txHash).toBeDefined();

    // 3. Unauthorized actor (sender) attempts to mark message as read -> 403 Forbidden
    await expect(
      markReceiptRead(
        repository,
        messageId,
        sender,
        new Date("2026-08-18T12:30:00.000Z"),
        contractProvider,
      ),
    ).rejects.toMatchObject({ status: 403 });

    // 4. Recipient explicitly marks receipt as read -> publishes on-chain read receipt
    const readReceipt = await markReceiptRead(
      repository,
      messageId,
      recipient,
      new Date("2026-08-18T12:30:00.000Z"),
      contractProvider,
    );

    expect(readReceipt).toMatchObject({
      messageId,
      readAt: "2026-08-18T12:30:00.000Z",
    });

    // 5. Re-invoking read is idempotent and retains original timestamp
    const duplicateRead = await markReceiptRead(
      repository,
      messageId,
      recipient,
      new Date("2026-08-18T13:00:00.000Z"),
      contractProvider,
    );

    expect(duplicateRead.readAt).toBe("2026-08-18T12:30:00.000Z");

    // 6. Direct query on contract provider reflects stored receipt
    const onChainRecord = await contractProvider.getOnChainReceipt(messageId);
    expect(onChainRecord).toMatchObject({
      messageId,
      sender,
      recipient,
      readAt: "2026-08-18T12:30:00.000Z",
      confirmed: true,
    });
  });
});
