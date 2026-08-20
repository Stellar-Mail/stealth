import { beforeEach, describe, expect, it } from "vitest";

import { Route as CompleteRoute } from "@/routes/api/v1/onboarding/complete";
import { Route as DraftRoute } from "@/routes/api/v1/onboarding/draft";
import { MemoryApiRepository } from "@/server/api/memory-repository";

const TEST_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function createRepositoryAndSession(status: "active" | "pending_verification" = "active") {
  const repository = new MemoryApiRepository();
  (globalThis as any).__stealthApiRepository = repository;
  return { repository };
}

describe("GET /api/v1/onboarding/draft", () => {
  beforeEach(() => {
    delete (globalThis as any).__stealthApiRepository;
  });

  it("returns 401 when no session cookie is provided", async () => {
    const request = new Request("http://localhost/api/v1/onboarding/draft", { method: "GET" });
    const handler = (DraftRoute.options.server as any).handlers.GET;
    const response = await handler({ request });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns an empty draft for an authenticated user without a draft", async () => {
    const { repository } = createRepositoryAndSession();
    const user = await repository.createUser({
      userId: "user_draft_get",
      address: TEST_ADDRESS,
      username: "getter",
      email: "getter@stealth.mail",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });
    const session = await repository.createSession({
      sessionId: "sess_draft_get",
      userId: user.userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const request = new Request("http://localhost/api/v1/onboarding/draft", {
      method: "GET",
      headers: { Cookie: `stealth_session=${session.sessionId}` },
    });
    const handler = (DraftRoute.options.server as any).handlers.GET;
    const response = await handler({ request });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.draft).toBeNull();
  });

  it("returns the saved draft for a user mid-flow", async () => {
    const { repository } = createRepositoryAndSession();
    const user = await repository.createUser({
      userId: "user_draft_have",
      address: TEST_ADDRESS,
      username: "haves",
      email: "haves@stealth.mail",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });
    await repository.saveOnboardingDraft({
      userId: user.userId,
      status: "in_progress",
      step: "recovery",
      displayName: "Resumer",
      recoveryAcknowledged: false,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
      version: 2,
    });
    const session = await repository.createSession({
      sessionId: "sess_draft_have",
      userId: user.userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const request = new Request("http://localhost/api/v1/onboarding/draft", {
      method: "GET",
      headers: { Cookie: `stealth_session=${session.sessionId}` },
    });
    const handler = (DraftRoute.options.server as any).handlers.GET;
    const response = await handler({ request });
    const body = await response.json();
    expect(body.data.draft).toMatchObject({
      status: "in_progress",
      step: "recovery",
      displayName: "Resumer",
    });
    expect(body.data.draft).not.toHaveProperty("version");
    expect(body.data.draft).not.toHaveProperty("userId");
  });
});

describe("PUT /api/v1/onboarding/draft", () => {
  beforeEach(() => {
    delete (globalThis as any).__stealthApiRepository;
  });

  async function sendPut(repository: MemoryApiRepository, sessionId: string, payload: unknown) {
    const request = new Request("http://localhost/api/v1/onboarding/draft", {
      method: "PUT",
      headers: {
        Cookie: `stealth_session=${sessionId}`,
        "Content-Type": "application/json",
      },
      body: payload === "" ? "" : JSON.stringify(payload),
    });
    const handler = (DraftRoute.options.server as any).handlers.PUT;
    return handler({ request });
  }

  async function makeUser(repository: MemoryApiRepository) {
    const user = await repository.createUser({
      userId: "user_draft_put",
      address: TEST_ADDRESS,
      username: "puter",
      email: "puter@stealth.mail",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });
    const session = await repository.createSession({
      sessionId: "sess_draft_put",
      userId: user.userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    return { user, session };
  }

  const PAYLOAD = {
    step: "postage",
    draft: {
      displayName: "Ada",
      recoveryAcknowledged: true,
      unknownSenderRule: "verified",
      minimumPostage: "0.001",
      receiptOnDelivery: true,
    },
  };

  it("saves the draft keyed by the session user", async () => {
    const { repository } = createRepositoryAndSession();
    const { user, session } = await makeUser(repository);

    const response = await sendPut(repository, session.sessionId, PAYLOAD);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.draft).toMatchObject({ status: "in_progress", step: "postage" });

    const stored = await repository.getOnboardingDraft(user.userId);
    expect(stored).toMatchObject({ step: "postage", version: 1 });
  });

  it("rejects unknown fields such as walletAddress with 422", async () => {
    const { repository } = createRepositoryAndSession();
    const { session } = await makeUser(repository);

    const response = await sendPut(repository, session.sessionId, {
      ...PAYLOAD,
      draft: { ...PAYLOAD.draft, walletAddress: `G${"A".repeat(55)}` },
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects an empty body with 400", async () => {
    const { repository } = createRepositoryAndSession();
    const { session } = await makeUser(repository);
    const response = await sendPut(repository, session.sessionId, "");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
  });

  it("returns 401 without a valid session", async () => {
    const { repository } = createRepositoryAndSession();
    const response = await sendPut(repository, "sess_invalid", PAYLOAD);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns 409 when onboarding is already complete", async () => {
    const { repository } = createRepositoryAndSession();
    const { user, session } = await makeUser(repository);
    await repository.saveOnboardingDraft({
      userId: user.userId,
      status: "completed",
      step: "review",
      displayName: "Ada",
      recoveryAcknowledged: true,
      unknownSenderRule: "verified",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    });

    const response = await sendPut(repository, session.sessionId, PAYLOAD);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_state_transition");
  });
});

describe("POST /api/v1/onboarding/complete", () => {
  beforeEach(() => {
    delete (globalThis as any).__stealthApiRepository;
  });

  async function sendPost(
    repository: MemoryApiRepository,
    sessionId: string,
    payload: unknown,
    idempotencyKey?: string,
  ) {
    const headers: Record<string, string> = {
      Cookie: `stealth_session=${sessionId}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
    const request = new Request("http://localhost/api/v1/onboarding/complete", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const handler = (CompleteRoute.options.server as any).handlers.POST;
    return handler({ request });
  }

  async function makeActiveUser(repository: MemoryApiRepository) {
    const user = await repository.createUser({
      userId: "user_complete",
      address: TEST_ADDRESS,
      username: "completer",
      email: "completer@stealth.mail",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });
    const session = await repository.createSession({
      sessionId: "sess_complete",
      userId: user.userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    return { user, session };
  }

  const PAYLOAD = {
    draft: {
      displayName: "Ada",
      recoveryAcknowledged: true,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
    },
  };

  it("completes onboarding and writes the mailbox policy", async () => {
    const { repository } = createRepositoryAndSession();
    const { user, session } = await makeActiveUser(repository);

    const response = await sendPost(repository, session.sessionId, PAYLOAD);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.alreadyCompleted).toBe(false);
    expect(body.data.draft.status).toBe("completed");
    expect(body.data.draft.completedAt).toBeDefined();
    expect(body.data.policy.minimumPostage).toBe("0");

    const stored = await repository.getPolicy(user.address);
    expect(stored?.allowUnknown).toBe(true);
  });

  it("returns 422 for a client-supplied walletAddress", async () => {
    const { repository } = createRepositoryAndSession();
    const { session } = await makeActiveUser(repository);
    const response = await sendPost(repository, session.sessionId, {
      draft: { ...PAYLOAD.draft, walletAddress: `G${"A".repeat(55)}` },
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("validation_error");
  });

  it("restricts completion to active accounts (409)", async () => {
    const repository = new MemoryApiRepository();
    (globalThis as any).__stealthApiRepository = repository;
    const user = await repository.createUser({
      userId: "user_complete_pending",
      address: TEST_ADDRESS,
      username: "underage",
      email: "underage@stealth.mail",
      status: "pending_verification",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });
    const session = await repository.createSession({
      sessionId: "sess_complete_pending",
      userId: user.userId,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const response = await sendPost(repository, session.sessionId, PAYLOAD);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_state_transition");
  });

  it("replays an already-completed onboarding without re-writing the policy", async () => {
    const { repository } = createRepositoryAndSession();
    const { user, session } = await makeActiveUser(repository);
    await repository.saveOnboardingDraft({
      userId: user.userId,
      status: "completed",
      step: "review",
      displayName: "Ada",
      recoveryAcknowledged: true,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:00.000Z",
      version: 1,
    });

    const response = await sendPost(repository, session.sessionId, PAYLOAD);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.alreadyCompleted).toBe(true);
    expect(body.data.draft.status).toBe("completed");

    const draft = await repository.getOnboardingDraft(user.userId);
    expect(draft?.version).toBe(1);
  });

  it("is idempotent: the same key replays without a second commit", async () => {
    const { repository } = createRepositoryAndSession();
    const { user, session } = await makeActiveUser(repository);
    const key = "key-1";

    const first = await sendPost(repository, session.sessionId, PAYLOAD, key);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-idempotency-replayed")).toBeNull();
    const firstBody = await first.json();

    const second = await sendPost(repository, session.sessionId, PAYLOAD, key);
    expect(second.status).toBe(200);
    expect(second.headers.get("x-idempotency-replayed")).toBe("true");
    const secondBody = await second.json();
    expect(secondBody.data).toEqual(firstBody.data);

    const draft = await repository.getOnboardingDraft(user.userId);
    expect(draft?.version).toBe(1);
    const policyWrites = await repository.getPolicyWriteIntent(user.address);
    expect(policyWrites).not.toBeNull();
  });
});
