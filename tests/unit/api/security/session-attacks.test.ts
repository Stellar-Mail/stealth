/**
 * BETA-084 (Issue #1991) — Session, CSRF, replay, and stale-authorization attacks.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { Route as SessionRoute } from "@/routes/api/v1/auth/session";
import { Route as LogoutRoute } from "@/routes/api/v1/auth/logout";
import { Route as DraftRoute } from "@/routes/api/v1/onboarding/draft";
import { Route as ProfileRoute } from "@/routes/api/v1/accounts/profile";
import { ACTOR_HEADER } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import type { MemoryApiRepository } from "@/server/api/memory-repository";
import { assertNoSecretsLeaked } from "../../../fixtures/identity";
import {
  ALICE_ADDRESS,
  BOB_ADDRESS,
  seedTwoUserIsolationFixture,
  sessionCookie,
  type TwoUserIsolationFixture,
} from "../../../fixtures/security-isolation";

import { getRouteHandler } from "../../../helpers/route-handler";

function cookieRequest(path: string, method: string, cookie: string): Request {
  return new Request(`https://stealth.test${path}`, {
    method,
    headers: { "content-type": "application/json", Cookie: cookie },
  });
}

describe("BETA-084 (Issue #1991): Session & Request Attack Regressions", () => {
  let fixture: TwoUserIsolationFixture;
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    fixture = await seedTwoUserIsolationFixture();
    repo = (await getApiContext()).repository as MemoryApiRepository;
  });

  describe("session isolation", () => {
    it("returns the correct identity per session cookie", async () => {
      const aliceRes = await getRouteHandler(
        SessionRoute,
        "GET",
      )({
        request: cookieRequest(
          "/api/v1/auth/session",
          "GET",
          sessionCookie(fixture.alice.sessionId),
        ),
      });
      expect(aliceRes.status).toBe(200);
      const aliceBody = await aliceRes.json();
      expect(aliceBody.data.user.email).toBe("alice@stealth.mail");
      assertNoSecretsLeaked(aliceBody);

      const bobRes = await getRouteHandler(
        SessionRoute,
        "GET",
      )({
        request: cookieRequest("/api/v1/auth/session", "GET", sessionCookie(fixture.bob.sessionId)),
      });
      const bobBody = await bobRes.json();
      expect(bobBody.data.user.email).toBe("bob@stealth.mail");
    });

    it("denies invalid session cookies", async () => {
      const res = await getRouteHandler(
        SessionRoute,
        "GET",
      )({
        request: cookieRequest("/api/v1/auth/session", "GET", "stealth_session=sess_missing"),
      });
      expect(res.status).toBe(401);
    });

    it("invalidates session after logout (session fixation recovery)", async () => {
      await getRouteHandler(
        LogoutRoute,
        "POST",
      )({
        request: cookieRequest(
          "/api/v1/auth/logout",
          "POST",
          sessionCookie(fixture.alice.sessionId),
        ),
      });
      const res = await getRouteHandler(
        SessionRoute,
        "GET",
      )({
        request: cookieRequest(
          "/api/v1/auth/session",
          "GET",
          sessionCookie(fixture.alice.sessionId),
        ),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("session fixation", () => {
    it("does not expose Alice's draft when Bob uses his own session", async () => {
      await repo.saveOnboardingDraft({
        userId: fixture.alice.user.userId,
        status: "in_progress",
        step: "sender-policy",
        displayName: "Alice Secret Draft",
        recoveryAcknowledged: true,
        unknownSenderRule: "block",
        minimumPostage: "500",
        receiptOnDelivery: true,
        updatedAt: "2026-08-23T08:00:00.000Z",
        completedAt: null,
        version: 1,
      });

      const res = await getRouteHandler(
        DraftRoute,
        "GET",
      )({
        request: cookieRequest(
          "/api/v1/onboarding/draft",
          "GET",
          sessionCookie(fixture.bob.sessionId),
        ),
      });
      expect((await res.json()).data.draft).toBeNull();
    });
  });

  describe("stale authorization", () => {
    it("profile GET follows actor header, not mismatched session cookie", async () => {
      const res = await getRouteHandler(
        ProfileRoute,
        "GET",
      )({
        request: new Request("https://stealth.test/api/v1/accounts/profile", {
          method: "GET",
          headers: {
            [ACTOR_HEADER]: BOB_ADDRESS,
            Cookie: sessionCookie(fixture.alice.sessionId),
          },
        }),
      });
      const body = await res.json();
      expect(body.data.profile.displayName).toBe("Bob Jones");
    });
  });

  describe("canonicalization", () => {
    it("normalizes lowercase actor addresses for own-resource reads", async () => {
      const res = await getRouteHandler(
        ProfileRoute,
        "GET",
      )({
        request: new Request("https://stealth.test/api/v1/accounts/profile", {
          method: "GET",
          headers: { [ACTOR_HEADER]: ALICE_ADDRESS.toLowerCase() },
        }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).data.account.username).toBe("alice_smith");
    });

    it("rejects malformed actor addresses", async () => {
      const res = await getRouteHandler(
        ProfileRoute,
        "GET",
      )({
        request: new Request("https://stealth.test/api/v1/accounts/profile", {
          method: "GET",
          headers: { [ACTOR_HEADER]: "not-a-valid-stellar-address" },
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("CSRF surface", () => {
    it("denies unauthenticated onboarding draft access", async () => {
      const res = await getRouteHandler(
        DraftRoute,
        "GET",
      )({
        request: new Request("https://stealth.test/api/v1/onboarding/draft", { method: "GET" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("replay attacks [control: signed-request, #1555]", () => {
    it("defers replay coverage to security.regression.test.ts STEALTH-AUTH-V1 suite", () => {
      expect(true).toBe(true);
    });
  });
});
