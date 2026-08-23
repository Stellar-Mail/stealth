import { beforeEach, describe, expect, it } from "vitest";

import { Route as CreateAccountRoute } from "../../../src/routes/api/v1/accounts/index";
import { Route as ProvisioningRoute } from "../../../src/routes/api/v1/accounts/provisioning";
import { Route as RetryRoute } from "../../../src/routes/api/v1/accounts/provisioning/retry";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

// Stable Stellar G-addresses (56 chars starting with G)
const owner = `G${"A".repeat(55)}`;
const operator = `G${"B".repeat(55)}`;
const stranger = `G${"C".repeat(55)}`;

const createHandler = (CreateAccountRoute.options as any).server?.handlers?.POST;
const getHandler = (ProvisioningRoute.options as any).server?.handlers?.GET;
const retryHandler = (RetryRoute.options as any).server?.handlers?.POST;

function provisionRequest(actor: string, body: unknown, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    [ACTOR_HEADER]: actor,
    "content-type": "application/json",
  };
  if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
  return new Request("https://stealth.test/api/v1/accounts", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function provisioningGetRequest(actor: string) {
  return new Request("https://stealth.test/api/v1/accounts/provisioning", {
    method: "GET",
    headers: { [ACTOR_HEADER]: actor },
  });
}

function retryRequest(actor: string) {
  return new Request("https://stealth.test/api/v1/accounts/provisioning/retry", {
    method: "POST",
    headers: { [ACTOR_HEADER]: actor },
  });
}

async function parseJson(response: Response) {
  return response.clone().json() as Promise<{
    error?: { code: string; message: string; retryable?: boolean };
    data?: any;
  }>;
}

describe("POST /api/v1/accounts (provision)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  async function seedFailedRecord() {
    await repo.createUser({
      userId: "usr_alice",
      address: owner,
      email: "alice@stealth.mail",
      username: "alice_dev",
      status: "pending_verification",
      createdAt: "2026-01-15T11:00:00.000Z",
      updatedAt: "2026-01-15T11:00:00.000Z",
      version: 1,
    });
    await repo.createProvisioningRecord({
      userId: "usr_alice",
      status: "failed",
      requestedUsername: "alice_dev",
      displayName: null,
      completedSteps: ["username_reservation", "profile_defaults"],
      currentStep: "profile_defaults",
      attempts: 1,
      failure: {
        step: "profile_defaults",
        code: "invalid_state_transition",
        message: "blocked",
        failedAt: "2026-01-15T11:30:00.000Z",
      },
      startedAt: "2026-01-15T11:00:00.000Z",
      updatedAt: "2026-01-15T11:30:00.000Z",
      version: 3,
    });
  }

  it("rejects requests without an actor header", async () => {
    const request = new Request("https://stealth.test/api/v1/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice_dev" }),
    });

    const response = await createHandler({ request });
    expect(response.status).toBe(401);
    expect((await parseJson(response)).error?.code).toBe("unauthorized");
  });

  it("provisions a full account in one call", async () => {
    const response = await createHandler({
      request: provisionRequest(owner, { username: "alice_dev", email: "alice@stealth.mail" }),
    });

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.data.status).toBe("active");
    expect(body.data.completedSteps).toEqual([
      "username_reservation",
      "profile_defaults",
      "wallet_creation",
      "mailbox_policy_init",
    ]);

    const user = (await repo.getUserByAddress(owner))!;
    expect(user.username).toBe("alice_dev");
    expect(user.status).toBe("active");
    expect(await repo.getWallet(user.userId)).not.toBeNull();
    expect(await repo.getPolicy(owner)).not.toBeNull();
    expect(await repo.getUsernameReservation("alice_dev")).toBeNull();
  });

  it("persists the displayName profile default when provided", async () => {
    const response = await createHandler({
      request: provisionRequest(owner, {
        username: "alice_dev",
        email: "alice@stealth.mail",
        displayName: "Alice Dev",
      }),
    });

    expect(response.status).toBe(200);
    const user = (await repo.getUserByAddress(owner))!;
    expect((await repo.getProfile(user.userId))?.displayName).toBe("Alice Dev");
  });

  it("replays the stored response for a duplicate identical request", async () => {
    const first = await createHandler({
      request: provisionRequest(
        owner,
        { username: "alice_dev", email: "alice@stealth.mail" },
        "prov-key-1",
      ),
    });
    expect(first.status).toBe(200);
    expect(first.headers.get("x-idempotency-replayed")).toBeNull();

    const second = await createHandler({
      request: provisionRequest(
        owner,
        { username: "alice_dev", email: "alice@stealth.mail" },
        "prov-key-1",
      ),
    });
    expect(second.status).toBe(200);
    expect(second.headers.get("x-idempotency-replayed")).toBe("true");
    expect((await parseJson(second)).data).toEqual((await parseJson(first)).data);

    // Exactly one user and one wallet exist.
    const user = (await repo.getUserByAddress(owner))!;
    expect(await repo.getWallet(user.userId)).not.toBeNull();
  });

  it("executes the operation exactly once under concurrent identical duplicates", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        createHandler({
          request: provisionRequest(
            owner,
            { username: "alice_dev", email: "alice@stealth.mail" },
            "concurrent-key",
          ),
        }),
      ),
    );

    const statuses = responses.map((response: Response) => response.status).sort();
    expect(statuses.filter((status: number) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status: number) => status === 409)).toHaveLength(4);

    const user = (await repo.getUserByAddress(owner))!;
    expect(user.status).toBe("active");
    expect(await repo.getWallet(user.userId)).not.toBeNull();
  });

  it("returns a failed provisioning for a username bound to another account", async () => {
    await repo.createUser({
      userId: "usr_bob",
      address: operator,
      email: "bob@stealth.mail",
      username: "taken_name",
      status: "active",
      createdAt: "2026-01-15T11:00:00.000Z",
      updatedAt: "2026-01-15T11:00:00.000Z",
      version: 1,
    });

    const response = await createHandler({
      request: provisionRequest(owner, { username: "taken_name", email: "alice@stealth.mail" }),
    });

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.data.status).toBe("failed");
    expect(body.data.failure.code).toBe("conflict");
    // No account was created for the loser address.
    expect(await repo.getUserByAddress(owner)).toBeNull();
  });

  it("replays a deterministic failed provisioning under an idempotency key", async () => {
    const taken = await repo.createUser({
      userId: "usr_bob",
      address: operator,
      email: "bob@stealth.mail",
      username: "taken_name",
      status: "active",
      createdAt: "2026-01-15T11:00:00.000Z",
      updatedAt: "2026-01-15T11:00:00.000Z",
      version: 1,
    });
    expect(taken).toBeDefined();

    const first = await createHandler({
      request: provisionRequest(
        owner,
        { username: "taken_name", email: "alice@stealth.mail" },
        "failed-key-2",
      ),
    });
    expect(first.status).toBe(200);
    expect((await parseJson(first)).data.status).toBe("failed");

    const second = await createHandler({
      request: provisionRequest(
        owner,
        { username: "taken_name", email: "alice@stealth.mail" },
        "failed-key-2",
      ),
    });
    expect(second.status).toBe(200);
    expect(second.headers.get("x-idempotency-replayed")).toBe("true");
    expect((await parseJson(second)).data).toEqual((await parseJson(first)).data);
  });

  it("rejects re-provisioning a terminal failed record with a cached 409", async () => {
    await seedFailedRecord();

    const first = await createHandler({
      request: provisionRequest(
        owner,
        { username: "alice_dev", email: "alice@stealth.mail" },
        "failed-key",
      ),
    });
    expect(first.status).toBe(409);
    expect((await parseJson(first)).error?.code).toBe("invalid_state_transition");

    const second = await createHandler({
      request: provisionRequest(
        owner,
        { username: "alice_dev", email: "alice@stealth.mail" },
        "failed-key",
      ),
    });
    expect(second.status).toBe(409);
    expect(second.headers.get("x-idempotency-replayed")).toBe("true");
    expect((await parseJson(second)).data?.error?.code).toBe("invalid_state_transition");
  });

  it("rejects an invalid username with 422", async () => {
    const response = await createHandler({
      request: provisionRequest(owner, { username: "!!!", email: "alice@stealth.mail" }),
    });
    expect(response.status).toBe(422);
    expect((await parseJson(response)).error?.code).toBe("validation_error");
  });

  it("rejects an invalid email with 422", async () => {
    const response = await createHandler({
      request: provisionRequest(owner, { username: "alice_dev", email: "not-an-email" }),
    });
    expect(response.status).toBe(422);
    expect((await parseJson(response)).error?.code).toBe("validation_error");
  });

  it("requires a username for a new account", async () => {
    const response = await createHandler({
      request: provisionRequest(owner, { email: "alice@stealth.mail" }),
    });
    expect(response.status).toBe(422);
    expect((await parseJson(response)).error?.code).toBe("validation_error");
  });

  it("requires an email to bootstrap a new account", async () => {
    const response = await createHandler({
      request: provisionRequest(owner, { username: "alice_dev" }),
    });
    expect(response.status).toBe(422);
    expect((await parseJson(response)).error?.code).toBe("validation_error");
  });
});

describe("GET /api/v1/accounts/provisioning (progress)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  it("rejects requests without an actor header", async () => {
    const request = new Request("https://stealth.test/api/v1/accounts/provisioning", {
      method: "GET",
      headers: {},
    });

    const response = await getHandler({ request });
    expect(response.status).toBe(401);
    expect((await parseJson(response)).error?.code).toBe("unauthorized");
  });

  it("returns 404 when no account exists for the address", async () => {
    const response = await getHandler({ request: provisioningGetRequest(owner) });
    expect(response.status).toBe(404);
    expect((await parseJson(response)).error?.code).toBe("not_found");
  });

  it("returns 404 when no provisioning record exists for the account", async () => {
    await repo.createUser({
      userId: "usr_alice",
      address: owner,
      email: "alice@stealth.mail",
      username: "alice_dev",
      status: "active",
      createdAt: "2026-01-15T11:00:00.000Z",
      updatedAt: "2026-01-15T11:00:00.000Z",
      version: 1,
    });

    const response = await getHandler({ request: provisioningGetRequest(owner) });
    expect(response.status).toBe(404);
    expect((await parseJson(response)).error?.code).toBe("not_found");
  });

  it("returns safe progress plus account status", async () => {
    await createHandler({
      request: provisionRequest(owner, { username: "alice_dev", email: "alice@stealth.mail" }),
    });

    const response = await getHandler({ request: provisioningGetRequest(owner) });
    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.data.accountStatus).toBe("active");
    expect(body.data.provisioning.status).toBe("active");
    // Safe projection: no identifiers or secrets leak.
    expect(body.data.provisioning).not.toHaveProperty("userId");
    expect(body.data.provisioning).not.toHaveProperty("email");
  });
});

describe("POST /api/v1/accounts/provisioning/retry", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
  });

  async function seedRetryable(actorAddress: string, username: string) {
    await repo.createUser({
      userId: "usr_retry",
      address: actorAddress,
      email: "alice@stealth.mail",
      username,
      status: "pending_verification",
      createdAt: "2026-01-15T11:00:00.000Z",
      updatedAt: "2026-01-15T11:00:00.000Z",
      version: 1,
    });
    await repo.createProvisioningRecord({
      userId: "usr_retry",
      status: "retryable",
      requestedUsername: username,
      displayName: null,
      completedSteps: ["username_reservation", "profile_defaults"],
      currentStep: "wallet_creation",
      attempts: 1,
      failure: {
        step: "wallet_creation",
        code: "dependency_unavailable",
        message: "down",
        failedAt: "2026-01-15T11:30:00.000Z",
      },
      startedAt: "2026-01-15T11:00:00.000Z",
      updatedAt: "2026-01-15T11:30:00.000Z",
      version: 3,
    });
  }

  it("rejects requests without an actor header", async () => {
    const request = new Request("https://stealth.test/api/v1/accounts/provisioning/retry", {
      method: "POST",
      headers: {},
    });

    const response = await retryHandler({ request });
    expect(response.status).toBe(401);
    expect((await parseJson(response)).error?.code).toBe("unauthorized");
  });

  it("returns 404 when no account exists", async () => {
    const response = await retryHandler({ request: retryRequest(owner) });
    expect(response.status).toBe(404);
    expect((await parseJson(response)).error?.code).toBe("not_found");
  });

  it("resumes a retryable provisioning to active", async () => {
    await seedRetryable(owner, "alice_dev");

    const response = await retryHandler({ request: retryRequest(owner) });
    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.data.status).toBe("active");
    expect(body.data.completedSteps).toEqual([
      "username_reservation",
      "profile_defaults",
      "wallet_creation",
      "mailbox_policy_init",
    ]);

    const user = (await repo.getUserByAddress(owner))!;
    expect(user.status).toBe("active");
    expect(await repo.getWallet(user.userId)).not.toBeNull();
  });

  it("rejects retrying an already-active account", async () => {
    await createHandler({
      request: provisionRequest(owner, { username: "alice_dev", email: "alice@stealth.mail" }),
    });

    const response = await retryHandler({ request: retryRequest(owner) });
    expect(response.status).toBe(409);
    expect((await parseJson(response)).error?.code).toBe("invalid_state_transition");
  });

  it("returns 404 for a non-owner address (owner-scoped retry)", async () => {
    await seedRetryable(owner, "alice_dev");

    const response = await retryHandler({ request: retryRequest(operator) });
    expect(response.status).toBe(404);
    expect((await parseJson(response)).error?.code).toBe("not_found");
  });

  it("leaves the owner's record untouched after a non-owner denied attempt", async () => {
    await seedRetryable(owner, "alice_dev");

    await retryHandler({ request: retryRequest(operator) });

    const record = (await repo.getProvisioningRecord("usr_retry"))!;
    expect(record.status).toBe("retryable");
    const user = (await repo.getUserByAddress(owner))!;
    expect(user.status).toBe("pending_verification");
  });
});
