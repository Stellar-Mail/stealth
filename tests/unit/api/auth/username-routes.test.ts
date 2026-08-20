import { beforeEach, describe, expect, it } from "vitest";

import { Route as CheckRoute } from "@/routes/api/v1/auth/username/check";
import { Route as ReserveRoute } from "@/routes/api/v1/auth/username/reserve";
import { MemoryApiRepository } from "@/server/api/memory-repository";

const TEST_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("Username Availability & Reservation API Endpoints (BETA-003)", () => {
  beforeEach(() => {
    delete (globalThis as any).__stealthApiRepository;
  });

  describe("GET /api/v1/auth/username/check", () => {
    it("returns available: true for valid available username", async () => {
      const repository = new MemoryApiRepository();
      (globalThis as any).__stealthApiRepository = repository;

      const request = new Request(
        "http://localhost/api/v1/auth/username/check?username=available_user",
        {
          method: "GET",
        },
      );

      const handler = (CheckRoute.options.server as any).handlers.GET;
      const response = await handler({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.available).toBe(true);
      expect(body.data.normalized).toBe("available_user");
      expect(body.data.canonicalEmail).toBe("available_user@stealth.me");
      expect(body.data.federationHandle).toBe("available_user*stealth.me");
    });

    it("returns available: false for system reserved word", async () => {
      const repository = new MemoryApiRepository();
      (globalThis as any).__stealthApiRepository = repository;

      const request = new Request("http://localhost/api/v1/auth/username/check?username=admin", {
        method: "GET",
      });

      const handler = (CheckRoute.options.server as any).handlers.GET;
      const response = await handler({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.available).toBe(false);
      expect(body.data.reason).toBe("reserved_word");
    });

    it("returns available: false for username already registered by another user", async () => {
      const repository = new MemoryApiRepository();
      (globalThis as any).__stealthApiRepository = repository;

      await repository.createUser({
        userId: "user_1",
        address: TEST_ADDRESS,
        username: "existing_user",
        email: "existing@stealth.mail",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      });

      const request = new Request(
        "http://localhost/api/v1/auth/username/check?username=EXISTING_USER",
        {
          method: "GET",
        },
      );

      const handler = (CheckRoute.options.server as any).handlers.GET;
      const response = await handler({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.available).toBe(false);
      expect(body.data.reason).toBe("already_taken");
    });

    it("returns available: false for homoglyph / confusable characters", async () => {
      const repository = new MemoryApiRepository();
      (globalThis as any).__stealthApiRepository = repository;

      // Cyrillic 'а'
      const request = new Request(
        "http://localhost/api/v1/auth/username/check?username=%D0%B0dmin",
        {
          method: "GET",
        },
      );

      const handler = (CheckRoute.options.server as any).handlers.GET;
      const response = await handler({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.available).toBe(false);
      expect(body.data.reason).toBe("confusable_characters");
    });
  });

  describe("POST /api/v1/auth/username/reserve", () => {
    it("atomically reserves username for a new visitor", async () => {
      const repository = new MemoryApiRepository();
      (globalThis as any).__stealthApiRepository = repository;

      const request = new Request("http://localhost/api/v1/auth/username/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ClaimUser99" }),
      });

      const handler = (ReserveRoute.options.server as any).handlers.POST;
      const response = await handler({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.outcome).toBe("reserved");
      expect(body.data.canonicalEmail).toBe("claimuser99@stealth.me");
      expect(body.data.federationHandle).toBe("claimuser99*stealth.me");

      // Verify stored reservation in repository
      const stored = await repository.getUsernameReservation("claimuser99");
      expect(stored).not.toBeNull();
      expect(stored?.username).toBe("claimuser99");
    });

    it("produces exactly one winner for concurrent claim attempts", async () => {
      const repository = new MemoryApiRepository();
      (globalThis as any).__stealthApiRepository = repository;

      const makeClaim = (userId: string) => {
        const request = new Request("http://localhost/api/v1/auth/username/reserve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "contested_handle", userId }),
        });
        const handler = (ReserveRoute.options.server as any).handlers.POST;
        return handler({ request });
      };

      const [res1, res2] = await Promise.all([
        makeClaim("user_actor_A"),
        makeClaim("user_actor_B"),
      ]);

      const body1 = await res1.json();
      const body2 = await res2.json();

      const outcomes = [body1.data.outcome, body2.data.outcome];
      expect(outcomes).toContain("reserved");
      expect(outcomes).toContain("unavailable");
    });
  });
});
