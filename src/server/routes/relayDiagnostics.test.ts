import type { Response, Router } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiRepository } from "@/server/api/repository";
import { getRelayDiagnosticsResponse } from "@/server/api/relay-diagnostics-service";

import {
  attachRelayDiagnosticsRoute,
  relayDiagnosticsHandler,
  type AuthenticatedRequest,
} from "./relayDiagnostics";

vi.mock("@/server/api/relay-diagnostics-service", () => ({
  getRelayDiagnosticsResponse: vi.fn(),
}));

type RelayDiagnosticsRepository = ApiRepository & {
  getRelayOwner(relayId: string): Promise<string | null>;
};

function createResponse() {
  const status = vi.fn();
  const json = vi.fn();
  const res = { json, status } as unknown as Response;
  status.mockReturnValue(res);
  json.mockReturnValue(res);
  return { res, status, json };
}

function createRequest(relayId: string, userId: string) {
  return {
    params: { relayId },
    user: { id: userId },
  } as AuthenticatedRequest;
}

describe("relay diagnostics route", () => {
  const mockedGetRelayDiagnosticsResponse = vi.mocked(getRelayDiagnosticsResponse);

  beforeEach(() => {
    mockedGetRelayDiagnosticsResponse.mockReset();
  });

  it("returns 404 when relay not found", async () => {
    const repository = {
      getRelayOwner: vi.fn().mockResolvedValue(null),
    } as unknown as RelayDiagnosticsRepository;
    const req = createRequest("relay-1", "user-1");
    const { res, status, json } = createResponse();

    await relayDiagnosticsHandler(req, res, repository);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: "relay_not_found" });
    expect(mockedGetRelayDiagnosticsResponse).not.toHaveBeenCalled();
  });

  it("returns 403 when relay belongs to different user", async () => {
    const repository = {
      getRelayOwner: vi.fn().mockResolvedValue("user-2"),
    } as unknown as RelayDiagnosticsRepository;
    const req = createRequest("relay-1", "user-1");
    const { res, status, json } = createResponse();

    await relayDiagnosticsHandler(req, res, repository);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: "forbidden" });
    expect(mockedGetRelayDiagnosticsResponse).not.toHaveBeenCalled();
  });

  it("returns 200 with relay diagnostics on success", async () => {
    const diagnostics = {
      deadLetterCount: 1,
      lastFailureAt: null,
      lastSuccessAt: "2026-06-16T12:00:00.000Z",
      queueDepth: 12,
      relayId: "relay-1",
      retryCount: 2,
      signals: {
        isDegraded: true,
        isDelayed: false,
        isRetryStorm: false,
      },
      status: "degraded" as const,
    };
    const repository = {
      getRelayOwner: vi.fn().mockResolvedValue("user-1"),
    } as unknown as RelayDiagnosticsRepository;
    mockedGetRelayDiagnosticsResponse.mockResolvedValue(diagnostics);
    const req = createRequest("relay-1", "user-1");
    const { res, status, json } = createResponse();

    await relayDiagnosticsHandler(req, res, repository);

    expect(mockedGetRelayDiagnosticsResponse).toHaveBeenCalledWith(repository, "relay-1");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      deadLetterCount: 1,
      lastFailureAt: null,
      lastSuccessAt: "2026-06-16T12:00:00.000Z",
      queueDepth: 12,
      relayId: "relay-1",
      retryCount: 2,
      signals: {
        isDegraded: true,
        isDelayed: false,
        isRetryStorm: false,
      },
      status: "degraded",
    });
  });

  it("returns 500 when relay diagnostics are unavailable", async () => {
    const repository = {
      getRelayOwner: vi.fn().mockResolvedValue("user-1"),
    } as unknown as RelayDiagnosticsRepository;
    mockedGetRelayDiagnosticsResponse.mockRejectedValue(new Error("boom"));
    const req = createRequest("relay-1", "user-1");
    const { res, status, json } = createResponse();

    await relayDiagnosticsHandler(req, res, repository);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "diagnostics_unavailable" });
  });

  it("registers the route on a router", () => {
    const router = {
      get: vi.fn(),
    } as unknown as Router;
    const repository = {
      getRelayOwner: vi.fn(),
    } as unknown as RelayDiagnosticsRepository;

    attachRelayDiagnosticsRoute(router, repository);

    expect(vi.mocked(router.get)).toHaveBeenCalledWith(
      "/relays/:relayId/diagnostics",
      expect.any(Function),
    );
  });
});
