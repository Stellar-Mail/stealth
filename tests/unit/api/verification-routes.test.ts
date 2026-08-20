import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as ResendRoute } from "../../../src/routes/api/v1/auth/resend-verification";
import { Route as VerifyRoute } from "../../../src/routes/api/v1/auth/verify";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  getVerificationNotificationAdapter,
  setVerificationAdapterForTesting,
} from "../../../src/server/api/verification-delivery";
import { SinkNotificationAdapter } from "../../../src/services/notifications/sink";

const verifyHandler = (VerifyRoute.options as any).server?.handlers?.POST;
const resendHandler = (ResendRoute.options as any).server?.handlers?.POST;

const pendingUser = {
  userId: "usr_route_1",
  address: `G${"F".repeat(55)}`,
  email: "carol@stealth.mail",
  username: "carol_stealth",
  status: "pending_verification" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
};

function postRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function parseJson(response: Response) {
  return response.clone().json() as Promise<{
    data?: Record<string, unknown>;
    error?: { code: string; message: string; retryable: boolean; details?: unknown };
  }>;
}

describe("BETA-005: verification endpoints (route-level tests)", () => {
  let repo: MemoryApiRepository;
  let sink: SinkNotificationAdapter;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
    sink = new SinkNotificationAdapter();
    setVerificationAdapterForTesting(sink);
    await repo.createUser(pendingUser);
  });

  afterEach(() => {
    setVerificationAdapterForTesting(null);
    repo.reset();
  });

  describe("POST /api/v1/auth/verify", () => {
    it("verifies an account with a valid token", async () => {
      const adapter = await getVerificationNotificationAdapter();
      expect(adapter).toBe(sink);

      const resend = await resendHandler({
        request: postRequest("https://stealth.test/api/v1/auth/resend-verification", {
          email: pendingUser.email,
        }),
      });
      expect(resend.status).toBe(200);

      const message = sink.latestMessage;
      const token = message!.verificationUrl.split("token=")[1];
      const response = await verifyHandler({
        request: postRequest("https://stealth.test/api/v1/auth/verify", {
          email: pendingUser.email,
          token,
        }),
      });

      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.data).toEqual({ verified: true });
      const user = await repo.getUserById(pendingUser.userId);
      expect(user!.status).toBe("active");
    });

    it("reports token state without revealing account existence", async () => {
      const response = await verifyHandler({
        request: postRequest("https://stealth.test/api/v1/auth/verify", {
          email: pendingUser.email,
          token: "not-a-real-token",
        }),
      });

      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.data).toEqual({ verified: false, reason: "invalid_token" });
    });

    it("accepts a replayed token as verified (idempotent retries)", async () => {
      await resendHandler({
        request: postRequest("https://stealth.test/api/v1/auth/resend-verification", {
          email: pendingUser.email,
        }),
      });
      const token = sink.latestMessage!.verificationUrl.split("token=")[1];

      const first = await verifyHandler({
        request: postRequest("https://stealth.test/api/v1/auth/verify", {
          email: pendingUser.email,
          token,
        }),
      });
      const second = await verifyHandler({
        request: postRequest("https://stealth.test/api/v1/auth/verify", {
          email: pendingUser.email,
          token,
        }),
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect((await parseJson(second)).data).toEqual({ verified: true });
    });

    it("rejects an invalid email with 422", async () => {
      const response = await verifyHandler({
        request: postRequest("https://stealth.test/api/v1/auth/verify", {
          email: "not-an-email",
          token: "abc",
        }),
      });
      expect(response.status).toBe(422);
      expect((await parseJson(response)).error?.code).toBe("validation_error");
    });

    it("rejects an empty token with 422", async () => {
      const response = await verifyHandler({
        request: postRequest("https://stealth.test/api/v1/auth/verify", {
          email: pendingUser.email,
          token: "  ",
        }),
      });
      expect(response.status).toBe(422);
      expect((await parseJson(response)).error?.code).toBe("validation_error");
    });
  });

  describe("POST /api/v1/auth/resend-verification", () => {
    it("sends a verification message for a pending account", async () => {
      const response = await resendHandler({
        request: postRequest("https://stealth.test/api/v1/auth/resend-verification", {
          email: pendingUser.email,
        }),
      });

      expect(response.status).toBe(200);
      const body = await parseJson(response);
      expect(body.data).toEqual({ status: "sent" });
      expect(sink.size).toBe(1);
      expect(sink.latestMessage!.to).toBe(pendingUser.email);
    });

    it("responds identically for unknown emails (no account enumeration)", async () => {
      const response = await resendHandler({
        request: postRequest("https://stealth.test/api/v1/auth/resend-verification", {
          email: "ghost@stealth.mail",
        }),
      });

      expect(response.status).toBe(200);
      expect((await parseJson(response)).data).toEqual({ status: "sent" });
      expect(sink.size).toBe(0);
    });

    it("returns 429 during the resend cooldown with a retry-after window", async () => {
      await resendHandler({
        request: postRequest("https://stealth.test/api/v1/auth/resend-verification", {
          email: pendingUser.email,
        }),
      });

      const response = await resendHandler({
        request: postRequest("https://stealth.test/api/v1/auth/resend-verification", {
          email: pendingUser.email,
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

    it("allows a resend after the cooldown has elapsed", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
      try {
        await resendHandler({
          request: postRequest("https://stealth.test/api/v1/auth/resend-verification", {
            email: pendingUser.email,
          }),
        });

        vi.setSystemTime(new Date("2026-02-01T00:01:01.000Z"));
        const response = await resendHandler({
          request: postRequest("https://stealth.test/api/v1/auth/resend-verification", {
            email: pendingUser.email,
          }),
        });

        expect(response.status).toBe(200);
        expect(sink.size).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("rejects an invalid email with 422", async () => {
      const response = await resendHandler({
        request: postRequest("https://stealth.test/api/v1/auth/resend-verification", {
          email: "invalid",
        }),
      });
      expect(response.status).toBe(422);
      expect((await parseJson(response)).error?.code).toBe("validation_error");
    });
  });
});
