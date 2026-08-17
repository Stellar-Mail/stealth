import { describe, expect, it } from "vitest";

import { Route as HealthRoute } from "../../../src/routes/api/v1/health";

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
});
