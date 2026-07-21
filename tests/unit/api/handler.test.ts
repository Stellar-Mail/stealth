import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createRouteHandler } from "../../../src/server/api/handler";
import * as metrics from "../../../src/server/api/metrics";
import { ApiError } from "../../../src/server/api/errors";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { ACTOR_HEADER } from "../../../src/server/api/actor";

vi.mock("../../../src/server/api/metrics", () => ({
  incrementCounter: vi.fn(),
  recordHistogram: vi.fn(),
}));

describe("createRouteHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const globalApi = globalThis as any;
    globalApi.__stealthApiRepository = undefined;
  });

  it("executes handler and logs success metrics", async () => {
    const handler = createRouteHandler({
      handler: () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    });

    const request = new Request("http://localhost/api/test", { method: "GET" });
    const response = await handler(request);

    expect(response.status).toBe(200);
    expect(metrics.incrementCounter).toHaveBeenCalledWith("api_requests_total", {
      method: "GET",
      path: "/api/test",
      status: "200",
    });
    expect(metrics.recordHistogram).toHaveBeenCalledWith("api_latency", expect.any(Number), {
      method: "GET",
      path: "/api/test",
      status: "200",
    });
  });

  it("catches errors and logs failure metrics", async () => {
    const handler = createRouteHandler({
      handler: () => {
        throw new ApiError(400, "bad_request", "Custom error");
      },
    });

    const request = new Request("http://localhost/api/test", { method: "POST" });
    const response = await handler(request);

    expect(response.status).toBe(400);
    expect(metrics.incrementCounter).toHaveBeenCalledWith("api_errors_total", {
      method: "POST",
      path: "/api/test",
      status: "400",
    });
  });

  it("validates body schema", async () => {
    const handler = createRouteHandler({
      bodySchema: z.object({ value: z.number() }),
      handler: ({ body }) => {
        expect(body.value).toBe(42);
        return new Response("OK");
      },
    });

    const request = new Request("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify({ value: 42 }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await handler(request);
    expect(response.status).toBe(200);
  });

  it("blocks invalid body schema", async () => {
    const handler = createRouteHandler({
      bodySchema: z.object({ value: z.number() }),
      handler: () => new Response("OK"),
    });

    const request = new Request("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify({ value: "not a number" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await handler(request);
    expect(response.status).toBe(422);
  });

  it("authenticates the actor", async () => {
    const handler = createRouteHandler({
      requireAuth: true,
      handler: ({ actorId }) => {
        expect(actorId).toBe("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB");
        return new Response("OK");
      },
    });

    const request = new Request("http://localhost/api/test", {
      method: "GET",
      headers: { [ACTOR_HEADER]: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB" },
    });
    const response = await handler(request);
    expect(response.status).toBe(200);
  });

  it("blocks unauthenticated requests when auth is required", async () => {
    const handler = createRouteHandler({
      requireAuth: true,
      handler: () => new Response("OK"),
    });

    const request = new Request("http://localhost/api/test", { method: "GET" });
    const response = await handler(request);
    expect(response.status).toBe(401);
  });

  it("exhausts account quota according to the centrally configured operation cost", async () => {
    const route = createRouteHandler({
      requireAuth: true,
      rateLimit: { type: "account", operation: "paymentTransition" },
      handler: () => new Response("OK"),
    });
    const makeRequest = () =>
      new Request("http://localhost/api/test", {
        method: "POST",
        headers: { [ACTOR_HEADER]: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB" },
      });

    for (let requestNumber = 0; requestNumber < 5; requestNumber += 1) {
      await expect(route(makeRequest())).resolves.toMatchObject({ status: 200 });
    }

    await expect(route(makeRequest())).resolves.toMatchObject({ status: 429 });
  });

  it("charges simple reads one quota unit", async () => {
    const route = createRouteHandler({
      rateLimit: { type: "ip", operation: "read" },
      handler: () => new Response("OK"),
    });

    await route(
      new Request("http://localhost/api/test", {
        headers: { "cf-connecting-ip": "192.0.2.1" },
      }),
    );

    const repository = (globalThis as any).__stealthApiRepository as MemoryApiRepository;
    await expect(repository.getCounter("abuse:ip:192.0.2.1")).resolves.toBe(1);
  });

  it("adds Cache-Control headers if configured", async () => {
    const handler = createRouteHandler({
      cacheSeconds: 60,
      handler: () => new Response("OK", { status: 200 }),
    });

    const request = new Request("http://localhost/api/test", { method: "GET" });
    const response = await handler(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
  });

  const cors = {
    allowedOrigins: ["https://mail.example.com"],
    allowedMethods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "X-Request-Id"],
    allowCredentials: true,
  } as const;

  it("grants CORS access to an allowed origin", async () => {
    const handler = createRouteHandler({ cors, handler: () => new Response("OK") });
    const response = await handler(
      new Request("http://localhost/api/test", {
        headers: { Origin: "https://mail.example.com" },
      }),
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://mail.example.com");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Vary")).toContain("Origin");
  });

  it("does not grant CORS access to a denied origin", async () => {
    const routeHandler = vi.fn(() => new Response("OK"));
    const handler = createRouteHandler({ cors, handler: routeHandler });
    const response = await handler(
      new Request("http://localhost/api/test", {
        headers: { Origin: "https://attacker.example" },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(routeHandler).not.toHaveBeenCalled();
  });

  it("does not allow the null origin unless it is explicitly configured", async () => {
    const handler = createRouteHandler({ cors, handler: () => new Response("OK") });
    const response = await handler(
      new Request("http://localhost/api/test", { headers: { Origin: "null" } }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers an allowed preflight with the configured methods and headers", async () => {
    const routeHandler = vi.fn(() => new Response("should not run"));
    const handler = createRouteHandler({ cors, requireAuth: true, handler: routeHandler });
    const response = await handler(
      new Request("http://localhost/api/test", {
        method: "OPTIONS",
        headers: {
          Origin: "https://mail.example.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type, x-request-id",
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Request-Id");
    expect(response.headers.get("Vary")).toBe(
      "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
    );
    expect(routeHandler).not.toHaveBeenCalled();
  });

  it("rejects a denied preflight without CORS headers", async () => {
    const handler = createRouteHandler({ cors, handler: () => new Response("OK") });
    const response = await handler(
      new Request("http://localhost/api/test", {
        method: "OPTIONS",
        headers: {
          Origin: "https://attacker.example",
          "Access-Control-Request-Method": "POST",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("actively prevents wildcard origins with credentials", () => {
    expect(() =>
      createRouteHandler({
        cors: { ...cors, allowedOrigins: ["*"] },
        handler: () => new Response("OK"),
      }),
    ).toThrow(/wildcard origins cannot be combined with credentials/i);
  });
});
