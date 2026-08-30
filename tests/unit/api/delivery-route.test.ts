import { beforeEach, describe, expect, it } from "vitest";

import { Route as DeliveryRoute } from "../../../src/routes/api/v1/delivery/$messageId";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { transitionDeliveryState } from "../../../src/server/api/delivery-service";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

const sender = `G${"A".repeat(55)}`;
const validMessageId = "a".repeat(64);

const getHandler = (DeliveryRoute.options as any).server?.handlers?.GET;
const postHandler = (DeliveryRoute.options as any).server?.handlers?.POST;

function getRequest(messageId: string = validMessageId) {
  return new Request(`https://stealth.test/api/v1/delivery/${messageId}`, {
    method: "GET",
    headers: { [ACTOR_HEADER]: sender },
  });
}

function postRequest(body: unknown, messageId: string = validMessageId) {
  return new Request(`https://stealth.test/api/v1/delivery/${messageId}`, {
    method: "POST",
    headers: {
      [ACTOR_HEADER]: sender,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function parseJsonResponse(response: Response) {
  return response.clone().json() as Promise<{
    error?: { code: string; message: string; details?: unknown };
    data?: { state: string; isTerminal: boolean; isRetryable: boolean };
  }>;
}

describe("delivery status endpoint (BETA-035 route-level tests)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  it("returns 404 when no delivery status exists", async () => {
    const response = await getHandler({
      request: getRequest(),
      params: { messageId: validMessageId },
    });

    expect(response.status).toBe(404);
    const body = await parseJsonResponse(response);
    expect(body.error?.code).toBe("not_found");
  });

  it("returns public delivery status on GET", async () => {
    await transitionDeliveryState(repo, validMessageId, "queued", sender, "Enqueued");

    const response = await getHandler({
      request: getRequest(),
      params: { messageId: validMessageId },
    });

    expect(response.status).toBe(200);
    const body = await parseJsonResponse(response);
    expect(body.data?.state).toBe("queued");
    expect(body.data?.isRetryable).toBe(true);
  });

  it("applies a legal transition on POST", async () => {
    await transitionDeliveryState(repo, validMessageId, "queued", sender, "Enqueued");

    const response = await postHandler({
      request: postRequest({ toState: "accepted", reason: "Relay accepted envelope" }),
      params: { messageId: validMessageId },
    });

    expect(response.status).toBe(200);
    const body = await parseJsonResponse(response);
    expect(body.data?.state).toBe("accepted");
  });

  it("rejects illegal transitions with 409", async () => {
    await transitionDeliveryState(repo, validMessageId, "queued", sender, "Enqueued");
    await transitionDeliveryState(repo, validMessageId, "failed", sender, "Permanent failure");

    const response = await postHandler({
      request: postRequest({ toState: "accepted", reason: "Illegal retry" }),
      params: { messageId: validMessageId },
    });

    expect(response.status).toBe(409);
    const body = await parseJsonResponse(response);
    expect(body.error?.code).toBe("conflict");
  });

  it("rejects invalid messageId with 422", async () => {
    const response = await getHandler({
      request: getRequest("z".repeat(64)),
      params: { messageId: "z".repeat(64) },
    });

    expect(response.status).toBe(422);
    const body = await parseJsonResponse(response);
    expect(body.error?.code).toBe("validation_error");
  });
});
