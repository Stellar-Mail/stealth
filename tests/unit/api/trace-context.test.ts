import { describe, expect, it, vi } from "vitest";
import {
  parseTraceParent,
  parseBaggage,
  serializeTraceParent,
  serializeBaggage,
  traceContextStorage,
  traceRepository,
  fetchRef,
  type TraceContext,
} from "../../../src/server/api/context";
import type { ApiRepository } from "../../../src/server/api/repository";

describe("Trace Context Parser and Serializer", () => {
  it("parses valid traceparent headers correctly", () => {
    const header = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const parsed = parseTraceParent(header);
    expect(parsed).not.toBeNull();
    expect(parsed?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(parsed?.spanId).toBe("00f067aa0ba902b7");
    expect(parsed?.traceFlags).toBe("01");
  });

  it("ignores malformed traceparent headers safely", () => {
    const invalidHeaders = [
      "",
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7", // missing flags
      "00-00000000000000000000000000000000-00f067aa0ba902b7-01", // all zeros traceId
      "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01", // all zeros spanId
      "01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-extra", // malformed length
      "00-4bf92f3577b34da6a3ce929d0e0e473g-00f067aa0ba902b7-01", // non-hex
    ];

    for (const header of invalidHeaders) {
      expect(parseTraceParent(header)).toBeNull();
    }
  });

  it("parses baggage headers and filters sensitive keys", () => {
    const header = "userId=alice,sessionToken=12345,api-key=secretKey,appName=stealth,authSign=xyz";
    const parsed = parseBaggage(header);
    expect(parsed).toBeDefined();
    expect(parsed?.userId).toBe("alice");
    expect(parsed?.appName).toBe("stealth");
    // Sensitive keys should be filtered out
    expect(parsed?.sessionToken).toBeUndefined();
    expect(parsed?.["api-key"]).toBeUndefined();
    expect(parsed?.authSign).toBeUndefined();
  });

  it("returns undefined if all baggage keys are filtered or empty", () => {
    const header = "authToken=abc,secret=123";
    expect(parseBaggage(header)).toBeUndefined();
  });
});

describe("Repository Context Instrumentation via Proxy", () => {
  it("creates child span context for repository calls", async () => {
    const parentContext: TraceContext = {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: "01",
      tracestate: "rojo=1",
      baggage: { userId: "alice" },
    };

    let activeContextInRepoCall: TraceContext | undefined;
    const mockRepo = {
      getPolicy: async (owner: string) => {
        activeContextInRepoCall = traceContextStorage.getStore();
        return null;
      },
    } as unknown as ApiRepository;

    const tracedRepo = traceRepository(mockRepo, parentContext);
    await tracedRepo.getPolicy("test-owner");

    expect(activeContextInRepoCall).toBeDefined();
    expect(activeContextInRepoCall?.traceId).toBe(parentContext.traceId);
    expect(activeContextInRepoCall?.spanId).not.toBe(parentContext.spanId); // new spanId generated
    expect(activeContextInRepoCall?.spanId).toMatch(/^[a-f0-9]{16}$/);
    expect(activeContextInRepoCall?.traceFlags).toBe(parentContext.traceFlags);
    expect(activeContextInRepoCall?.tracestate).toBe(parentContext.tracestate);
    expect(activeContextInRepoCall?.baggage).toEqual(parentContext.baggage);
  });
});

describe("Global Fetch Header Injection Integration", () => {
  it("injects trace context headers into outgoing fetch requests", async () => {
    const fetchContext: TraceContext = {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: "01",
      tracestate: "rojo=1",
      baggage: { userId: "alice" },
    };

    const spyFetch = vi.fn().mockResolvedValue(new Response());
    const originalFetch = fetchRef.fetch;
    // Temporarily swap underlying fetch with spy to verify injection
    fetchRef.fetch = spyFetch;

    try {
      await traceContextStorage.run(fetchContext, async () => {
        await fetch("https://stellar.service/txn", { method: "POST" });
      });

      expect(spyFetch).toHaveBeenCalled();
      const [calledUrl, calledInit] = spyFetch.mock.calls[0];
      const headers = new Headers(calledInit?.headers);

      expect(headers.get("traceparent")).toBe(serializeTraceParent(fetchContext));
      expect(headers.get("tracestate")).toBe("rojo=1");
      expect(headers.get("baggage")).toBe(serializeBaggage(fetchContext.baggage!));
    } finally {
      fetchRef.fetch = originalFetch;
    }
  });

  it("injects trace context headers into outgoing fetch requests when using Request object", async () => {
    const fetchContext: TraceContext = {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: "01",
      tracestate: "rojo=1",
      baggage: { userId: "alice" },
    };

    const spyFetch = vi.fn().mockResolvedValue(new Response());
    const originalFetch = fetchRef.fetch;
    fetchRef.fetch = spyFetch;

    try {
      await traceContextStorage.run(fetchContext, async () => {
        const req = new Request("https://stellar.service/txn", { method: "POST" });
        await fetch(req);
      });

      expect(spyFetch).toHaveBeenCalled();
      const [calledReq, calledInit] = spyFetch.mock.calls[0];
      expect(calledReq).toBeInstanceOf(Request);
      const headers = (calledReq as Request).headers;

      expect(headers.get("traceparent")).toBe(serializeTraceParent(fetchContext));
      expect(headers.get("tracestate")).toBe("rojo=1");
      expect(headers.get("baggage")).toBe(serializeBaggage(fetchContext.baggage!));
    } finally {
      fetchRef.fetch = originalFetch;
    }
  });

  it("does not inject trace headers if trace context is absent", async () => {
    const spyFetch = vi.fn().mockResolvedValue(new Response());
    const originalFetch = fetchRef.fetch;
    fetchRef.fetch = spyFetch;

    try {
      await fetch("https://stellar.service/txn");

      expect(spyFetch).toHaveBeenCalled();
      const [calledUrl, calledInit] = spyFetch.mock.calls[0];
      const headers = new Headers(calledInit?.headers);
      expect(headers.has("traceparent")).toBe(false);
      expect(headers.has("tracestate")).toBe(false);
      expect(headers.has("baggage")).toBe(false);
    } finally {
      fetchRef.fetch = originalFetch;
    }
  });
});
