import { describe, expect, it } from "vitest";

import { ADMIN_ADDRESSES_ENV, getAdminAllowlist, requireAdmin } from "@/server/api/admin-auth";
import { ApiError } from "@/server/api/errors";
import type { ApiContext } from "@/server/api/context";

const ADMIN = `G${"A".repeat(55)}`;
const USER = `G${"B".repeat(55)}`;

const emptyTrace = { traceId: "t", spanId: "s", traceFlags: "00" };

function ctx(address?: string): ApiContext {
  if (!address) {
    return {
      repository: {} as ApiContext["repository"],
      principal: null,
      isAuthenticated: false,
      traceContext: emptyTrace,
    };
  }
  return {
    repository: {} as ApiContext["repository"],
    principal: {
      address,
      authMethod: "header",
      authenticatedAt: new Date(),
      metadata: {},
    },
    isAuthenticated: true,
    traceContext: emptyTrace,
  };
}

describe("requireAdmin", () => {
  it("parses a comma-separated allowlist of Stellar addresses", () => {
    const set = getAdminAllowlist({
      [ADMIN_ADDRESSES_ENV]: `${ADMIN}, ${USER}`,
    } as NodeJS.ProcessEnv);
    expect(set.has(ADMIN)).toBe(true);
    expect(set.has(USER)).toBe(true);
  });

  it("fails closed when the allowlist is empty", () => {
    const previous = process.env[ADMIN_ADDRESSES_ENV];
    delete process.env[ADMIN_ADDRESSES_ENV];
    try {
      expect(() => requireAdmin(ctx(ADMIN))).toThrow(ApiError);
      try {
        requireAdmin(ctx(ADMIN));
      } catch (error) {
        expect((error as ApiError).status).toBe(403);
      }
    } finally {
      if (previous === undefined) delete process.env[ADMIN_ADDRESSES_ENV];
      else process.env[ADMIN_ADDRESSES_ENV] = previous;
    }
  });

  it("rejects unauthenticated callers with 401", () => {
    process.env[ADMIN_ADDRESSES_ENV] = ADMIN;
    try {
      requireAdmin(ctx());
      expect.unreachable();
    } catch (error) {
      expect((error as ApiError).status).toBe(401);
    } finally {
      delete process.env[ADMIN_ADDRESSES_ENV];
    }
  });

  it("rejects authenticated non-admins with 403", () => {
    process.env[ADMIN_ADDRESSES_ENV] = ADMIN;
    try {
      requireAdmin(ctx(USER));
      expect.unreachable();
    } catch (error) {
      expect((error as ApiError).status).toBe(403);
    } finally {
      delete process.env[ADMIN_ADDRESSES_ENV];
    }
  });

  it("returns the address for an allowlisted admin", () => {
    process.env[ADMIN_ADDRESSES_ENV] = ADMIN;
    try {
      expect(requireAdmin(ctx(ADMIN))).toBe(ADMIN);
    } finally {
      delete process.env[ADMIN_ADDRESSES_ENV];
    }
  });
});
