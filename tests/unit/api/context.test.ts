import { describe, expect, it } from "vitest";

import {
  ACTOR_HEADER,
  requireActor,
  requireActorMatches,
  requirePrincipal,
} from "../../../src/server/api/actor";
import {
  createApiContext,
  extractPrincipal,
  getApiContext,
  type ApiPrincipal,
} from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

const validAddress = `G${"A".repeat(55)}`;
const attackerAddress = `G${"B".repeat(55)}`;

describe("ApiPrincipal & ApiContext identity model", () => {
  it("extracts a valid ApiPrincipal from request headers", () => {
    const request = new Request("https://stealth.test/api", {
      headers: { [ACTOR_HEADER]: validAddress },
    });

    const principal = extractPrincipal(request);
    expect(principal).not.toBeNull();
    expect(principal?.address).toBe(validAddress);
    expect(principal?.authMethod).toBe("header");
    expect(principal?.authenticatedAt).toBeInstanceOf(Date);
    expect(principal?.metadata).toEqual({});
  });

  it("extracts delegation metadata when delegation header is present", () => {
    const request = new Request("https://stealth.test/api", {
      headers: {
        [ACTOR_HEADER]: validAddress,
        "x-stealth-delegation": JSON.stringify({ action: "policy:read" }),
      },
    });

    const principal = extractPrincipal(request);
    expect(principal).not.toBeNull();
    expect(principal?.authMethod).toBe("delegation");
    expect(principal?.metadata.delegation).toBe(JSON.stringify({ action: "policy:read" }));
  });

  it("distinguishes explicit anonymous from authenticated context", async () => {
    const repo = new MemoryApiRepository();
    const anonContext = createApiContext(repo, null);
    expect(anonContext.isAuthenticated).toBe(false);
    expect(anonContext.principal).toBeNull();

    const authReq = new Request("https://stealth.test/api", {
      headers: { [ACTOR_HEADER]: validAddress },
    });
    const authContext = await getApiContext(authReq);
    expect(authContext.isAuthenticated).toBe(true);
    expect(authContext.principal?.address).toBe(validAddress);
  });

  it("prevents header forgery after context initialization", async () => {
    const request = new Request("https://stealth.test/api", {
      headers: { [ACTOR_HEADER]: validAddress },
    });

    const context = await getApiContext(request);
    expect(context.isAuthenticated).toBe(true);
    expect(context.principal?.address).toBe(validAddress);

    // Attacker modifies the request headers after context has been built
    request.headers.set(ACTOR_HEADER, attackerAddress);

    // Protected handlers using context must stick to the verified principal, not the forged header
    const actor = requireActor(context);
    expect(actor).toBe(validAddress);
    expect(actor).not.toBe(attackerAddress);

    const principal = requirePrincipal(context);
    expect(principal.address).toBe(validAddress);
  });

  it("rejects unauthorized context regardless of forged headers", async () => {
    const request = new Request("https://stealth.test/api", {
      headers: { [ACTOR_HEADER]: validAddress },
    });

    const context = await getApiContext(request);

    expect(() => requireActorMatches(context, attackerAddress)).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });
});
