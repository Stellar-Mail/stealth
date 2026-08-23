import { describe, expect, it } from "vitest";

import { Route as HealthRoute } from "../../../src/routes/api/v1/health";
import { corsPolicyFromEnv, csrfEarlyResponse } from "../../../src/server/api/cors";

const healthHandler = (HealthRoute.options as any).server?.handlers?.GET;

describe("API route CORS integration", () => {
  it("rejects a disallowed origin before executing an actual API route", async () => {
    const response = await healthHandler({
      request: new Request("http://localhost/api/v1/health", {
        headers: { Origin: "https://attacker.example" },
      }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects a cookie-bearing state change without browser origin context", async () => {
    const response = csrfEarlyResponse(
      new Request("https://app.stealth.mail/api/v1/health", {
        method: "POST",
        headers: { cookie: "stealth_session=redacted" },
      }),
      corsPolicyFromEnv({
        STEALTH_ENV: "production",
        STEALTH_CORS_ALLOWED_ORIGINS: "https://app.stealth.mail",
      }),
    );

    expect(response?.status).toBe(403);
  });
});
