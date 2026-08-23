import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as CompleteRoute } from "../../../../src/routes/api/v1/auth/password-reset/complete";
import { Route as RequestRoute } from "../../../../src/routes/api/v1/auth/password-reset/request";
import { getApiContext } from "../../../../src/server/api/context";
import { MemoryApiRepository } from "../../../../src/server/api/memory-repository";
import {
  getVerificationNotificationAdapter,
  setVerificationAdapterForTesting,
} from "../../../../src/server/api/verification-delivery";
import { SinkNotificationAdapter } from "../../../../src/services/notifications/sink";

const requestHandler = (RequestRoute.options as any).server?.handlers?.POST;
const completeHandler = (CompleteRoute.options as any).server?.handlers?.POST;

const resetUser = {
  userId: "usr_pwd_route_1",
  address: `G${"A".repeat(55)}`,
  email: "dave@stealth.mail",
  username: "dave_stealth",
  status: "active" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
};

const resetCredential = {
  credentialId: "cred_pwd_route_1",
  userId: resetUser.userId,
  authMethod: "password_hash" as const,
  secretHash: "old-hash:old-salt",
  walletKeyRef: `wallet_${resetUser.userId}`,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function postRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function parseJson(response: Response) {
  return response.clone().json() as Promise<{
    data?: Record<string, unknown>;
    error?: {
      code: string;
      message: string;
      retryable: boolean;
      details?: unknown;
    };
  }>;
}

describe("BETA-009: password reset endpoints (route-level tests)", () => {
  let repo: MemoryApiRepository;
  let sink: SinkNotificationAdapter;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
    sink = new SinkNotificationAdapter();
    setVerificationAdapterForTesting(sink);
    await repo.createUser(resetUser, resetCredential);
  });

  afterEach(() => {
    setVerificationAdapterForTesting(null);
    repo.reset();
  });

  describe("POST /api/v1/auth/password-reset/request", () => {
    it("sends a password reset message for an existing account", async () => {
      const response = await requestHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
          email: resetUser.email,
        }),
      });

      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.data).toEqual({ status: "sent" });
      expect(sink.size).toBe(1);
      expect(sink.latestMessage!.to).toBe(resetUser.email);
      expect(sink.latestMessage!.purpose).toBe("password_reset");
    });

    it("responds identically for unknown emails (no account enumeration)", async () => {
      const response = await requestHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
          email: "ghost@stealth.mail",
        }),
      });

      expect(response.status).toBe(200);
      expect((await parseJson(response)).data).toEqual({ status: "sent" });
      expect(sink.size).toBe(0);
    });

    it("throttles repeated requests to unknown emails identically to registered accounts", async () => {
      const unknownFirst = await requestHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
          email: "ghost@stealth.mail",
        }),
      });
      expect(unknownFirst.status).toBe(200);

      const unknownSecond = await requestHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
          email: "ghost@stealth.mail",
        }),
      });
      expect(unknownSecond.status).toBe(429);
      expect((await parseJson(unknownSecond)).error?.code).toBe("too_many_requests");

      const knownFirst = await requestHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
          email: resetUser.email,
        }),
      });
      expect(knownFirst.status).toBe(200);

      const knownSecond = await requestHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
          email: resetUser.email,
        }),
      });
      expect(knownSecond.status).toBe(429);
      expect((await parseJson(knownSecond)).error?.code).toBe("too_many_requests");

      const unknownBody = await parseJson(unknownSecond);
      const knownBody = await parseJson(knownSecond);
      expect(unknownBody.error?.code).toBe(knownBody.error?.code);
    });

    it("returns 429 during the resend cooldown with a retry-after window", async () => {
      await requestHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
          email: resetUser.email,
        }),
      });

      const response = await requestHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
          email: resetUser.email,
        }),
      });

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).not.toBeNull();
      const body = await parseJson(response);
      expect(body.error?.code).toBe("too_many_requests");
      expect(
        (body.error?.details as { retryAfterSeconds?: number }).retryAfterSeconds,
      ).toBeGreaterThan(0);
      expect(sink.size).toBe(1);
    });

    it("allows a new request after the cooldown has elapsed", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
      try {
        await requestHandler({
          request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
            email: resetUser.email,
          }),
        });

        vi.setSystemTime(new Date("2026-02-01T00:01:01.000Z"));
        const response = await requestHandler({
          request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
            email: resetUser.email,
          }),
        });

        expect(response.status).toBe(200);
        expect(sink.size).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("rejects an invalid email with 422", async () => {
      const response = await requestHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
          email: "not-an-email",
        }),
      });

      expect(response.status).toBe(422);
      expect((await parseJson(response)).error?.code).toBe("validation_error");
    });
  });

  describe("POST /api/v1/auth/password-reset/complete", () => {
    const newPassword = "NewSecurePassword!2026";

    async function requestReset(): Promise<string> {
      const response = await requestHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/request", {
          email: resetUser.email,
        }),
      });
      expect(response.status).toBe(200);
      const token = sink.latestMessage!.verificationUrl.split("token=")[1];
      expect(token).toBeTruthy();
      return token;
    }

    it("completes the reset with a valid token and sets the new password", async () => {
      const token = await requestReset();

      const response = await completeHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
          token,
          password: newPassword,
          passwordConfirmation: newPassword,
          email: resetUser.email,
        }),
      });

      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.data).toMatchObject({ success: true });
      const credential = await repo.getCredential(resetUser.userId);
      expect(credential!.secretHash).not.toBe(resetCredential.secretHash);
    });

    it("revokes existing sessions and clears session cookies", async () => {
      await repo.createSession({
        sessionId: "sess_pwd_route_1",
        userId: resetUser.userId,
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-02-01T00:00:00.000Z",
        lastActiveAt: "2026-01-01T00:00:00.000Z",
      });
      const token = await requestReset();

      const response = await completeHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
          token,
          password: newPassword,
        }),
      });

      expect(response.status).toBe(200);
      expect(await repo.getSession("sess_pwd_route_1")).toBeNull();
      expect(response.headers.get("set-cookie")).toContain("stealth_session=");
    });

    it("rejects an invalid token with 400", async () => {
      const response = await completeHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
          token: "not-a-real-token",
          password: newPassword,
        }),
      });

      expect(response.status).toBe(400);
      expect((await parseJson(response)).error?.code).toBe("bad_request");
    });

    it("rejects a replayed token with 409", async () => {
      const token = await requestReset();

      const first = await completeHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
          token,
          password: newPassword,
        }),
      });
      expect(first.status).toBe(200);

      const replay = await completeHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
          token,
          password: newPassword,
        }),
      });

      expect(replay.status).toBe(409);
      expect((await parseJson(replay)).error?.code).toBe("conflict");
    });

    it("allows exactly one winner when two completions race on the same token", async () => {
      const token = await requestReset();

      const [first, second] = await Promise.all([
        completeHandler({
          request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
            token,
            password: newPassword,
          }),
        }),
        completeHandler({
          request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
            token,
            password: newPassword,
          }),
        }),
      ]);

      const outcomes = [first.status, second.status].sort();
      expect(outcomes).toEqual([200, 409]);

      const credential = await repo.getCredential(resetUser.userId);
      expect(credential!.secretHash.split(":")[0]).not.toBe(
        resetCredential.secretHash.split(":")[0],
      );
    });

    it("rejects a weak password with 422", async () => {
      const token = await requestReset();

      const response = await completeHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
          token,
          password: "weak",
        }),
      });

      expect(response.status).toBe(422);
      expect((await parseJson(response)).error?.code).toBe("validation_error");
    });

    it("rejects a missing token with 422", async () => {
      const response = await completeHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
          password: newPassword,
        }),
      });

      expect(response.status).toBe(422);
      expect((await parseJson(response)).error?.code).toBe("validation_error");
    });

    it("rejects a missing password with 422", async () => {
      const token = await requestReset();

      const response = await completeHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
          token,
        }),
      });

      expect(response.status).toBe(422);
      expect((await parseJson(response)).error?.code).toBe("validation_error");
    });

    it("rejects mismatched confirmation with 422", async () => {
      const token = await requestReset();

      const response = await completeHandler({
        request: postRequest("https://stealth.test/api/v1/auth/password-reset/complete", {
          token,
          password: newPassword,
          passwordConfirmation: "DifferentPassword!2026",
        }),
      });

      expect(response.status).toBe(422);
      expect((await parseJson(response)).error?.code).toBe("validation_error");
    });
  });

  describe("verification adapter targeting", () => {
    it("uses the configured notification adapter for delivery", async () => {
      const adapter = await getVerificationNotificationAdapter();
      expect(adapter).toBe(sink);
    });
  });
});
