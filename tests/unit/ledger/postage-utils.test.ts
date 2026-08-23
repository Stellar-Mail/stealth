import { describe, it, expect } from "vitest";
import {
  permittedActions,
  explorerTxLink,
  explorerAccountLink,
  describeStatus,
  formatPostageTimeline,
} from "@/features/ledger/postage-utils";
import type { PostageRecord } from "@/lib/api";

describe("postage-utils", () => {
  const dummyPostage: PostageRecord = {
    amount: "100",
    createdAt: new Date().toISOString(),
    messageId: "msg-123",
    paymentHash: "hash-456",
    recipient: "GBREC...",
    sender: "GASEN...",
    status: "pending",
  };

  describe("permittedActions", () => {
    it("allows sender to dispute and expire pending postage", () => {
      const actions = permittedActions("pending", "GASEN...", dummyPostage);
      expect(actions.canDispute).toBe(true);
      expect(actions.canExpire).toBe(true);
      expect(actions.canSettle).toBe(false);
      expect(actions.canRefund).toBe(false);
      expect(actions.canReclaim).toBe(false);
    });

    it("allows recipient to settle and refund pending postage", () => {
      const actions = permittedActions("pending", "GBREC...", dummyPostage);
      expect(actions.canSettle).toBe(true);
      expect(actions.canRefund).toBe(true);
      expect(actions.canDispute).toBe(false);
    });

    it("allows sender to reclaim expired postage", () => {
      const actions = permittedActions("expired", "GASEN...", dummyPostage);
      expect(actions.canReclaim).toBe(true);
      expect(actions.canDispute).toBe(true);
      expect(actions.canSettle).toBe(false);
    });
  });

  describe("explorerLinks", () => {
    it("formats tx link", () => {
      expect(explorerTxLink("hash123")).toBe("https://stellar.expert/explorer/testnet/tx/hash123");
    });
    it("formats account link", () => {
      expect(explorerAccountLink("G123")).toBe(
        "https://stellar.expert/explorer/testnet/account/G123",
      );
    });
  });

  describe("formatPostageTimeline", () => {
    it("returns correct timeline for pending status", () => {
      const timeline = formatPostageTimeline(dummyPostage);
      expect(timeline.length).toBe(3);
      expect(timeline[0].id).toBe("submitted");
      expect(timeline[1].id).toBe("dispute_window");
      expect(timeline[2].id).toBe("resolution");
    });
  });

  describe("describeStatus", () => {
    it("returns description for status", () => {
      expect(describeStatus("pending")).toContain("Escrow reserved");
    });
  });
});
