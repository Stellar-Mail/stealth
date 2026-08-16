import { beforeEach, describe, expect, it } from "vitest";

import { Route as AvailabilityRoute } from "../../../src/routes/api/v1/identity/usernames/$username/availability";
import { Route as ReserveRoute } from "../../../src/routes/api/v1/identity/usernames/index";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

const owner = `G${"A".repeat(55)}`;
const otherOwner = `G${"B".repeat(55)}`;
const ip = "203.0.113.5";

const availabilityHandler = (AvailabilityRoute.options as any).server?.handlers?.GET;
const reserveHandler = (ReserveRoute.options as any).server?.handlers?.POST;

function availabilityRequest(username: string, headers: Record<string, string> = {}) {
  return new Request(
    `https://stealth.test/api/v1/identity/usernames/${encodeURIComponent(username)}/availability`,
    { method: "GET", headers: { "cf-connecting-ip": ip, ...headers } },
  );
}

function reserveRequest(
  username: string,
  actor: string,
  extra: { idempotencyKey?: string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    [ACTOR_HEADER]: actor,
    ...(extra.headers ?? {}),
  };
  if (extra.idempotencyKey) headers["x-idempotency-key"] = extra.idempotencyKey;
  return new Request("https://stealth.test/api/v1/identity/usernames", {
    method: "POST",
    headers,
    body: JSON.stringify({ username }),
  });
}

async function parseJson(response: Response) {
  return response.clone().json() as Promise<{
    error?: { code: string; message: string };
    data?: any;
  }>;
}

describe("identity username routes (issue #1910)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  describe("GET /identity/usernames/{username}/availability", () => {
    it("reports an unreserved username as available", async () => {
      const response = await availabilityHandler({
        request: availabilityRequest("alice"),
        params: { username: "alice" },
      });
      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.data).toEqual({ username: "alice", available: true });
    });

    it("reports a taken username as unavailable, without leaking the owner", async () => {
      await reserveHandler({
        request: reserveRequest("alice", owner),
        params: {},
      });

      const response = await availabilityHandler({
        request: availabilityRequest("alice"),
        params: { username: "alice" },
      });
      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.data).toEqual({ username: "alice", available: false });
      expect(JSON.stringify(body)).not.toContain(owner);
    });

    it("treats case/whitespace variants identically to the canonical form", async () => {
      await reserveHandler({ request: reserveRequest("alice", owner), params: {} });

      const response = await availabilityHandler({
        request: availabilityRequest("ALICE"),
        params: { username: "ALICE" },
      });
      const body = await parseJson(response);
      expect(body.data).toEqual({ username: "alice", available: false });
    });

    it("returns a 422 validation error for a reserved word", async () => {
      const response = await availabilityHandler({
        request: availabilityRequest("admin"),
        params: { username: "admin" },
      });
      expect(response.status).toBe(422);
      const body = await parseJson(response);
      expect(body.error?.code).toBe("validation_error");
    });

    it("returns a 422 validation error for a below-minimum-length candidate", async () => {
      const response = await availabilityHandler({
        request: availabilityRequest("ab"),
        params: { username: "ab" },
      });
      expect(response.status).toBe(422);
    });

    it("returns 429 once the per-IP quota is exhausted", async () => {
      await repo.incrementCounter(`abuse:ip:${ip}`, 3600, 100);

      const response = await availabilityHandler({
        request: availabilityRequest("bob"),
        params: { username: "bob" },
      });
      expect(response.status).toBe(429);
      const body = await parseJson(response);
      expect(body.error?.code).toBe("too_many_requests");
    });
  });

  describe("POST /identity/usernames (reserve)", () => {
    it("reserves a username and returns the stealth + federation addresses", async () => {
      const response = await reserveHandler({
        request: reserveRequest("alice", owner),
        params: {},
      });
      expect(response.status).toBe(201);
      const body = await parseJson(response);
      expect(body.data).toMatchObject({
        username: "alice",
        ownerAddress: owner,
        stealthAddress: "alice@stealth.me",
        federationAddress: "alice*stealth.me",
      });
    });

    it("requires authentication", async () => {
      const request = new Request("https://stealth.test/api/v1/identity/usernames", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "alice" }),
      });
      const response = await reserveHandler({ request, params: {} });
      expect(response.status).toBe(401);
    });

    it("rejects a second claim of the same username with 409 username_taken", async () => {
      await reserveHandler({ request: reserveRequest("alice", owner), params: {} });

      const response = await reserveHandler({
        request: reserveRequest("alice", otherOwner),
        params: {},
      });
      expect(response.status).toBe(409);
      const body = await parseJson(response);
      expect(body.error?.code).toBe("username_taken");

      // The original reservation is untouched.
      await expect(repo.getUsernameRecord("alice")).resolves.toMatchObject({
        ownerAddress: owner,
      });
    });

    it("rejects a reserved word with a 422 validation error", async () => {
      const response = await reserveHandler({
        request: reserveRequest("admin", owner),
        params: {},
      });
      expect(response.status).toBe(422);
    });

    it("replays the stored response for a duplicate identical idempotent request", async () => {
      const first = await reserveHandler({
        request: reserveRequest("alice", owner, { idempotencyKey: "reserve-key-1" }),
        params: {},
      });
      expect(first.status).toBe(201);
      expect(first.headers.get("x-idempotency-replayed")).toBeNull();
      const firstBody = await parseJson(first);

      const second = await reserveHandler({
        request: reserveRequest("alice", owner, { idempotencyKey: "reserve-key-1" }),
        params: {},
      });
      expect(second.status).toBe(201);
      expect(second.headers.get("x-idempotency-replayed")).toBe("true");
      const secondBody = await parseJson(second);
      expect(secondBody.data).toEqual(firstBody.data);
    });

    it("executes the reservation exactly once under concurrent identical duplicate requests", async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          reserveHandler({
            request: reserveRequest("alice", owner, { idempotencyKey: "concurrent-reserve-key" }),
            params: {},
          }),
        ),
      );

      const statuses = responses.map((response: Response) => response.status).sort();
      // Exactly one winner (201); every other concurrent duplicate is
      // rejected as in-progress (409) rather than re-running the reservation.
      expect(statuses.filter((status: number) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status: number) => status === 409)).toHaveLength(4);
    });

    it("allows exactly one winner out of concurrent claims for the same username by different owners", async () => {
      // Valid Stellar G-addresses use only base32 characters (A-Z, 2-7);
      // each owner here is a distinct letter repeated to fill the address.
      const owners = ["A", "C", "D", "E", "F", "H"].map((letter) => `G${letter.repeat(55)}`);
      const responses = await Promise.all(
        owners.map((actor) =>
          reserveHandler({ request: reserveRequest("alice", actor), params: {} }),
        ),
      );

      const statuses = responses.map((response: Response) => response.status).sort();
      expect(statuses.filter((status: number) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status: number) => status === 409)).toHaveLength(5);

      const finalRecord = await repo.getUsernameRecord("alice");
      expect(owners).toContain(finalRecord?.ownerAddress);
    });
  });
});
