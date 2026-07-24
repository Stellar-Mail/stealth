import { describe, expect, it } from "vitest";

import { parseJsonBody } from "../../../src/server/api/request";
import { z } from "zod";

describe("parseJsonBody Content-Length validation", () => {
  it("accepts missing Content-Length", async () => {
    const schema = z.object({ amount: z.number() });
    const request = new Request("https://stealth.test/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 1 }),
    });

    await expect(parseJsonBody(request, schema, 1024)).resolves.toEqual({ amount: 1 });
  });

  it("rejects negative Content-Length", async () => {
    const schema = z.object({ amount: z.number() });
    const request = new Request("https://stealth.test/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "-4" },
    });

    await expect(parseJsonBody(request, schema)).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
    });
  });

  it("rejects fractional Content-Length", async () => {
    const schema = z.object({ amount: z.number() });
    const request = new Request("https://stealth.test/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "10.5" },
    });

    await expect(parseJsonBody(request, schema)).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
    });
  });

  it("rejects non-numeric Content-Length", async () => {
    const schema = z.object({ amount: z.number() });
    const request = new Request("https://stealth.test/api/pay", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "abc" },
    });

    await expect(parseJsonBody(request, schema)).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
    });
  });

  it("rejects when declared length exceeds maxBytes while actual body is smaller", async () => {
    const schema = z.object({ amount: z.number() });
    const request = new Request("https://stealth.test/api/pay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(1024 * 1024),
      },
      body: JSON.stringify({ amount: 1 }),
    });

    await expect(parseJsonBody(request, schema, 128)).rejects.toMatchObject({
      status: 413,
    });
  });
});
