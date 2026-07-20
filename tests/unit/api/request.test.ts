import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseJsonBody, parseSearchParams } from "../../../src/server/api/request";

describe("API request parsing", () => {
  it("validates JSON bodies", async () => {
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 125 }),
    });

    await expect(
      parseJsonBody(request, z.object({ amount: z.number().int().positive() })),
    ).resolves.toEqual({ amount: 125 });
  });

  it("rejects non-JSON content types", async () => {
    const request = new Request("https://stealth.test/api", {
      method: "POST",
      body: "amount=125",
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toMatchObject({ status: 415 });
  });

  it("coerces and validates search parameters", () => {
    const request = new Request("https://stealth.test/api?limit=10");

    expect(parseSearchParams(request, z.object({ limit: z.coerce.number() }))).toEqual({
      limit: 10,
    });
  });
});


describe('API fuzz tests — malformed inputs', () => {
  it('rejects malformed JSON bytes gracefully', async () => {
    const request = new Request('https://stealth.test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ broken: true, }',
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toBeDefined();
  });

  it('rejects empty body with JSON content-type', async () => {
    const request = new Request('https://stealth.test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '',
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toBeDefined();
  });

  it('rejects null bytes in JSON body', async () => {
    const request = new Request('https://stealth.test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{\\u0000: true}',
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toBeDefined();
  });

  it('rejects excessively large JSON body', async () => {
    const huge = JSON.stringify({ data: 'x'.repeat(1024 * 1024) });
    const request = new Request('https://stealth.test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: huge,
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toBeDefined();
  });

  it('rejects Content-Length mismatch — claims smaller than body', async () => {
    const request = new Request('https://stealth.test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '5' },
      body: JSON.stringify({ valid: true }),
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toBeDefined();
  });

  it('handles duplicate Content-Type headers', async () => {
    const request = new Request('https://stealth.test/api', {
      method: 'POST',
      headers: [
        ['content-type', 'application/json'],
        ['content-type', 'text/plain'],
      ],
      body: JSON.stringify({ valid: true }),
    });

    // Should still parse or reject — must not crash
    await expect(parseJsonBody(request, z.object({ valid: z.boolean() }))).resolves.toBeDefined();
  });

  it('rejects text/plain content-type with JSON parser', async () => {
    const request = new Request('https://stealth.test/api', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ valid: true }),
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toMatchObject({ status: 415 });
  });

  it('handles malformed query string gracefully', () => {
    const request = new Request('https://stealth.test/api?limit=%GG&page=%%%');
    expect(() => parseSearchParams(request, z.object({}))).not.toThrow();
  });

  it('handles empty query string', () => {
    const request = new Request('https://stealth.test/api');
    expect(() => parseSearchParams(request, z.object({ limit: z.coerce.number().optional() }))).not.toThrow();
  });

  it('handles very long query string', () => {
    const longParam = 'x'.repeat(10000);
    const request = new Request('https://stealth.test/api?q=' + longParam);
    expect(() => parseSearchParams(request, z.object({ q: z.string().optional() }))).not.toThrow();
  });

  it('rejects missing content-type with non-empty body', async () => {
    const request = new Request('https://stealth.test/api', {
      method: 'POST',
      body: 'some random text',
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toMatchObject({ status: 415 });
  });

  it('handles BOM in JSON body', async () => {
    const bom = '\uFEFF' + JSON.stringify({ valid: true });
    const request = new Request('https://stealth.test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: bom,
    });

    await expect(parseJsonBody(request, z.object({ valid: z.boolean() }))).resolves.toBeDefined();
  });

  it('handles deeply nested JSON without crashing', async () => {
    let deep: any = { value: 'bottom' };
    for (let i = 0; i < 20; i++) {
      deep = { nested: deep };
    }
    const request = new Request('https://stealth.test/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(deep),
    });

    await expect(parseJsonBody(request, z.object({}))).rejects.toBeDefined();
  });
});

