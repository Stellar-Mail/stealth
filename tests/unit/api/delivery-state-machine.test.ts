import { describe, expect, it, beforeEach } from "vitest";

import {
  messageDeliveryStateSchema,
  TERMINAL_DELIVERY_STATES,
  RETRYABLE_DELIVERY_STATES,
  ALLOWED_DELIVERY_TRANSITIONS,
  type MessageDeliveryState,
} from "@/server/api/domain";
import {
  applyTransition,
  IllegalStateTransitionError,
  isRetryableState,
  isTerminalState,
  isValidTransition,
  toPublicDeliveryStatus,
} from "@/services/relay/deliveryStateMachine";
import { computeAdvanceSteps, advanceToDeliveryState } from "@/server/api/delivery-hooks";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import { getDeliveryState, transitionDeliveryState } from "@/server/api/delivery-service";
import { createDeliveryReceipt, markReceiptRead } from "@/server/api/receipt-service";

const SENDER = `G${"A".repeat(55)}`;
const RECIPIENT = `G${"B".repeat(55)}`;
const MESSAGE_ID = "a".repeat(64);

describe("BETA-035: Off-Chain Message Delivery State Machine", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    repository = new MemoryApiRepository();
  });

  describe("Domain & State Definitions", () => {
    it("parses valid message delivery states", () => {
      const states: MessageDeliveryState[] = [
        "queued",
        "accepted",
        "anchored",
        "delivered",
        "read",
        "failed",
        "expired",
      ];
      for (const s of states) {
        expect(messageDeliveryStateSchema.parse(s)).toBe(s);
      }
    });

    it("correctly identifies terminal and retryable states", () => {
      expect(isTerminalState("read")).toBe(true);
      expect(isTerminalState("failed")).toBe(true);
      expect(isTerminalState("expired")).toBe(true);
      expect(isTerminalState("queued")).toBe(false);
      expect(isTerminalState("accepted")).toBe(false);
      expect(isTerminalState("anchored")).toBe(false);
      expect(isTerminalState("delivered")).toBe(false);

      expect(isRetryableState("queued")).toBe(true);
      expect(isRetryableState("accepted")).toBe(true);
      expect(isRetryableState("anchored")).toBe(true);
      expect(isRetryableState("delivered")).toBe(false);
      expect(isRetryableState("read")).toBe(false);
      expect(isRetryableState("failed")).toBe(false);
      expect(isRetryableState("expired")).toBe(false);
    });
  });

  describe("Transition Rules & Matrix Validation", () => {
    it("allows valid forward transitions", () => {
      expect(isValidTransition(null, "queued")).toBe(true);
      expect(isValidTransition(null, "accepted")).toBe(true);

      expect(isValidTransition("queued", "accepted")).toBe(true);
      expect(isValidTransition("queued", "failed")).toBe(true);
      expect(isValidTransition("queued", "expired")).toBe(true);

      expect(isValidTransition("accepted", "anchored")).toBe(true);
      expect(isValidTransition("accepted", "delivered")).toBe(true);
      expect(isValidTransition("accepted", "failed")).toBe(true);
      expect(isValidTransition("accepted", "expired")).toBe(true);

      expect(isValidTransition("anchored", "delivered")).toBe(true);
      expect(isValidTransition("anchored", "failed")).toBe(true);
      expect(isValidTransition("anchored", "expired")).toBe(true);

      expect(isValidTransition("delivered", "read")).toBe(true);
      expect(isValidTransition("delivered", "failed")).toBe(true);
      expect(isValidTransition("delivered", "expired")).toBe(true);
    });

    it("rejects illegal and backward transitions", () => {
      expect(isValidTransition("anchored", "accepted")).toBe(false);
      expect(isValidTransition("delivered", "anchored")).toBe(false);
      expect(isValidTransition("delivered", "accepted")).toBe(false);
      expect(isValidTransition("read", "delivered")).toBe(false);
      expect(isValidTransition("failed", "queued")).toBe(false);
      expect(isValidTransition("expired", "accepted")).toBe(false);
    });

    it("rejects duplicate self-transitions", () => {
      const states: MessageDeliveryState[] = [
        "queued",
        "accepted",
        "anchored",
        "delivered",
        "read",
        "failed",
        "expired",
      ];
      for (const s of states) {
        expect(isValidTransition(s, s)).toBe(false);
      }
    });

    it("rejects transitions out of terminal states via applyTransition", () => {
      const now = new Date();
      const terminalStates: MessageDeliveryState[] = ["read", "failed", "expired"];

      for (const termState of terminalStates) {
        const queuedRecord = applyTransition(null, {
          messageId: MESSAGE_ID,
          toState: "queued",
          actor: SENDER,
          reason: "Initial queued setup",
          now,
        });

        let terminalRecord = queuedRecord;
        if (termState === "read") {
          const acceptedRecord = applyTransition(queuedRecord, {
            messageId: MESSAGE_ID,
            toState: "accepted",
            actor: SENDER,
            reason: "Accepted by relay",
            now,
          });
          const deliveredRecord = applyTransition(acceptedRecord, {
            messageId: MESSAGE_ID,
            toState: "delivered",
            actor: RECIPIENT,
            reason: "Delivered",
            now,
          });
          terminalRecord = applyTransition(deliveredRecord, {
            messageId: MESSAGE_ID,
            toState: "read",
            actor: RECIPIENT,
            reason: "Read by recipient",
            now,
          });
        } else {
          terminalRecord = applyTransition(queuedRecord, {
            messageId: MESSAGE_ID,
            toState: termState,
            actor: SENDER,
            reason: `Terminal ${termState}`,
            now,
          });
        }

        expect(terminalRecord.isTerminal).toBe(true);

        expect(() =>
          applyTransition(terminalRecord, {
            messageId: MESSAGE_ID,
            toState: "queued",
            actor: SENDER,
            reason: "Illegal retry",
            now,
          }),
        ).toThrow(IllegalStateTransitionError);
      }
    });
  });

  describe("Lifecycle Journey & Persistence Integration", () => {
    it("executes the full happy-path message lifecycle: queued -> accepted -> anchored -> delivered -> read", async () => {
      const t1 = new Date("2026-08-17T20:00:00Z");
      const t2 = new Date("2026-08-17T20:01:00Z");
      const t3 = new Date("2026-08-17T20:02:00Z");
      const t4 = new Date("2026-08-17T20:03:00Z");
      const t5 = new Date("2026-08-17T20:04:00Z");

      // 1. Queued
      const s1 = await transitionDeliveryState(
        repository,
        MESSAGE_ID,
        "queued",
        SENDER,
        "Message enqueued for relay",
        null,
        t1,
      );
      expect(s1.state).toBe("queued");
      expect(s1.isTerminal).toBe(false);
      expect(s1.isRetryable).toBe(true);
      expect(s1.history.length).toBe(1);

      // 2. Accepted
      const s2 = await transitionDeliveryState(
        repository,
        MESSAGE_ID,
        "accepted",
        "relay:node-1",
        "Envelope validated and accepted",
        null,
        t2,
      );
      expect(s2.state).toBe("accepted");
      expect(s2.history.length).toBe(2);

      // 3. Anchored with chain reference
      const chainRef = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const s3 = await transitionDeliveryState(
        repository,
        MESSAGE_ID,
        "anchored",
        "relay:node-1",
        "Proof anchored on Stellar ledger #100",
        chainRef,
        t3,
      );
      expect(s3.state).toBe("anchored");
      expect(s3.chainReference).toBe(chainRef);
      expect(s3.isRetryable).toBe(true);

      // 4. Delivered
      const s4 = await transitionDeliveryState(
        repository,
        MESSAGE_ID,
        "delivered",
        RECIPIENT,
        "Delivered to recipient inbox",
        null,
        t4,
      );
      expect(s4.state).toBe("delivered");
      expect(s4.isRetryable).toBe(false);

      // 5. Read
      const s5 = await transitionDeliveryState(
        repository,
        MESSAGE_ID,
        "read",
        RECIPIENT,
        "Recipient opened message",
        null,
        t5,
      );
      expect(s5.state).toBe("read");
      expect(s5.isTerminal).toBe(true);
      expect(s5.isRetryable).toBe(false);
      expect(s5.history.length).toBe(5);

      // Verify stored record in repository
      const fetched = await getDeliveryState(repository, MESSAGE_ID);
      expect(fetched.state).toBe("read");
      expect(fetched.chainReference).toBe(chainRef);
    });

    it("integrates seamlessly with delivery receipt creation and mark receipt read", async () => {
      await createDeliveryReceipt(repository, {
        messageId: MESSAGE_ID,
        sender: SENDER,
        recipient: RECIPIENT,
      });

      const afterReceipt = await getDeliveryState(repository, MESSAGE_ID);
      expect(afterReceipt.state).toBe("delivered");
      expect(afterReceipt.isTerminal).toBe(false);

      await markReceiptRead(repository, MESSAGE_ID, RECIPIENT);

      const afterRead = await getDeliveryState(repository, MESSAGE_ID);
      expect(afterRead.state).toBe("read");
      expect(afterRead.isTerminal).toBe(true);
    });

    it("handles failure and expiry terminal transitions", async () => {
      const now = new Date();
      await transitionDeliveryState(
        repository,
        MESSAGE_ID,
        "queued",
        SENDER,
        "Enqueued",
        null,
        now,
      );

      const expiredStatus = await transitionDeliveryState(
        repository,
        MESSAGE_ID,
        "expired",
        "system:cron",
        "Message TTL elapsed before relay submission",
        null,
        now,
      );

      expect(expiredStatus.state).toBe("expired");
      expect(expiredStatus.isTerminal).toBe(true);
      expect(expiredStatus.isRetryable).toBe(false);
    });
  });

  describe("Property Matrix Testing", () => {
    it("exhaustively tests all pairs in the state matrix", () => {
      const states: MessageDeliveryState[] = [
        "queued",
        "accepted",
        "anchored",
        "delivered",
        "read",
        "failed",
        "expired",
      ];

      for (const fromState of states) {
        for (const toState of states) {
          const allowed = isValidTransition(fromState, toState);
          const expected = ALLOWED_DELIVERY_TRANSITIONS[fromState]?.has(toState) ?? false;
          expect(allowed).toBe(expected);
        }
      }
    });

    it("covers null initial-state transitions in the property matrix", () => {
      const states: MessageDeliveryState[] = [
        "queued",
        "accepted",
        "anchored",
        "delivered",
        "read",
        "failed",
        "expired",
      ];

      expect(isValidTransition(null, "queued")).toBe(true);
      expect(isValidTransition(null, "accepted")).toBe(true);
      for (const toState of states) {
        if (toState === "queued" || toState === "accepted") {
          continue;
        }
        expect(isValidTransition(null, toState)).toBe(false);
      }
    });

    it("computes shortest legal advance paths", () => {
      expect(computeAdvanceSteps(null, "accepted")).toEqual(["accepted"]);
      expect(computeAdvanceSteps(null, "delivered")).toEqual(["accepted", "delivered"]);
      expect(computeAdvanceSteps("accepted", "anchored")).toEqual(["anchored"]);
      expect(computeAdvanceSteps("delivered", "read")).toEqual(["read"]);
      expect(computeAdvanceSteps("read", "queued")).toEqual([]);
    });

    it("maps persisted records to stable public delivery status", async () => {
      const now = new Date("2026-08-17T20:00:00Z");
      const record = applyTransition(null, {
        messageId: MESSAGE_ID,
        toState: "queued",
        actor: SENDER,
        reason: "Enqueued",
        now,
      });
      const publicStatus = toPublicDeliveryStatus(record);
      expect(publicStatus.state).toBe("queued");
      expect(publicStatus.observedAt).toBe(record.updatedAt);
      expect(publicStatus.isRetryable).toBe(true);
      expect(publicStatus.history).toHaveLength(1);
    });

    it("advances idempotently through advanceToDeliveryState", async () => {
      const now = new Date("2026-08-17T20:00:00Z");
      const first = await advanceToDeliveryState(
        repository,
        MESSAGE_ID,
        "accepted",
        SENDER,
        "Relay accepted",
        null,
        now,
      );
      expect(first?.state).toBe("accepted");

      const second = await advanceToDeliveryState(
        repository,
        MESSAGE_ID,
        "accepted",
        SENDER,
        "Duplicate accept attempt",
        null,
        now,
      );
      expect(second?.state).toBe("accepted");
      const stored = await getDeliveryState(repository, MESSAGE_ID);
      expect(stored.history).toHaveLength(1);
    });
  });
});
