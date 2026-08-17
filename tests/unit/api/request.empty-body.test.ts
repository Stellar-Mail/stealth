import { describe, expect, it } from "vitest";

import { parseJsonBody } from "../../../src/server/api/request";
import { z } from "zod";

describe("parseJsonBody empty/whitespace handling", () => {
  it("rejects an empty required body", async () => {
    const request = new Request("https://stealth.test/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "",
    });

    await expect(parseJsonBody(request, z.object({ amount: z.number() }))).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
    });
  });

  it("rejects whitespace-only bodies", async () => {
    const request = new Request("https://stealth.test/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "   \t\n  ",
    });

    await expect(parseJsonBody(request, z.object({ amount: z.number() }))).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
    });
  });

  it("keeps malformed JSON distinguishable from empty body", async () => {
    const request = new Request("https://stealth.test/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    await expect(parseJsonBody(request, z.object({ amount: z.number() }))).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
    });
  });
});
