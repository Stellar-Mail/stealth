import { describe, expect, it } from "vitest";

import { applySecurityHeaders } from "../../../src/server/security/headers";

describe("server security headers", () => {
  it("applies browser boundary headers to non-API responses", () => {
    const response = applySecurityHeaders(new Response("page", { status: 404 }));

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "img-src 'self' data: blob: https://api.dicebear.com",
    );
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
  });
});
