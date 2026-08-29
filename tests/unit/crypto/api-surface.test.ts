/**
 * BETA-085 (#1992) — Client-visible API cannot request raw signing or arbitrary XDR.
 */
import { describe, expect, it } from "vitest";
import * as clients from "../../../src/lib/api/clients";
import { WalletClient } from "../../../src/lib/api/clients";

const FORBIDDEN_METHOD_NAMES = [
  "signTransaction",
  "signXdr",
  "sign",
  "submitRawXdr",
  "submitTransaction",
  "exportSeed",
  "getSecret",
  "decryptSeed",
  "unwrapKey",
];

function prototypeMethodNames(ctor: new (...args: never[]) => unknown): string[] {
  const names = new Set<string>();
  let proto = ctor.prototype as object | null;
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (
        name !== "constructor" &&
        typeof (proto as Record<string, unknown>)[name] === "function"
      ) {
        names.add(name);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }
  return [...names];
}

describe("BETA-085 client API surface (#1992)", () => {
  it("WalletClient exposes only read-only wallet status", () => {
    const methods = prototypeMethodNames(WalletClient);
    expect(methods).toEqual(["getStatus"]);
    for (const forbidden of FORBIDDEN_METHOD_NAMES) {
      expect(methods).not.toContain(forbidden);
    }
  });

  it("no exported API client class exposes raw signing or seed export", () => {
    const clientClasses = Object.values(clients).filter(
      (v) => typeof v === "function" && v.prototype && v !== WalletClient,
    ) as Array<new (...args: never[]) => unknown>;

    for (const ctor of clientClasses) {
      if (ctor.name.endsWith("Client")) {
        const methods = prototypeMethodNames(ctor);
        for (const forbidden of FORBIDDEN_METHOD_NAMES) {
          expect(methods, `${ctor.name} must not expose ${forbidden}`).not.toContain(forbidden);
        }
      }
    }
  });
});
