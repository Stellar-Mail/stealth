import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRouteHandler } from "../../../src/server/api/handler";
import { requestContextStorage, getApiContext } from "../../../src/server/api/context";
import { logger } from "../../../src/server/api/logging";
import { DataIntegrityError } from "../../../src/server/api/errors";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

describe("Request Correlation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const globalApi = globalThis as any;
    globalApi.__stealthApiRepository = undefined;
  });

  it("propagates request ID from context to repository errors", async () => {
    const customRequestId = "test-correlation-id-12345";
    const { repository } = await getApiContext();

    // Corrupt record inside the underlying memory repository
    const innerMemory = (repository as any).inner as MemoryApiRepository;
    const policiesMap = (innerMemory as any).policies as Map<string, unknown>;
    policiesMap.set("owner123", { allowUnknown: "corrupt_data_not_boolean" });

    let caughtError: any;

    await requestContextStorage.run({ requestId: customRequestId }, async () => {
      try {
        await repository.getPolicy("owner123");
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeInstanceOf(DataIntegrityError);
    expect(caughtError.correlationId).toBe(customRequestId);
    expect(caughtError.requestId).toBe(customRequestId);
  });

  it("structured logger correctly logs request ID matching context", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const customRequestId = "log-test-id-54321";

    const handler = createRouteHandler({
      handler: () => new Response("OK", { status: 200 }),
    });

    const request = new Request("http://localhost/api/test", {
      method: "GET",
      headers: { "x-request-id": customRequestId },
    });

    await handler(request);

    try {
      expect(consoleLogSpy).toHaveBeenCalled();
      const lastCall = consoleLogSpy.mock.calls.find((call) =>
        call[0].includes(customRequestId),
      )?.[0];
      expect(lastCall).toBeDefined();
      const parsedLog = JSON.parse(lastCall!);
      expect(parsedLog.requestId).toBe(customRequestId);
      expect(parsedLog.routeId).toBe("/api/test");
    } finally {
      consoleLogSpy.mockRestore();
    }
  });
});
