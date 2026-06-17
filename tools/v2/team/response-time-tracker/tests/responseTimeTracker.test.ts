import { describe, expect, it } from "vitest";

import {
  createResponseTimeLoadingState,
  safeSummarizeResponseTimes,
  summarizeResponseTimes,
  type ResponseTimeEvent,
} from "../services/responseTimeTracker";

const fixtures: ResponseTimeEvent[] = [
  {
    id: "in-1",
    conversationId: "thread-a",
    direction: "inbound",
    sentAt: "2026-06-17T08:00:00.000Z",
    customerId: "customer-a",
    subject: "Invoice question",
  },
  {
    id: "out-1",
    conversationId: "thread-a",
    direction: "outbound",
    sentAt: "2026-06-17T08:42:00.000Z",
    actorId: "agent-1",
    actorName: "Avery",
  },
  {
    id: "in-2",
    conversationId: "thread-a",
    direction: "inbound",
    sentAt: "2026-06-17T09:00:00.000Z",
    customerId: "customer-a",
    subject: "Invoice follow-up",
  },
  {
    id: "in-3",
    conversationId: "thread-b",
    direction: "inbound",
    sentAt: "2026-06-17T07:10:00.000Z",
    customerId: "customer-b",
    subject: "SLA request",
  },
  {
    id: "out-2",
    conversationId: "thread-b",
    direction: "outbound",
    sentAt: "2026-06-17T10:20:00.000Z",
    actorId: "agent-2",
    actorName: "Blair",
  },
];

describe("response time tracker core engine", () => {
  it("pairs inbound messages with the next outbound response per conversation", () => {
    const snapshot = summarizeResponseTimes(fixtures, {
      now: "2026-06-17T10:30:00.000Z",
      slaMinutes: 120,
    });

    expect(snapshot.status).toBe("ready");
    expect(snapshot.totals.conversationCount).toBe(2);
    expect(snapshot.totals.inboundCount).toBe(3);
    expect(snapshot.totals.responseCount).toBe(2);
    expect(snapshot.totals.pendingCount).toBe(1);
    expect(snapshot.totals.averageResponseMinutes).toBe(116);
    expect(snapshot.totals.medianResponseMinutes).toBe(116);
    expect(snapshot.totals.longestResponseMinutes).toBe(190);
    expect(snapshot.totals.slaBreachCount).toBe(1);
  });

  it("reports pending inbound age without calling any external service", () => {
    const snapshot = summarizeResponseTimes(fixtures, {
      now: "2026-06-17T10:30:00.000Z",
      slaMinutes: 120,
    });

    const threadA = snapshot.conversations.find(
      (conversation) => conversation.conversationId === "thread-a",
    );

    expect(threadA?.pending).toEqual([
      {
        conversationId: "thread-a",
        inboundEventId: "in-2",
        inboundAt: "2026-06-17T09:00:00.000Z",
        ageMinutes: 90,
        customerId: "customer-a",
        subject: "Invoice follow-up",
      },
    ]);
  });

  it("exposes a deterministic loading state for future UI work", () => {
    expect(createResponseTimeLoadingState()).toEqual({
      status: "loading",
      message: "Preparing response-time metrics.",
    });
  });

  it("returns an error state for malformed event data", () => {
    const state = safeSummarizeResponseTimes(
      [
        {
          id: "bad",
          conversationId: "thread-c",
          direction: "inbound",
          sentAt: "not-a-date",
        },
      ],
      {
        now: "2026-06-17T10:30:00.000Z",
      },
    );

    expect(state.status).toBe("error");
    expect(state.message).toBe("Response-time tracker could not build metrics.");
    expect(state.details?.[0]).toContain("invalid timestamp");
  });
});
